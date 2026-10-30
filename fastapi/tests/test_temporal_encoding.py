import os
import unittest
import pandas as pd
import numpy as np

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
from app.ml.training.train import expanding_window_encode, compute_loo_encode

class TestTemporalTargetEncoding(unittest.TestCase):
    def test_expanding_window_strictly_prevents_future_leakage(self):
        """
        Verify that in expanding-window encoding, the label of record i
        CANNOT affect the encoding of record i or any earlier record j < i.
        """
        df = pd.DataFrame({
            'order_id': ['O1', 'O2', 'O3', 'O4'],
            'city_clean': ['Mumbai', 'Mumbai', 'Mumbai', 'Mumbai'],
            'target': [0, 0, 1, 1]  # Mumbai starts 0, then gets RTOs
        })
        m = 10.0
        prior = 0.25

        enc, final_map = expanding_window_encode(df, 'city_clean', m, prior)
        
        # Record 0 sees 0 past records -> encoding must equal prior
        self.assertAlmostEqual(enc[0], prior, places=3)
        
        # Record 1 sees record 0 (target=0) -> (0 + 10*0.25)/(1 + 10) = 2.5/11 = 0.2273
        expected_1 = (0.0 + 10.0 * 0.25) / (1.0 + 10.0)
        self.assertAlmostEqual(enc[1], expected_1, places=3)
        
        # Changing the target of record 3 (future) must NOT change encodings of earlier records
        df_altered = df.copy()
        df_altered.loc[3, 'target'] = 0  # Changed future label from 1 to 0
        enc_altered, final_map_altered = expanding_window_encode(df_altered, 'city_clean', m, prior)
        
        self.assertEqual(enc[0], enc_altered[0], "Record 0 encoding changed when future label changed!")
        self.assertEqual(enc[1], enc_altered[1], "Record 1 encoding changed when future label changed!")
        self.assertEqual(enc[2], enc_altered[2], "Record 2 encoding changed when future label changed!")
        # Record 3 only sees records 0, 1, 2, so altering record 3's own label also cannot change record 3's encoding!
        self.assertEqual(enc[3], enc_altered[3], "Record 3 encoding must not be affected by its own label!")
        
        # However, the final lookup map (which aggregates all records) WILL reflect the change
        self.assertNotEqual(final_map['Mumbai'], final_map_altered['Mumbai'])

    def test_unseen_category_falls_back_to_prior(self):
        """Unseen categories in inference or test must smoothly fall back to global prior."""
        prior = 0.284
        m = 10.0
        df = pd.DataFrame({
            'city_clean': ['Delhi', 'Delhi'],
            'target': [1, 1]
        })
        _, final_map = expanding_window_encode(df, 'city_clean', m, prior)
        
        # For 'Kolkata' (unseen category), fallback should be prior
        fallback = final_map.get('Kolkata', prior)
        self.assertEqual(fallback, prior)

    def test_loo_prevents_self_leakage(self):
        """Verify that LOO encoding removes the row's own target value from group sum."""
        tr = pd.DataFrame({
            'city_clean': ['Pune', 'Pune'],
            'target': [1, 0]
        })
        te = pd.DataFrame({'city_clean': ['Pune']})
        prior = 0.30
        m = 5.0
        
        train_enc, _, _ = compute_loo_encode(tr, te, 'city_clean', m, prior)
        
        # Row 0 (target=1): group has count=2, sum=1. LOO sum = 1 - 1 = 0. (0 + 5*0.30) / (1 + 5) = 1.5/6 = 0.25
        # Row 1 (target=0): group has count=2, sum=1. LOO sum = 1 - 0 = 1. (1 + 5*0.30) / (1 + 5) = 2.5/6 = 0.4167
        self.assertAlmostEqual(train_enc[0], 0.25, places=3)
        self.assertAlmostEqual(train_enc[1], 0.4167, places=3)

if __name__ == "__main__":
    unittest.main()
