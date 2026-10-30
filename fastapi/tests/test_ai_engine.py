import unittest
import sys
from pathlib import Path

# Add app to path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from app.schemas.order import OrderInput
from app.services.prediction_service import prediction_service
from app.llm.gemini_validator import rule_based_address_evaluation

class TestAIEngine(unittest.TestCase):
    def test_rule_based_address_valid(self):
        res = rule_based_address_evaluation(
            address="Flat 204, Rosewood Heights, Near City Mall, MG Road",
            city="Bengaluru",
            state="Karnataka",
            pincode="560001",
            customer_name="Aditya Verma"
        )
        self.assertTrue(res.is_valid)
        self.assertGreaterEqual(res.quality_score, 80)
        self.assertEqual(res.category, "COMPLETE")

    def test_rule_based_address_vague(self):
        res = rule_based_address_evaluation(
            address="home near shop",
            city="Bareilly",
            state="Uttar Pradesh",
            pincode="243001",
            customer_name="test"
        )
        self.assertLess(res.quality_score, 60)
        self.assertGreaterEqual(len(res.issues), 1)

    def test_rule_based_address_gibberish(self):
        res = rule_based_address_evaluation(
            address=".......",
            city="Patna",
            state="Bihar",
            pincode="800001",
            customer_name="asdf"
        )
        self.assertFalse(res.is_valid)
        self.assertEqual(res.category, "GIBBERISH")

    def test_prediction_low_risk_order(self):
        order = OrderInput(
            order_id="TEST_LOW",
            order_value=649.0,
            payment_method="COD",
            shipping_address="B-12, Sector 14, Near Metro Station, Rohini",
            shipping_city="Delhi",
            shipping_state="Delhi",
            shipping_pincode="110085",
            customer_name="Rahul Gupta",
            customer_prior_orders=3,
            customer_prior_rto=0
        )
        res = prediction_service.predict_single(order)
        self.assertIn(res.decision, ["SHIP_AS_IS", "SHIP_AFTER_CONFIRMATION"])
        self.assertLess(res.risk_score, 40)
        self.assertGreater(res.financial_impact.net_expected_payoff_ship, 0)

    def test_prediction_prepaid_override(self):
        order = OrderInput(
            order_id="TEST_PREPAID",
            order_value=999.0,
            payment_method="PREPAID",
            shipping_address="C-104, Green Valley Apartments",
            shipping_city="Pune",
            shipping_state="Maharashtra",
            shipping_pincode="411001",
            customer_name="Sunita Rao",
            customer_prior_orders=0,
            customer_prior_rto=0
        )
        res = prediction_service.predict_single(order)
        self.assertEqual(res.decision, "SHIP_AS_IS")
        self.assertIn("PREPAID_AUTO_CLEARANCE", res.rule_overrides_applied)

    def test_prediction_repeat_rto_offender(self):
        order = OrderInput(
            order_id="TEST_REPEAT_OFFENDER",
            order_value=1499.0,
            payment_method="COD",
            shipping_address="House 45, Near Bridge",
            shipping_city="Gorakhpur",
            shipping_state="Uttar Pradesh",
            shipping_pincode="273001",
            customer_name="Amit Kumar",
            customer_prior_orders=2,
            customer_prior_rto=2
        )
        res = prediction_service.predict_single(order)
        self.assertEqual(res.decision, "HOLD_CANCEL")
        self.assertEqual(res.risk_tier, "CRITICAL")
        self.assertGreaterEqual(res.risk_score, 75)

    def test_first_time_customer_protected_from_instant_cancellation(self):
        order = OrderInput(
            order_id="TEST_FIRST_TIMER",
            order_value=799.0,
            payment_method="COD",
            shipping_address="Ward 5, Main Bazaar",
            shipping_city="Sagar",
            shipping_state="Madhya Pradesh",
            shipping_pincode="470001",
            customer_name="Pooja Jain",
            customer_prior_orders=0,
            customer_prior_rto=0
        )
        res = prediction_service.predict_single(order)
        # First timer should not be cancelled unless address is gibberish
        self.assertIn(res.decision, ["SHIP_AS_IS", "SHIP_AFTER_CONFIRMATION", "NUDGE_TO_PREPAID"])

if __name__ == "__main__":
    unittest.main()
