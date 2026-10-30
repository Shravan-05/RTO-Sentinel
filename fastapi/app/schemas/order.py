from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class OrderInput(BaseModel):
    order_id: str = Field(..., description="Unique order identifier")
    order_value: float = Field(649.0, description="Total order amount in INR")
    payment_method: str = Field("COD", description="Payment method: COD or PREPAID")
    shipping_address: str = Field(..., description="Full street delivery address")
    shipping_city: str = Field(..., description="Delivery city")
    shipping_state: str = Field(..., description="Delivery state")
    shipping_pincode: str = Field(..., description="6-digit postal code")
    customer_name: Optional[str] = Field("Customer", description="Full name of customer")
    customer_email: Optional[str] = Field(None, description="Email address")
    customer_phone: Optional[str] = Field(None, description="Phone number")
    customer_prior_orders: int = Field(0, description="Total completed past orders")
    customer_prior_rto: int = Field(0, description="Total past RTOs")
    created_at: Optional[str] = Field(None, description="ISO timestamp of order creation")

class RiskFactor(BaseModel):
    feature: str
    impact: str  # "RISK_INCREASING" | "RISK_DECREASING" | "NEUTRAL"
    weight: float
    description: str

class AddressValidationResult(BaseModel):
    is_valid: bool
    quality_score: int  # 0 to 100
    category: str  # "COMPLETE" | "MISSING_LANDMARK" | "VAGUE" | "GIBBERISH" | "INVALID_PINCODE"
    issues: List[str]
    suggested_correction: Optional[str] = None
    validation_source: str = "RULE_BASED"  # "GEMINI_AI" | "RULE_BASED"

class FinancialImpactBreakdown(BaseModel):
    gross_margin_profit: float
    expected_rto_loss: float
    cac_loss_risk: float
    net_expected_payoff_ship: float
    net_expected_payoff_cancel: float
    recommended_strategy_roi: str

class PredictionResponse(BaseModel):
    order_id: str
    rto_probability: float  # 0.0 - 1.0 (calibrated probability when available, otherwise model output)
    ml_raw_score: Optional[float] = Field(None, description="Raw uncalibrated model decision function / sigmoid score")
    ml_calibrated_probability: Optional[float] = Field(None, description="Platt-calibrated probability P(RTO|x)")
    address_quality_score: Optional[int] = Field(None, description="Normalized address quality score [0 - 100]")
    operational_risk_score: Optional[int] = Field(None, description="Blended operational decision score [0 - 100]")
    risk_score: int  # 0 - 100 (standardized operational risk score)
    risk_tier: str  # "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
    decision: str  # "SHIP_AS_IS" | "SHIP_AFTER_CONFIRMATION" | "NUDGE_TO_PREPAID" | "HOLD_CANCEL"
    decision_reason: str
    confidence: float
    financial_impact: FinancialImpactBreakdown
    risk_factors: List[RiskFactor]
    address_validation: AddressValidationResult
    recommended_actions: List[str]
    rule_overrides_applied: List[str] = []

class BatchPredictionRequest(BaseModel):
    orders: List[OrderInput]

class BatchPredictionResponse(BaseModel):
    total_processed: int
    predictions: List[PredictionResponse]

class AddressValidationRequest(BaseModel):
    address: str
    city: str
    state: str
    pincode: str
    customer_name: Optional[str] = None

