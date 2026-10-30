import test from 'node:test';
import assert from 'node:assert';
import { FinancialEngine } from '../src/services/financialEngine.js';

test('FinancialEngine uses configurable prepaid assumptions without hardcoding', () => {
  // Baseline engine with default 25% prepaid conversion and ₹20 discount
  const defaultFe = new FinancialEngine();
  
  const sampleOrders = [
    {
      paymentMethod: 'COD',
      finalStatus: 'RTO',
      operationalDecision: { decision: 'NUDGE_TO_PREPAID' }
    },
    {
      paymentMethod: 'COD',
      finalStatus: 'DELIVERED',
      operationalDecision: { decision: 'NUDGE_TO_PREPAID' }
    }
  ];

  const defaultMetrics = defaultFe.computeAggregateMetrics(sampleOrders);
  // Default discount cost = 2 nudge orders * 0.25 conversion * ₹20 = ₹10
  assert.strictEqual(defaultMetrics.summary.totalInterventionCosts, 11); // 2 * 0.50 msg + 10 discount = 11

  // Engine with custom configuration: 50% conversion and ₹30 discount
  const customEcon = {
    ...defaultFe.econ,
    prepaidConversionRate: 0.50,
    prepaidDiscount: 30,
    whatsAppCostPerMsg: 1.00
  };
  const customFe = new FinancialEngine(customEcon);
  const customMetrics = customFe.computeAggregateMetrics(sampleOrders);
  
  // Custom discount cost = 2 * 0.50 * ₹30 = ₹30 + WhatsApp: 2 * 1.00 = 2 -> total 32
  assert.strictEqual(customMetrics.summary.totalInterventionCosts, 32);
  assert.notStrictEqual(defaultMetrics.summary.totalInterventionCosts, customMetrics.summary.totalInterventionCosts);
});

test('FinancialEngine correctly computes break-even threshold math', () => {
  const fe = new FinancialEngine();
  
  const grossMargin = fe.deliveredGrossProfit; // 402.38
  const rtoCost = fe.expectedRtoCost; // 169.40
  const breakEvenP = grossMargin / (grossMargin + rtoCost);
  
  assert.strictEqual(Math.round(breakEvenP * 10000) / 100, 70.37);
});

