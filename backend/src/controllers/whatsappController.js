import { whatsAppService } from '../services/whatsappService.js';
import { logger } from '../utils/logger.js';

export const getConversation = async (req, res) => {
  try {
    const { orderId } = req.params;
    const conv = await whatsAppService.getOrCreateConversation(orderId);
    res.json({
      success: true,
      data: {
        ...conv,
        simulatedCurrentTime: whatsAppService.getSimulatedTime()
      }
    });
  } catch (err) {
    logger.error(`Error in getConversation: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
};

export const triggerMessage = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { workflowType } = req.body;
    const conv = await whatsAppService.triggerAutomatedMessage(orderId, workflowType);
    res.json({
      success: true,
      data: {
        ...conv,
        simulatedCurrentTime: whatsAppService.getSimulatedTime(),
        simulatedTime: whatsAppService.getSimulatedTime()
      }
    });
  } catch (err) {
    logger.error(`Error in triggerMessage: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
};

export const customerReply = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reply } = req.body;
    if (!reply) {
      return res.status(400).json({ success: false, error: 'Reply text is required' });
    }

    const conv = await whatsAppService.handleCustomerReply(orderId, reply);
    res.json({
      success: true,
      data: {
        ...conv,
        simulatedCurrentTime: whatsAppService.getSimulatedTime(),
        simulatedTime: whatsAppService.getSimulatedTime()
      }
    });
  } catch (err) {
    logger.error(`Error in customerReply: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
};

export const fastForward = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { hours = 24 } = req.body;
    const result = await whatsAppService.fastForwardHours(orderId, hours);
    res.json({
      success: true,
      message: `Clock advanced by ${hours} hours.`,
      data: {
        ...result.conversation,
        simulatedCurrentTime: result.simulatedNow,
        simulatedTime: result.simulatedNow
      }
    });
  } catch (err) {
    logger.error(`Error in fastForward: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
};

export const resetClock = async (req, res) => {
  try {
    const now = whatsAppService.resetClock();
    res.json({
      success: true,
      simulatedCurrentTime: now.toISOString()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

