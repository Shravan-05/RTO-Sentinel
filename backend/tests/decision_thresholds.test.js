import test from 'node:test';
import assert from 'node:assert';
import { DecisionEngine } from '../src/services/decisionEngine.js';
import { storage } from '../src/services/storage.js';

test('DecisionEngine maps risk scores into the 4 canonical operational tiers', async () => {
  await storage.init();
  const de = new DecisionEngine();

  // Low Tier (0 - 29) -> SHIP_AS_IS
  const lowOrder = { paymentMethod: 'COD', customer: { priorOrders: 2, priorRto: 0 } };
  const decLow = await de.evaluateDecision(lowOrder, { risk_score: 20 });
  assert.strictEqual(decLow.decision, 'SHIP_AS_IS');
  assert.strictEqual(decLow.status, 'DISPATCH_READY');

  // Medium Tier (30 - 54) -> SHIP_AFTER_CONFIRMATION
  const medOrder = { paymentMethod: 'COD', customer: { priorOrders: 2, priorRto: 0 } };
  const decMed = await de.evaluateDecision(medOrder, { risk_score: 45 });
  assert.strictEqual(decMed.decision, 'SHIP_AFTER_CONFIRMATION');
  assert.strictEqual(decMed.status, 'PENDING_CONFIRMATION');

  // High Tier (55 - 74) -> NUDGE_TO_PREPAID
  const highOrder = { paymentMethod: 'COD', customer: { priorOrders: 2, priorRto: 0 } };
  const decHigh = await de.evaluateDecision(highOrder, { risk_score: 65 });
  assert.strictEqual(decHigh.decision, 'NUDGE_TO_PREPAID');
  assert.strictEqual(decHigh.status, 'PENDING_CONFIRMATION');

  // Critical Tier (75 - 100) -> HOLD_CANCEL
  const critOrder = { paymentMethod: 'COD', customer: { priorOrders: 2, priorRto: 0 } };
  const decCrit = await de.evaluateDecision(critOrder, { risk_score: 85 });
  assert.ok(['HOLD_CANCEL', 'HOLD', 'CANCEL'].includes(decCrit.decision));
  assert.strictEqual(decCrit.status, 'HELD');
});

