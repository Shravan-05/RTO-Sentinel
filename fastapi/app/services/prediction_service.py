import os
import json
import logging
import joblib
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Tuple
from app.core.config import settings
from app.schemas.order import (
    OrderInput,
    PredictionResponse,
    RiskFactor,
    AddressValidationResult,
    FinancialImpactBreakdown
)
from app.ml.preprocessing.pipeline import DataPipeline
from app.llm.gemini_validator import validate_address_with_gemini

logger = logging.getLogger("rto_sentinel.prediction")

class PredictionService:
    def __init__(self):
        self.model = None
        self.feature_columns = []
        self.pipeline = DataPipeline()
        self.thresholds = self._load_thresholds()
        self.business_rules = self._load_business_rules()
        self._load_model_artifacts()

    def _load_thresholds(self) -> Dict[str, Any]:
        try:
            with open(settings.RISK_THRESHOLDS_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Could not load thresholds config: {e}. Using defaults.")
            return {
                "thresholds": {"low_max": 29, "medium_max": 54, "high_max": 74},
                "decisions": {
                    "low": "SHIP_AS_IS",
                    "medium": "SHIP_AFTER_CONFIRMATION",
                    "high": "NUDGE_TO_PREPAID",
                    "critical": "HOLD_CANCEL"
                }
            }

    def _load_business_rules(self) -> Dict[str, Any]:
        try:
            with open(settings.BUSINESS_RULES_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Could not load business rules config: {e}. Using defaults.")
            return {
                "unit_economics": {
                    "aov": 649,
                    "gross_margin_percent": 0.62,
                    "delivered_gross_profit": 402.38,
                    "expected_rto_cost": 169.40,
                    "cac_loss": 300
                }
            }

    def _load_model_artifacts(self):
        self.model = None
        self.calibrated_model = None
        if os.path.exists(settings.MODEL_PATH):
            try:
                self.model = joblib.load(settings.MODEL_PATH)
                logger.info("Loaded ML champion raw model successfully.")
            except Exception as e:
                logger.error(f"Error loading model artifact: {e}")
        else:
            logger.warning(f"Model file not found at {settings.MODEL_PATH}.")

        if os.path.exists(settings.CALIBRATED_MODEL_PATH):
            try:
                self.calibrated_model = joblib.load(settings.CALIBRATED_MODEL_PATH)
                logger.info("Loaded ML champion calibrated model (Platt scaling) successfully.")
            except Exception as e:
                logger.error(f"Error loading calibrated model artifact: {e}")
        else:
            logger.warning(f"Calibrated model not found at {settings.CALIBRATED_MODEL_PATH}.")

        # Load lookups if available
        if os.path.exists(settings.CITY_RISK_PATH):
            try:
                with open(settings.CITY_RISK_PATH, "r", encoding="utf-8") as f:
                    self.pipeline.city_risk_map = json.load(f)
            except Exception as e:
                logger.error(f"Error loading city risk map: {e}")
        if os.path.exists(settings.PINCODE_RISK_PATH):
            try:
                with open(settings.PINCODE_RISK_PATH, "r", encoding="utf-8") as f:
                    self.pipeline.pincode_risk_map = json.load(f)
            except Exception as e:
                logger.error(f"Error loading pincode risk map: {e}")

    def predict_single(self, order: OrderInput) -> PredictionResponse:
        # 1. Evaluate Address Quality & Completeness
        addr_val: AddressValidationResult = validate_address_with_gemini(
            address=order.shipping_address,
            city=order.shipping_city,
            state=order.shipping_state,
            pincode=order.shipping_pincode,
            customer_name=order.customer_name or ""
        )
        
        # 2. Extract ML Features
        order_dict = order.model_dump()
        feat_df = self.pipeline.transform_single_order(order_dict)
        
        # 3. Model Prediction: Raw Sigmoid and Platt-Calibrated Probability
        raw_prob = 0.284
        calibrated_prob = 0.284
        
        if self.model is not None:
            try:
                probs = self.model.predict_proba(feat_df)[0]
                raw_prob = float(probs[1])
            except Exception as e:
                logger.error(f"Raw prediction inference failed: {e}")

        if self.calibrated_model is not None:
            try:
                cal_probs = self.calibrated_model.predict_proba(feat_df)[0]
                calibrated_prob = float(cal_probs[1])
            except Exception as e:
                logger.error(f"Calibrated prediction inference failed: {e}")
                calibrated_prob = raw_prob
        else:
            calibrated_prob = raw_prob
                
        # 4. Feature Impact / Heuristic Explanations
        risk_factors = self._generate_explainability(order, feat_df, addr_val, calibrated_prob)
        
        # 5. Composite Risk Score (0 - 100)
        # Combine calibrated model probability (70%) with address validation deficit (30%)
        address_penalty = (100 - addr_val.quality_score) / 100.0
        blended_prob = (calibrated_prob * 0.70) + (address_penalty * 0.30)
        
        # Customer history boost
        if order.customer_prior_rto >= 2:
            blended_prob = max(blended_prob, 0.85)
        elif order.customer_prior_rto == 1:
            blended_prob = max(blended_prob, 0.60)
            
        risk_score = int(round(blended_prob * 100))
        risk_score = max(5, min(98, risk_score))
        
        # Risk Tier
        t = self.thresholds.get("thresholds", {"low_max": 29, "medium_max": 54, "high_max": 74})
        if risk_score <= t.get("low_max", 29):
            risk_tier = "LOW"
        elif risk_score <= t.get("medium_max", 54):
            risk_tier = "MEDIUM"
        elif risk_score <= t.get("high_max", 74):
            risk_tier = "HIGH"
        else:
            risk_tier = "CRITICAL"

        # 6. Apply Business Rules & Decision Arbitration
        decision, decision_reason, rule_overrides, recommended_actions = self._arbitrate_decision(
            order=order,
            risk_score=risk_score,
            risk_tier=risk_tier,
            addr_val=addr_val
        )

        # 7. Unit Economics & Financial Justification
        financial_impact = self._calculate_financial_impact(order, calibrated_prob, decision)

        return PredictionResponse(
            order_id=order.order_id,
            rto_probability=round(calibrated_prob, 4),
            ml_raw_score=round(raw_prob, 4),
            ml_calibrated_probability=round(calibrated_prob, 4),
            address_quality_score=addr_val.quality_score,
            operational_risk_score=risk_score,
            risk_score=risk_score,
            risk_tier=risk_tier,
            decision=decision,
            decision_reason=decision_reason,
            confidence=round(1.0 - abs(blended_prob - 0.5) * 0.3, 3),
            financial_impact=financial_impact,
            risk_factors=risk_factors,
            address_validation=addr_val,
            recommended_actions=recommended_actions,
            rule_overrides_applied=rule_overrides
        )

    def _generate_explainability(
        self,
        order: OrderInput,
        feat_df: pd.DataFrame,
        addr_val: AddressValidationResult,
        raw_prob: float
    ) -> List[RiskFactor]:
        factors = []
        
        # Factor 1: Prior RTO History
        if order.customer_prior_rto > 0:
            factors.append(RiskFactor(
                feature="Prior Customer RTO History",
                impact="RISK_INCREASING",
                weight=35.0 if order.customer_prior_rto >= 2 else 20.0,
                description=f"Customer has {order.customer_prior_rto} prior RTO delivery failures (repeat RTO risk)."
            ))
        elif order.customer_prior_orders > 1 and order.customer_prior_rto == 0:
            factors.append(RiskFactor(
                feature="Established Customer Track Record",
                impact="RISK_DECREASING",
                weight=25.0,
                description=f"Loyal repeat buyer with {order.customer_prior_orders} past delivered orders and 0 RTOs."
            ))
            
        # Factor 2: Address Completeness & Clarity
        if addr_val.quality_score < 60:
            factors.append(RiskFactor(
                feature="Incomplete / Vague Address",
                impact="RISK_INCREASING",
                weight=30.0,
                description=f"Address quality rating is low ({addr_val.quality_score}/100): {'; '.join(addr_val.issues[:2])}"
            ))
        elif addr_val.quality_score >= 85:
            factors.append(RiskFactor(
                feature="High Quality Verified Address",
                impact="RISK_DECREASING",
                weight=15.0,
                description="Street, house/building details, and prominent landmarks are fully specified."
            ))
            
        # Factor 3: Geographic / Regional Risk
        state = (order.shipping_state or "").lower()
        high_rto_states = ["bihar", "uttar pradesh", "west bengal", "madhya pradesh"]
        low_rto_states = ["maharashtra", "karnataka", "tamil nadu", "delhi", "telangana"]
        
        if any(s in state for s in high_rto_states):
            factors.append(RiskFactor(
                feature="Regional Courier RTO Density",
                impact="RISK_INCREASING",
                weight=18.0,
                description=f"Delivery destination in {order.shipping_state} historically exhibits high logistics return rates."
            ))
        elif any(s in state for s in low_rto_states):
            factors.append(RiskFactor(
                feature="Tier-1 Metro Logistic Efficiency",
                impact="RISK_DECREASING",
                weight=12.0,
                description=f"Delivery location in {order.shipping_state} enjoys higher first-attempt courier success."
            ))
            
        # Factor 4: Payment Method
        if order.payment_method.upper() == "PREPAID":
            factors.append(RiskFactor(
                feature="Prepaid Payment Commitment",
                impact="RISK_DECREASING",
                weight=40.0,
                description="Customer has already paid. Historical prepaid RTO is only 4% (vs 28% for COD)."
            ))
        else:
            factors.append(RiskFactor(
                feature="Cash on Delivery (COD) Exposure",
                impact="RISK_INCREASING",
                weight=15.0,
                description="COD orders carry inherent refusal risk at delivery doorstep."
            ))

        # Factor 5: Order Value
        if order.order_value > 1200:
            factors.append(RiskFactor(
                feature="High Order Value COD Risk",
                impact="RISK_INCREASING",
                weight=10.0,
                description=f"Order value (₹{order.order_value:.0f}) exceeds average order size (₹649), increasing cash refusal probability."
            ))

        return factors

    def _arbitrate_decision(
        self,
        order: OrderInput,
        risk_score: int,
        risk_tier: str,
        addr_val: AddressValidationResult
    ) -> Tuple[str, str, List[str], List[str]]:
        """
        Applies four canonical buckets:
        - SHIP_AS_IS
        - SHIP_AFTER_CONFIRMATION
        - NUDGE_TO_PREPAID
        - HOLD_CANCEL
        Balances Operations loss minimization with Marketing first-time customer acquisition.
        """
        overrides = []
        actions = []
        
        # RULE 1: Prepaid Orders are safe
        if order.payment_method.upper() == "PREPAID":
            overrides.append("PREPAID_AUTO_CLEARANCE")
            actions.append("Process immediately for warehouse fulfillment.")
            return (
                "SHIP_AS_IS",
                "Prepaid order with zero cash collection risk at doorstep.",
                overrides,
                actions
            )
            
        # RULE 2: Critical Repeat Offender (prior RTO >= 2)
        if order.customer_prior_rto >= 2:
            overrides.append("REPEAT_OFFENDER_HOLD")
            actions.append("Trigger WhatsApp Prepaid Conversion link with ₹20 discount.")
            actions.append("Do not dispatch parcel until prepaid transaction is confirmed.")
            return (
                "HOLD_CANCEL",
                f"Customer has {order.customer_prior_rto} confirmed prior RTOs. High probability of refusal; hold shipment unless prepaid.",
                overrides,
                actions
            )

        # RULE 3: First-Time Customer Protection (Marketing Priority)
        # If customer has 0 prior orders, do NOT cancel outright unless address is complete gibberish.
        if order.customer_prior_orders == 0:
            if addr_val.category in ["GIBBERISH", "INVALID_PINCODE"]:
                overrides.append("FIRST_TIME_UNREACHABLE_ADDRESS")
                actions.append("Send WhatsApp address correction request.")
                return (
                    "HOLD_CANCEL",
                    "First-time buyer with unserviceable or gibberish delivery address. Held until address is updated.",
                    overrides,
                    actions
                )
            
            if risk_score >= 70:
                overrides.append("FIRST_TIME_NUDGE_PROTECTION")
                actions.append("Send automated WhatsApp Prepaid Nudge with instant ₹20 discount.")
                actions.append("If customer declines or times out, evaluate dispatch with address confirmation.")
                return (
                    "NUDGE_TO_PREPAID",
                    "Elevated risk for first-time customer. Protecting ₹300 CAC by offering ₹20 prepaid incentive rather than cancelling.",
                    overrides,
                    actions
                )
                
            if risk_score >= 35 or addr_val.quality_score < 75:
                overrides.append("FIRST_TIME_WHATSAPP_CONFIRMATION")
                actions.append("Send interactive 1-click WhatsApp confirmation message.")
                actions.append("Dispatch immediately upon customer affirmative reply.")
                return (
                    "SHIP_AFTER_CONFIRMATION",
                    "First-time buyer in moderate risk band. Verified intent needed via WhatsApp before warehouse dispatch.",
                    overrides,
                    actions
                )

        # RULE 4: Address Deficit Trigger
        if addr_val.quality_score < 50:
            overrides.append("POOR_ADDRESS_CONFIRMATION_REQUIRED")
            actions.append("Request house number and nearest landmark via automated WhatsApp.")
            return (
                "SHIP_AFTER_CONFIRMATION",
                f"Address quality is deficient ({addr_val.quality_score}/100). Require customer landmark confirmation.",
                overrides,
                actions
            )

        # RULE 5: Standard Threshold-Based Allocation
        if risk_tier == "LOW":
            actions.append("Fast-track label generation and warehouse pick-pack.")
            return (
                "SHIP_AS_IS",
                f"Low predicted RTO probability (Risk Score: {risk_score}/100). Safe for instant dispatch.",
                overrides,
                actions
            )
        elif risk_tier == "MEDIUM":
            actions.append("Send standard WhatsApp delivery confirmation prompt.")
            return (
                "SHIP_AFTER_CONFIRMATION",
                f"Moderate RTO risk ({risk_score}/100). Standard WhatsApp order verification recommended.",
                overrides,
                actions
            )
        elif risk_tier == "HIGH":
            actions.append("Trigger WhatsApp ₹20 Prepaid discount payment gateway link.")
            return (
                "NUDGE_TO_PREPAID",
                f"High RTO probability ({risk_score}/100). Incentivize prepaid payment with ₹20 discount to eliminate courier refusal risk.",
                overrides,
                actions
            )
        else:
            actions.append("Review manually or convert to 100% prepaid before releasing dispatch.")
            return (
                "HOLD_CANCEL",
                f"Critical RTO probability ({risk_score}/100). Financial expectation of shipping is negative. Hold order.",
                overrides,
                actions
            )

    def _calculate_financial_impact(self, order: OrderInput, prob: float, decision: str) -> FinancialImpactBreakdown:
        """
        Computes mathematically rigorous unit economics:
        - Delivered Gross Profit = Order Value * 62%
        - Expected RTO Loss = Forward ₹65 + Return ₹65 + Pack ₹25 + (8% damage * ₹180 product) = ₹169.40
        - CAC Loss Risk = ₹300 for first-time buyers
        """
        gross_profit = order.order_value * settings.GROSS_MARGIN_PCT
        expected_rto_loss = (
            settings.FORWARD_SHIPPING +
            settings.RETURN_SHIPPING +
            settings.PACKAGING_HANDLING +
            (settings.DAMAGE_PROBABILITY * settings.AVG_PRODUCT_COST)
        )
        cac_loss = settings.CAC_NEW_CUSTOMER if order.customer_prior_orders == 0 else 0.0
        
        # Expected value if dispatched without intervention:
        # EV(ship) = (1 - p) * Gross Profit - p * Expected RTO Loss
        ev_ship = ((1.0 - prob) * gross_profit) - (prob * expected_rto_loss)
        
        # Expected value if cancelled outright:
        # EV(cancel) = 0 - CAC loss (for first timers)
        ev_cancel = -cac_loss
        
        discount = self.thresholds.get("prepaidIncentive", {}).get("defaultDiscountAmount", 20)
        expected_prepaid_benefit = round(((0.2843 - 0.04) * expected_rto_loss) - discount, 2)
        
        if decision == "SHIP_AS_IS":
            roi_desc = f"Dispatching captures +₹{ev_ship:.1f} net expected margin."
        elif decision == "SHIP_AFTER_CONFIRMATION":
            roi_desc = f"WhatsApp verification filters ~65% of uncommitted buyers, saving ₹{expected_rto_loss:.1f} per prevented RTO."
        elif decision == "NUDGE_TO_PREPAID":
            roi_desc = f"Converting to prepaid with ₹{discount} discount nets ~+₹{expected_prepaid_benefit:.1f} per converted order (assumes 4% prepaid RTO)."
        else:
            roi_desc = f"Holding prevents high-confidence logistics loss of -₹{expected_rto_loss:.1f}."

        return FinancialImpactBreakdown(
            gross_margin_profit=round(gross_profit, 2),
            expected_rto_loss=round(expected_rto_loss, 2),
            cac_loss_risk=round(cac_loss, 2),
            net_expected_payoff_ship=round(ev_ship, 2),
            net_expected_payoff_cancel=round(ev_cancel, 2),
            recommended_strategy_roi=roi_desc
        )

prediction_service = PredictionService()
