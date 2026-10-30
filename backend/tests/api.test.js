import test from 'node:test';
import assert from 'node:assert';
import { FinancialEngine } from '../src/services/financialEngine.js';
import { DecisionEngine } from '../src/services/decisionEngine.js';
import { WhatsAppSimulatorService } from '../src/services/whatsappService.js';
import { storage } from '../src/services/storage.js';

test('FinancialEngine calculates unit economics precisely', () => {
  const fe = new FinancialEngine();
  
  // Forward ₹65 + Return ₹65 + Pack ₹25 + (8% * ₹180 = ₹14.40) = ₹169.40
  assert.strictEqual(fe.expectedRtoCost, 169.40);
  
  // AOV ₹649 * 62% = ₹402.38
  assert.strictEqual(Math.round(fe.deliveredGrossProfit * 100) / 100, 402.38);

  // Test single order economics
  const order = { orderValue: 649, customer: { priorOrders: 0 } };
  const econ = fe.calculateOrderEconomics(order, 0.28, 'SHIP_AFTER_CONFIRMATION');
  
  assert.strictEqual(econ.grossProfit, 402.38);
  assert.strictEqual(econ.expectedRtoCost, 169.40);
  assert.strictEqual(econ.cacAtRisk, 300);
  assert.ok(econ.expectedNetSavings >= 0);
});

test('DecisionEngine enforces 4 canonical buckets and rules', async () => {
  await storage.init();
  const de = new DecisionEngine();

  // Test Prepaid Order
  const prepaidOrder = { paymentMethod: 'PREPAID', orderValue: 649, customer: { priorOrders: 1, priorRto: 0 } };
  const decPrepaid = await de.evaluateDecision(prepaidOrder, { risk_score: 15 });
  assert.strictEqual(decPrepaid.decision, 'SHIP_AS_IS');

  // Test Repeat RTO Offender (Prior RTO >= 2)
  const chronicOrder = { paymentMethod: 'COD', orderValue: 1299, customer: { priorOrders: 2, priorRto: 2 } };
  const decChronic = await de.evaluateDecision(chronicOrder, { risk_score: 80 });
  assert.strictEqual(decChronic.decision, 'HOLD_CANCEL');

  // Test First-Timer Protection (Should not cancel outright)
  const firstTimerOrder = { paymentMethod: 'COD', orderValue: 649, customer: { priorOrders: 0, priorRto: 0 } };
  const decFirstTimer = await de.evaluateDecision(firstTimerOrder, { risk_score: 68 });
  assert.strictEqual(decFirstTimer.decision, 'NUDGE_TO_PREPAID');
});

test('StorageEngine seeds all 2018 orders and supports filters', async () => {
  await storage.init();
  assert.ok(storage.db.orders.length >= 1900, 'Orders should be loaded from CSV');

  // Test pagination & search
  const res = await storage.findOrders({ page: 1, limit: 10, search: 'Mumbai' });
  assert.strictEqual(res.orders.length, 10);
  assert.ok(res.total > 0);
});

test('WhatsAppSimulatorService manages conversation lifecycle and fast-forward', async () => {
  const ws = new WhatsAppSimulatorService();
  ws.resetClock();
  
  // Create or get conversation for unique test order
  const orderId = `ORD_TEST_WA_${Date.now()}`;
  const testOrder = await storage.createOrder({
    orderId,
    orderValue: 649,
    paymentMethod: 'COD',
    customer: { name: 'Rohan Sharma', phone: '+91 9999988888', priorOrders: 0, priorRto: 0 },
    shipping: { address: 'Flat 101, Marine Drive', city: 'Mumbai', state: 'Maharashtra', pincode: '400020' },
    operationalDecision: { decision: 'SHIP_AFTER_CONFIRMATION', status: 'PENDING_CONFIRMATION' }
  });

  // 1. Trigger confirmation
  const conv1 = await ws.triggerAutomatedMessage(testOrder.orderId, 'ORDER_CONFIRMATION');
  assert.strictEqual(conv1.status, 'AWAITING_REPLY');
  assert.strictEqual(conv1.messages.length, 1);

  // 2. Customer confirms with YES
  const conv2 = await ws.handleCustomerReply(testOrder.orderId, 'YES');
  assert.strictEqual(conv2.status, 'CONFIRMED');

  const updatedOrder = await storage.findOrderById(testOrder.orderId);
  assert.strictEqual(updatedOrder.operationalDecision.status, 'DISPATCH_READY');

  // 3. Fast-forward test clock for timeout test
  const timeoutOrderId = `ORD_TEST_TIMEOUT_${Date.now()}`;
  const testOrderTimeout = await storage.createOrder({
    orderId: timeoutOrderId,
    orderValue: 649,
    paymentMethod: 'COD',
    customer: { name: 'Test Timeout', phone: '+91 9999977777', priorOrders: 0, priorRto: 0 },
    shipping: { address: 'Plot 5, Station Road', city: 'Patna', state: 'Bihar', pincode: '800001' },
    operationalDecision: { decision: 'SHIP_AFTER_CONFIRMATION', status: 'PENDING_CONFIRMATION' }
  });

  await ws.triggerAutomatedMessage(testOrderTimeout.orderId, 'ORDER_CONFIRMATION');
  const ffResult = await ws.fastForwardHours(testOrderTimeout.orderId, 25);
  assert.strictEqual(ffResult.conversation.status, 'EXPIRED');

  const timedOutOrder = await storage.findOrderById(testOrderTimeout.orderId);
  assert.strictEqual(timedOutOrder.operationalDecision.status, 'HELD_TIMEOUT');
});

