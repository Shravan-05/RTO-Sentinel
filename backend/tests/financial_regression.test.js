import test from 'node:test';
import assert from 'node:assert/strict';
import { FinancialEngine } from '../src/services/financialEngine.js';
import { DecisionEngine } from '../src/services/decisionEngine.js';

test('Financial Calculations & Break-even Regression', async (t) => {
  const engine = new FinancialEngine();

  await t.test('Unit economics constants match verified business parameters', () => {
    assert.equal(engine.expectedRtoCost, 169.40);
    assert.equal(engine.deliveredGrossProfit, 402.38);
  });

  await t.test('EV break-even probability is mathematically 70.37%', () => {
    const grossProfit = 402.38;
    const rtoCost = 169.40;
    const pBreakeven = grossProfit / (grossProfit + rtoCost);
    
    assert.ok(Math.abs(pBreakeven - 0.70373) < 0.0001);
    
    // EV at breakeven is 0
    const evZero = ((1 - pBreakeven) * grossProfit) - (pBreakeven * rtoCost);
    assert.ok(Math.abs(evZero) < 0.01);
  });

  await t.test('Simplified prepaid conversion benefit is approx ₹21.38', () => {
    const baseRto = 0.284348;
    const prepaidRto = 0.04;
    const discount = 20.0;
    const benefit = ((baseRto - prepaidRto) * engine.expectedRtoCost) - discount;
    
    assert.ok(Math.abs(benefit - 21.39) < 0.05);
  });

  await t.test('CAC is treated as sunk opportunity cost, not incremental cash penalty', () => {
    const order = { customer: { priorOrders: 0 }, orderValue: 649 };
    const econ = engine.calculateOrderEconomics(order, 0.25, 'SHIP_AS_IS');
    
    // For shipping, CAC is at risk as customer relationship asset, but not added to RTO logistics cost
    assert.equal(econ.cacAtRisk, 300);
    assert.equal(econ.expectedRtoCost, 169.40);
  });

  await t.test('DecisionEngine standardizes on 0-29, 30-54, 55-74, 75-100 tiers', async () => {
    const decisionEngine = new DecisionEngine();
    
    // Test order for repeat customer (no first-time override)
    const repeatOrder = {
      paymentMethod: 'COD',
      customer: { priorOrders: 2, priorRto: 0 },
      orderValue: 649
    };

    // Score 25 -> SHIP_AS_IS
    const resLow = await decisionEngine.evaluateDecision(repeatOrder, { risk_score: 25, address_validation: { quality_score: 90 } });
    assert.equal(resLow.decision, 'SHIP_AS_IS');

    // Score 40 -> SHIP_AFTER_CONFIRMATION
    const resMed = await decisionEngine.evaluateDecision(repeatOrder, { risk_score: 40, address_validation: { quality_score: 90 } });
    assert.equal(resMed.decision, 'SHIP_AFTER_CONFIRMATION');

    // Score 65 -> NUDGE_TO_PREPAID
    const resHigh = await decisionEngine.evaluateDecision(repeatOrder, { risk_score: 65, address_validation: { quality_score: 90 } });
    assert.equal(resHigh.decision, 'NUDGE_TO_PREPAID');

    // Score 85 -> HOLD_CANCEL
    const resCrit = await decisionEngine.evaluateDecision(repeatOrder, { risk_score: 85, address_validation: { quality_score: 90 } });
    assert.equal(resCrit.decision, 'HOLD_CANCEL');
  });
});

