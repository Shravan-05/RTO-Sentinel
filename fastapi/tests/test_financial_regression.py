import unittest
import numpy as np

class TestFinancialAndRiskRegression(unittest.TestCase):
    def setUp(self):
        self.aov = 649.0
        self.margin_pct = 0.62
        self.forward_shipping = 65.0
        self.return_shipping = 65.0
        self.packaging = 25.0
        self.damage_prob = 0.08
        self.product_cost = 180.0
        self.prepaid_discount = 20.0
        self.base_cod_rto_rate = 0.284348
        self.prepaid_rto_rate = 0.04

    def test_unit_economics_exactness(self):
        # 1. Expected RTO cost
        expected_rto_cost = (
            self.forward_shipping +
            self.return_shipping +
            self.packaging +
            (self.damage_prob * self.product_cost)
        )
        self.assertAlmostEqual(expected_rto_cost, 169.40, places=2)

        # 2. Delivered gross margin contribution
        delivered_margin = self.aov * self.margin_pct
        self.assertAlmostEqual(delivered_margin, 402.38, places=2)

        # 3. Simplified prepaid net economic benefit
        prepaid_benefit = (self.base_cod_rto_rate - self.prepaid_rto_rate) * expected_rto_cost - self.prepaid_discount
        self.assertAlmostEqual(prepaid_benefit, 21.39, places=1)

    def test_mathematical_breakeven_probability(self):
        # EV(ship) = (1 - p)*402.38 - p*169.40 = 0
        # p = 402.38 / (402.38 + 169.40)
        delivered_margin = 402.38
        rto_cost = 169.40
        p_breakeven = delivered_margin / (delivered_margin + rto_cost)
        
        # Verify it is approximately 70.37% (NOT 60%)
        self.assertAlmostEqual(p_breakeven, 0.70373, places=4)
        
        # Verify EV at breakeven is exactly 0
        ev_at_breakeven = (1.0 - p_breakeven) * delivered_margin - (p_breakeven * rto_cost)
        self.assertAlmostEqual(ev_at_breakeven, 0.0, places=5)
        
        # Verify EV at 60% is strictly positive (+₹59.33)
        ev_at_60 = (1.0 - 0.60) * delivered_margin - (0.60 * rto_cost)
        self.assertGreater(ev_at_60, 50.0)

    def test_f1_score_mathematical_formula(self):
        # Precision = 0.44747, Recall = 0.61497
        precision = 115 / (115 + 142)  # 0.4474708
        recall = 115 / (115 + 72)      # 0.6149732
        
        f1_calculated = 2 * (precision * recall) / (precision + recall)
        self.assertAlmostEqual(f1_calculated, 0.5180, places=4)
        
        # Verify 0.529 was mathematically impossible for this P and R
        self.assertNotAlmostEqual(f1_calculated, 0.529, places=2)

    def test_standardized_risk_score_scale(self):
        # Standardized scale:
        # 0 - 29: LOW -> SHIP_AS_IS
        # 30 - 54: MEDIUM -> SHIP_AFTER_CONFIRMATION
        # 55 - 74: HIGH -> NUDGE_TO_PREPAID
        # 75 - 100: CRITICAL -> HOLD_CANCEL
        
        def map_tier(score):
            if score <= 29:
                return "LOW"
            elif score <= 54:
                return "MEDIUM"
            elif score <= 74:
                return "HIGH"
            else:
                return "CRITICAL"
                
        self.assertEqual(map_tier(0), "LOW")
        self.assertEqual(map_tier(29), "LOW")
        self.assertEqual(map_tier(30), "MEDIUM")
        self.assertEqual(map_tier(54), "MEDIUM")
        self.assertEqual(map_tier(55), "HIGH")
        self.assertEqual(map_tier(74), "HIGH")
        self.assertEqual(map_tier(75), "CRITICAL")
        self.assertEqual(map_tier(100), "CRITICAL")

if __name__ == '__main__':
    unittest.main()

