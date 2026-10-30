import test from 'node:test';
import assert from 'node:assert';
import { DecisionEngine } from '../src/services/decisionEngine.js';
import { storage } from '../src/services/storage.js';

test('First-time buyers are NEVER cancelled solely on high risk score', async () => {
  await storage.init();
  const de = new DecisionEngine();

  // Test 1: First-time buyer with high risk score (80/100)
  const highRiskFirstTimer = {
    paymentMethod: 'COD',
    orderValue: 899,
    customer: { priorOrders: 0, priorRto: 0 },
    shipping: { address: 'Flat 402, Sunshine Apts', city: 'Mumbai', state: 'Maharashtra', pincode: '400001' }
  };
  const decHigh = await de.evaluateDecision(highRiskFirstTimer, { risk_score: 80, address_validation: { quality_score: 85 } });
  
  // Must NOT be CANCEL or HOLD_CANCEL; must offer prepaid nudge to protect CAC ₹300
  assert.strictEqual(decHigh.decision, 'NUDGE_TO_PREPAID');
  assert.notStrictEqual(decHigh.status, 'CANCELLED');
  assert.ok(decHigh.appliedRules.includes('FIRST_TIME_PREPAID_NUDGE'));

  // Test 2: First-time buyer with medium risk score (45/100)
  const medRiskFirstTimer = {
    paymentMethod: 'COD',
    orderValue: 649,
    customer: { priorOrders: 0, priorRto: 0 },
    shipping: { address: 'Near Railway Station', city: 'Patna', state: 'Bihar', pincode: '800001' }
  };
  const decMed = await de.evaluateDecision(medRiskFirstTimer, { risk_score: 45, address_validation: { quality_score: 80 } });
  assert.strictEqual(decMed.decision, 'SHIP_AFTER_CONFIRMATION');

  // Test 3: First-time buyer with low address score (<40)
  const badAddrFirstTimer = {
    paymentMethod: 'COD',
    orderValue: 649,
    customer: { priorOrders: 0, priorRto: 0 },
    shipping: { address: 'xyz', city: 'Delhi', state: 'Delhi', pincode: '110001' }
  };
  const decBadAddr = await de.evaluateDecision(badAddrFirstTimer, { risk_score: 50, address_validation: { quality_score: 30 } });
  assert.strictEqual(decBadAddr.decision, 'SHIP_AFTER_CONFIRMATION');
});

test('Repeat RTO offenders (priorRto >= 2) trigger HOLD_CANCEL', async () => {
  await storage.init();
  const de = new DecisionEngine();

  const chronicBuyer = {
    paymentMethod: 'COD',
    orderValue: 1200,
    customer: { priorOrders: 3, priorRto: 2 },
    shipping: { address: 'Plot 10, Civil Lines', city: 'Lucknow', state: 'Uttar Pradesh', pincode: '226001' }
  };
  const decChronic = await de.evaluateDecision(chronicBuyer, { risk_score: 75 });
  assert.ok(['HOLD_CANCEL', 'CANCEL', 'HOLD'].includes(decChronic.decision));
  assert.ok(decChronic.appliedRules.includes('REPEAT_RTO_HOLD'));
});

