import axios from 'axios';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

class AIClient {
  constructor() {
    this.baseUrl = config.aiEngineUrl;
  }

  async predictOrder(order) {
    try {
      const payload = {
        order_id: order.orderId || order.id,
        order_value: order.orderValue || 649,
        payment_method: order.paymentMethod || 'COD',
        shipping_address: order.shipping?.address || order.address || '',
        shipping_city: order.shipping?.city || order.city || '',
        shipping_state: order.shipping?.state || order.state || '',
        shipping_pincode: order.shipping?.pincode || order.pincode || '',
        customer_name: order.customer?.name || order.customer_name || 'Customer',
        customer_email: order.customer?.email || null,
        customer_phone: order.customer?.phone || null,
        customer_prior_orders: order.customer?.priorOrders ?? order.customer_prior_orders ?? 0,
        customer_prior_rto: order.customer?.priorRto ?? order.customer_prior_rto ?? 0,
        created_at: order.orderDatetime || new Date().toISOString()
      };

      const res = await axios.post(`${this.baseUrl}/predict`, payload, { timeout: 4000 });
      return res.data;
    } catch (err) {
      logger.warn(`AI Engine unavailable (${err.message}). Using local rule engine fallback.`);
      return this._localHeuristicPrediction(order);
    }
  }

  async validateAddress(addressData) {
    try {
      const res = await axios.post(`${this.baseUrl}/validate-address`, addressData, { timeout: 3000 });
      return res.data;
    } catch (err) {
      logger.warn(`Address validator microservice error (${err.message}). Using local rule validator.`);
      return this._localAddressValidation(addressData.address || '');
    }
  }

  _localAddressValidation(address) {
    const clean = (address || '').trim().toLowerCase();
    const isVague = clean.length < 10 || ['home', 'xyz', 'near station', '.'].includes(clean);
    return {
      is_valid: !isVague,
      quality_score: isVague ? 35 : 85,
      category: isVague ? 'VAGUE' : 'COMPLETE',
      issues: isVague ? ['Address appears incomplete or missing landmark.'] : [],
      suggested_correction: isVague ? 'Please provide full house number and street/landmark.' : null,
      validation_source: 'LOCAL_RULE_FALLBACK'
    };
  }

  _localHeuristicPrediction(order) {
    const priorRto = order.customer?.priorRto ?? 0;
    const priorOrders = order.customer?.priorOrders ?? 0;
    const isCod = (order.paymentMethod || 'COD').toUpperCase() === 'COD';
    const city = (order.shipping?.city || '').toLowerCase();
    
    let score = 25;
    let decision = 'SHIP_AS_IS';
    let tier = 'LOW';
    let reason = 'Order meets standard low-risk criteria.';

    if (!isCod) {
      score = 8;
      decision = 'SHIP_AS_IS';
      tier = 'LOW';
      reason = 'Prepaid order with zero cash refusal risk.';
    } else if (priorRto >= 2) {
      score = 85;
      decision = 'HOLD_CANCEL';
      tier = 'CRITICAL';
      reason = `Customer has ${priorRto} past RTO delivery failures. Hold shipment.`;
    } else if (priorRto === 1) {
      score = 65;
      decision = 'NUDGE_TO_PREPAID';
      tier = 'HIGH';
      reason = 'Customer had 1 previous RTO. Incentivize prepaid payment with ₹20 discount.';
    } else if (['gorakhpur', 'bareilly', 'darbhanga', 'sagar', 'patna'].includes(city)) {
      score = 56;
      decision = priorOrders === 0 ? 'SHIP_AFTER_CONFIRMATION' : 'NUDGE_TO_PREPAID';
      tier = 'HIGH';
      reason = 'Destination city historically exhibits high delivery return rate.';
    } else if ((order.shipping?.address || '').length < 12) {
      score = 48;
      decision = 'SHIP_AFTER_CONFIRMATION';
      tier = 'MEDIUM';
      reason = 'Short or incomplete delivery address. Verify via WhatsApp.';
    }

    const expectedRtoLoss = 169.40;
    const grossMargin = (order.orderValue || 649) * 0.62;
    const prob = score / 100;
    const ev = (1 - prob) * grossMargin - prob * expectedRtoLoss;

    return {
      order_id: order.orderId || order.id,
      rto_probability: prob,
      ml_raw_score: prob,
      ml_calibrated_probability: prob,
      operational_risk_score: score,
      address_quality_score: (order.shipping?.address || '').length < 12 ? 40 : 85,
      risk_score: score,
      risk_tier: tier,
      decision,
      decision_reason: reason,
      confidence: 0.85,
      financial_impact: {
        gross_margin_profit: grossMargin,
        expected_rto_loss: expectedRtoLoss,
        cac_loss_risk: priorOrders === 0 ? 300 : 0,
        net_expected_payoff_ship: ev,
        net_expected_payoff_cancel: priorOrders === 0 ? -300 : 0,
        recommended_strategy_roi: `Intervention protects expected financial outcome.`
      },
      risk_factors: [
        { feature: 'Payment Method', impact: isCod ? 'RISK_INCREASING' : 'RISK_DECREASING', weight: 15, description: isCod ? 'COD transaction' : 'Prepaid verified' },
        { feature: 'Customer History', impact: priorRto > 0 ? 'RISK_INCREASING' : 'NEUTRAL', weight: 25, description: `${priorRto} prior RTO records` }
      ],
      address_validation: this._localAddressValidation(order.shipping?.address),
      recommended_actions: [decision === 'SHIP_AS_IS' ? 'Release parcel for dispatch.' : 'Trigger automated WhatsApp flow.'],
      rule_overrides_applied: []
    };
  }
}

export const aiClient = new AIClient();

