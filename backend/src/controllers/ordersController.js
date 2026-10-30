import { storage } from '../services/storage.js';
import { aiClient } from '../services/aiClient.js';
import { decisionEngine } from '../services/decisionEngine.js';
import { financialEngine } from '../services/financialEngine.js';
import { logger } from '../utils/logger.js';

export const getOrders = async (req, res) => {
  try {
    const result = await storage.findOrders(req.query);
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    logger.error(`Error in getOrders: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await storage.findOrderById(id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // Call AI microservice for rich prediction & explainability factors if not fully populated
    const aiPrediction = await aiClient.predictOrder(order);
    const decisionData = await decisionEngine.evaluateDecision(order, aiPrediction);

    const riskFactors = aiPrediction.risk_factors || order.riskAssessment?.riskFactors || [];
    const addressValidation = {
      qualityScore: aiPrediction.address_validation?.quality_score ?? 80,
      isValid: aiPrediction.address_validation?.is_valid ?? true,
      category: aiPrediction.address_validation?.category ?? 'COMPLETE',
      issues: aiPrediction.address_validation?.issues ?? [],
      suggestedCorrection: aiPrediction.address_validation?.suggested_correction,
      validationSource: aiPrediction.address_validation?.validation_source ?? 'RULE_BASED'
    };
    const financialImpact = decisionData.financialImpact || {
      grossProfit: (order.orderValue || 649) * 0.62,
      expectedRtoCost: 169.40,
      cacAtRisk: (order.customer?.priorOrders ?? 0) === 0 ? 300 : 0
    };

    res.json({
      success: true,
      data: {
        ...order,
        aiPrediction,
        decisionAnalysis: decisionData,
        riskAssessment: {
          ...order.riskAssessment,
          riskScore: aiPrediction.risk_score ?? order.riskAssessment?.riskScore,
          riskTier: aiPrediction.risk_tier ?? order.riskAssessment?.riskTier,
          rtoProbability: aiPrediction.rto_probability ?? order.riskAssessment?.rtoProbability,
          confidence: aiPrediction.confidence ?? order.riskAssessment?.confidence,
          riskFactors
        },
        addressValidation,
        financialImpact
      }
    });
  } catch (err) {
    logger.error(`Error in getOrderById: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
};

export const overrideDecision = async (req, res) => {
  try {
    const { id } = req.params;
    const newDecision = req.body.newDecision || req.body.decision;
    const reason = req.body.reason;

    const allowed = ['SHIP_AS_IS', 'SHIP_AFTER_CONFIRMATION', 'NUDGE_TO_PREPAID', 'HOLD_CANCEL'];
    if (!allowed.includes(newDecision)) {
      return res.status(400).json({
        success: false,
        error: `Invalid decision '${newDecision}'. Allowed: ${allowed.join(', ')}`
      });
    }

    const order = await storage.findOrderById(id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const previousDecision = order.operationalDecision?.decision;
    const updated = await storage.updateOrder(id, {
      'operationalDecision.decision': newDecision,
      'operationalDecision.status': newDecision === 'SHIP_AS_IS' ? 'DISPATCH_READY' : newDecision === 'HOLD_CANCEL' ? 'MANUALLY_HELD' : 'PENDING_CONFIRMATION',
      'operationalDecision.override': {
        previousDecision,
        overriddenBy: req.user?.email || 'admin@rtosentinel.com',
        reason: reason || 'Manual operational review override.',
        overriddenAt: new Date().toISOString()
      }
    });

    res.json({
      success: true,
      message: `Order #${id} decision updated to ${newDecision}`,
      data: updated
    });
  } catch (err) {
    logger.error(`Error in overrideDecision: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
};

export const createTestOrder = async (req, res) => {
  try {
    const body = req.body;
    const orderId = body.orderId || `ORD_TEST_${Date.now().toString().slice(-4)}`;

    const customerName = body.customerName || body.customer?.name || 'Test Customer';
    const shippingCity = body.shippingCity || body.city || body.shipping?.city || 'Mumbai';
    const shippingState = body.shippingState || body.state || body.shipping?.state || 'Maharashtra';
    const shippingPincode = String(body.shippingPincode || body.pincode || body.shipping?.pincode || '400001');
    const shippingAddress = body.shippingAddress || body.address || body.shipping?.address || 'Flat 101, Main Road';
    const priorOrders = parseInt(body.customerPriorOrders ?? body.priorOrders ?? body.customer?.priorOrders ?? 0, 10);
    const priorRto = parseInt(body.customerPriorRto ?? body.priorRtos ?? body.priorRto ?? body.customer?.priorRto ?? 0, 10);

    const newOrderPayload = {
      orderId,
      orderValue: parseFloat(body.orderValue || 649),
      numItems: parseInt(body.numItems || 1, 10),
      paymentMethod: (body.paymentMethod || 'COD').toUpperCase(),
      finalStatus: 'IN_TRANSIT',
      customer: {
        name: customerName,
        phone: body.customerPhone || '+91 9876543210',
        email: body.customerEmail || 'test@example.com',
        priorOrders,
        priorRto
      },
      shipping: {
        address: shippingAddress,
        city: shippingCity,
        state: shippingState,
        pincode: shippingPincode
      },
      utmSource: body.utmSource || 'direct'
    };

    // Run AI prediction
    const aiPrediction = await aiClient.predictOrder(newOrderPayload);
    const decisionAnalysis = await decisionEngine.evaluateDecision(newOrderPayload, aiPrediction);

    const saved = await storage.createOrder({
      ...newOrderPayload,
      riskAssessment: {
        riskScore: aiPrediction.risk_score,
        riskTier: aiPrediction.risk_tier,
        rtoProbability: aiPrediction.rto_probability,
        confidence: aiPrediction.confidence,
        riskFactors: aiPrediction.risk_factors
      },
      operationalDecision: {
        decision: decisionAnalysis.decision,
        status: decisionAnalysis.status,
        reason: decisionAnalysis.reason,
        decidedAt: decisionAnalysis.decidedAt,
        override: null
      },
      whatsapp: {
        status: decisionAnalysis.decision === 'SHIP_AFTER_CONFIRMATION' ? 'PENDING_CONFIRMATION' : decisionAnalysis.decision === 'NUDGE_TO_PREPAID' ? 'PENDING_NUDGE' : 'NOT_REQUIRED',
        conversationId: null,
        lastMessageSentAt: null
      }
    });

    res.status(201).json({
      success: true,
      data: saved,
      aiPrediction,
      decisionAnalysis,
      // Normalize common accessors for frontend
      riskAssessment: {
        riskScore: aiPrediction.risk_score,
        riskTier: aiPrediction.risk_tier,
        rtoProbability: aiPrediction.rto_probability,
        confidence: aiPrediction.confidence,
        riskFactors: aiPrediction.risk_factors
      },
      addressValidation: {
        qualityScore: aiPrediction.address_validation?.quality_score ?? 80,
        isValid: aiPrediction.address_validation?.is_valid ?? true,
        category: aiPrediction.address_validation?.category ?? 'COMPLETE',
        issues: aiPrediction.address_validation?.issues ?? [],
        suggestedCorrection: aiPrediction.address_validation?.suggested_correction,
        validationSource: aiPrediction.address_validation?.validation_source ?? 'RULE_BASED'
      },
      financialImpact: decisionAnalysis.financialImpact
    });
  } catch (err) {
    logger.error(`Error creating test order: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
};

