import { storage } from './storage.js';
import { financialEngine } from './financialEngine.js';

export class DecisionEngine {
  async evaluateDecision(order, aiPrediction) {
    const settings = await storage.getSettings();
    const thresholds = settings.thresholds || { lowMax: 29, mediumMax: 54, highMax: 74 };
    
    const riskScore = aiPrediction.risk_score ?? aiPrediction.riskScore ?? 30;
    const isCod = (order.paymentMethod || 'COD').toUpperCase() === 'COD';
    const priorRto = order.customer?.priorRto ?? 0;
    const priorOrders = order.customer?.priorOrders ?? 0;
    const addressScore = aiPrediction.address_validation?.quality_score ?? 80;

    let decision = 'SHIP_AS_IS';
    let reason = '';
    const appliedRules = [];

    // Rule 1: Prepaid Orders
    if (!isCod) {
      decision = 'SHIP_AS_IS';
      reason = 'Prepaid order: Zero cash collection risk at delivery doorstep.';
      appliedRules.push('PREPAID_AUTO_CLEARANCE');
    }
    // Rule 2: Chronic Repeat RTO Offender
    else if (priorRto >= 2) {
      decision = 'HOLD_CANCEL';
      reason = `Customer has ${priorRto} past RTO returns. High probability of refusal.`;
      appliedRules.push('REPEAT_RTO_HOLD');
    }
    // Rule 3: First-Time Customer Protection (Marketing Priority)
    else if (priorOrders === 0 && settings.protectFirstTimeBuyers) {
      if (addressScore < 40) {
        decision = 'SHIP_AFTER_CONFIRMATION';
        reason = 'First-time buyer with incomplete address. Require WhatsApp confirmation before dispatch.';
        appliedRules.push('FIRST_TIME_ADDRESS_VERIFICATION');
      } else if (riskScore > thresholds.mediumMax) {
        decision = 'NUDGE_TO_PREPAID';
        reason = `First-time customer with elevated risk (${riskScore}/100). Offered ₹${settings.nudgeDiscountAmount || 20} prepaid discount to protect ₹300 CAC.`;
        appliedRules.push('FIRST_TIME_PREPAID_NUDGE');
      } else if (riskScore > thresholds.lowMax) {
        decision = 'SHIP_AFTER_CONFIRMATION';
        reason = 'First-time customer in medium risk tier. WhatsApp confirmation ensures delivery commitment.';
        appliedRules.push('FIRST_TIME_CONFIRMATION');
      } else {
        decision = 'SHIP_AS_IS';
        reason = 'First-time customer with clean low-risk profile.';
        appliedRules.push('FIRST_TIME_FAST_TRACK');
      }
    }
    // Rule 4: Standard Threshold Matrix
    else {
      if (riskScore <= thresholds.lowMax) {
        decision = settings.policies?.lowAction || 'SHIP_AS_IS';
        reason = `Low predicted risk score (${riskScore}/100). Safe for standard dispatch.`;
      } else if (riskScore <= thresholds.mediumMax) {
        decision = settings.policies?.mediumAction || 'SHIP_AFTER_CONFIRMATION';
        reason = `Medium risk score (${riskScore}/100). Require customer verification.`;
      } else if (riskScore <= thresholds.highMax) {
        decision = settings.policies?.highAction || 'NUDGE_TO_PREPAID';
        reason = `High risk score (${riskScore}/100). Incentivize prepaid payment.`;
      } else {
        decision = settings.policies?.criticalAction || 'HOLD_CANCEL';
        reason = `Critical risk score (${riskScore}/100). Return probability exceeds acceptable loss threshold.`;
      }
    }

    const economics = financialEngine.calculateOrderEconomics(order, riskScore / 100, decision);

    let status = 'PENDING_CONFIRMATION';
    if (decision === 'SHIP_AS_IS') {
      status = 'DISPATCH_READY';
    } else if (decision === 'CANCEL') {
      status = 'CANCELLED';
    } else if (['HOLD', 'HOLD_CANCEL', 'MANUAL_REVIEW'].includes(decision)) {
      status = 'HELD';
    }

    return {
      decision,
      status,
      reason,
      appliedRules,
      financialImpact: economics,
      decidedAt: new Date().toISOString()
    };
  }
}

export const decisionEngine = new DecisionEngine();

