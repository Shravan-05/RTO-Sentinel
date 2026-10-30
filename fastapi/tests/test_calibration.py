import os
import unittest
import joblib
import json
import numpy as np
import pandas as pd
from sklearn.metrics import brier_score_loss

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARTIFACTS_DIR = os.path.join(BASE_DIR, "artifacts")
DATA_DIR = os.path.join(BASE_DIR, "data", "processed")

class TestModelCalibration(unittest.TestCase):
    def setUp(self):
        self.raw_model_path = os.path.join(ARTIFACTS_DIR, "model.joblib")
        self.cal_model_path = os.path.join(ARTIFACTS_DIR, "model_calibrated.joblib")
        self.metrics_path = os.path.join(ARTIFACTS_DIR, "metrics.json")
        self.test_data_path = os.path.join(DATA_DIR, "test_features.csv")
        
    def test_calibrated_artifact_exists_and_loads(self):
        """Verify that model_calibrated.joblib exists and loads cleanly."""
        self.assertTrue(os.path.exists(self.cal_model_path), "model_calibrated.joblib should exist in artifacts/")
        cal_model = joblib.load(self.cal_model_path)
        self.assertIsNotNone(cal_model)
        self.assertTrue(hasattr(cal_model, "predict_proba"), "Calibrated model must have predict_proba method")

    def test_calibration_improves_brier_score_and_bias(self):
        """Verify that Platt scaling improves Brier score and anchors mean probability near test base rate."""
        if not os.path.exists(self.test_data_path):
            self.skipTest("test_features.csv not found")

        test_df = pd.read_csv(self.test_data_path)
        y_test = test_df['target']
        actual_base_rate = float(y_test.mean())

        numeric_features = [
            'order_value', 'num_items', 'avg_item_price', 'customer_prior_orders',
            'customer_prior_rto', 'prior_rto_rate', 'address_length', 'address_word_count',
            'name_word_count', 'name_length', 'city_rto_risk', 'pin_rto_risk',
            'is_first_time', 'has_prior_rto', 'multiple_prior_rto', 'is_suspicious_name',
            'is_vague_address', 'has_landmark', 'is_high_value', 'is_low_value',
            'order_hour', 'order_dayofweek', 'is_night_order', 'is_weekend', 'missing_pincode'
        ]
        categorical_features = ['utm_source_clean', 'state_clean']
        X_test = test_df[numeric_features + categorical_features]

        raw_model = joblib.load(self.raw_model_path)
        cal_model = joblib.load(self.cal_model_path)

        raw_probs = raw_model.predict_proba(X_test)[:, 1]
        cal_probs = cal_model.predict_proba(X_test)[:, 1]

        raw_brier = brier_score_loss(y_test, raw_probs)
        cal_brier = brier_score_loss(y_test, cal_probs)

        # Calibrated model must have lower or equal Brier score
        self.assertLess(cal_brier, raw_brier, "Calibrated Brier score must be strictly lower than raw Brier score")
        
        # Mean calibrated probability should be much closer to true base rate (27.1%) than raw sigmoid (~44.7%)
        raw_bias = abs(float(raw_probs.mean()) - actual_base_rate)
        cal_bias = abs(float(cal_probs.mean()) - actual_base_rate)
        self.assertLess(cal_bias, raw_bias, "Calibrated model must reduce systematic probability over-prediction bias")
        self.assertLess(cal_bias, 0.05, "Calibrated mean probability should be within 5 percentage points of base rate")

    def test_metrics_json_documents_calibration(self):
        """Verify that artifacts/metrics.json records calibration methodology and metrics."""
        self.assertTrue(os.path.exists(self.metrics_path))
        with open(self.metrics_path, "r", encoding="utf-8") as f:
            metrics = json.load(f)
        self.assertIn("calibration_assessment", metrics)
        cal = metrics["calibration_assessment"]
        self.assertIn("CALIBRATED", cal.get("status", ""))
        self.assertIn("calibrated_brier_score", cal)
        self.assertIn("reliability_quantile_bins", cal)

if __name__ == "__main__":
    unittest.main()
