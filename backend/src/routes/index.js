import express from 'express';
import * as authController from '../controllers/authController.js';
import * as ordersController from '../controllers/ordersController.js';
import * as whatsappController from '../controllers/whatsappController.js';
import * as analyticsController from '../controllers/analyticsController.js';
import * as settingsController from '../controllers/settingsController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Public Auth
router.post('/auth/login', authController.login);
router.get('/auth/me', authenticate, authController.getMe);

// Orders
router.get('/orders', authenticate, ordersController.getOrders);
router.post('/orders', authenticate, ordersController.createTestOrder);
router.get('/orders/:id', authenticate, ordersController.getOrderById);
router.post('/orders/:id/override', authenticate, ordersController.overrideDecision);

// WhatsApp Simulator
router.get('/whatsapp/:orderId', authenticate, whatsappController.getConversation);
router.post('/whatsapp/:orderId/send', authenticate, whatsappController.triggerMessage);
router.post('/whatsapp/:orderId/reply', authenticate, whatsappController.customerReply);
router.post('/whatsapp/:orderId/fast-forward', authenticate, whatsappController.fastForward);
router.post('/whatsapp/clock/reset', authenticate, whatsappController.resetClock);

// Analytics & Reports
router.get('/analytics/overview', authenticate, analyticsController.getFounderOverview);
router.get('/analytics/yesterday', authenticate, analyticsController.getYesterdayMetrics);
router.get('/analytics/geographic', authenticate, analyticsController.getGeographicBreakdown);
router.get('/analytics/backtest', authenticate, analyticsController.runBacktest);

// Settings
router.get('/settings', authenticate, settingsController.getSettings);
router.put('/settings', authenticate, settingsController.updateSettings);

export default router;

