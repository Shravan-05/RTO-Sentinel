import os
import unittest
import pandas as pd
from app.ml.preprocessing.pipeline import clean_data

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(BASE_DIR, "data", "raw", "orders_sample.csv")

class TestBacktestReconciliation(unittest.TestCase):
    def setUp(self):
        if not os.path.exists(DATA_PATH):
            self.skipTest("orders_sample.csv not found")
        raw_df = pd.read_csv(DATA_PATH)
        self.clean_df = clean_data(raw_df, drop_in_transit=True)

    def test_total_order_accounting(self):
        """Verify that all 1,987 clean historical orders are accounted for without silent drops."""
        self.assertEqual(len(self.clean_df), 1987)
        delivered_count = int((self.clean_df['target'] == 0).sum())
        rto_count = int((self.clean_df['target'] == 1).sum())
        self.assertEqual(delivered_count, 1422)
        self.assertEqual(rto_count, 565)
        self.assertEqual(delivered_count + rto_count, 1987)

    def test_baseline_financial_reconciliation(self):
        """
        Baseline Net Contribution:
        Delivered Margin: 1,422 * (649 * 0.62) = 1,422 * 402.38 = ₹5,72,184.36
        RTO Courier Cost: 565 * 169.40 = ₹95,711.00
        Baseline Net: 5,72,184.36 - 95,711.00 = ₹4,76,473.36
        """
        delivered = 1422
        rto = 565
        gross_profit_per_delivered = 649.0 * 0.62  # 402.38
        rto_cost = 65.0 + 65.0 + 25.0 + (0.08 * 180.0)  # 169.40
        
        delivered_margin = delivered * gross_profit_per_delivered
        rto_logistics = rto * rto_cost
        baseline_net = delivered_margin - rto_logistics
        
        self.assertAlmostEqual(delivered_margin, 572184.36, places=2)
        self.assertAlmostEqual(rto_logistics, 95711.00, places=2)
        self.assertAlmostEqual(baseline_net, 476473.36, places=2)

    def test_break_even_precision_threshold(self):
        """
        Verify the mathematical break-even threshold for holding/cancelling an order:
        p_break_even = GrossMargin / (GrossMargin + RTO_Cost)
                     = 402.38 / (402.38 + 169.40)
                     = 402.38 / 571.78
                     = 70.37%
        """
        gross_margin = 649.0 * 0.62
        rto_cost = 169.40
        break_even_p = gross_margin / (gross_margin + rto_cost)
        self.assertAlmostEqual(break_even_p, 0.70373, places=4)

if __name__ == "__main__":
    unittest.main()
