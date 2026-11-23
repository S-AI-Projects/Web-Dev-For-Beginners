import unittest
from dataclasses import replace

from example import Assessment, SCENARIOS, offline_rubric_adapter, review_all, review_scenario


class OfflineAdapterTests(unittest.TestCase):
    def test_complete_fictional_scenarios_pass_with_local_adapter(self):
        results = review_all(SCENARIOS)
        self.assertEqual([item.status for item in results], ["PASS", "PASS", "PASS"])

    def test_missing_asset_fails(self):
        result = offline_rubric_adapter(replace(SCENARIOS[0], asset=""))
        self.assertEqual(result.status, "FAIL")
        self.assertEqual(result.findings, ("missing asset",))

    def test_unrelated_control_is_flagged_for_human_review(self):
        scenario = replace(
            SCENARIOS[0],
            control_category="text_only_rendering",
            control="render the value as text",
        )
        result = offline_rubric_adapter(scenario)
        self.assertEqual(result.status, "REVIEW")
        self.assertIn("does not match", result.findings[0])

    def test_callable_interface_receives_scenario_and_returns_adapter_result(self):
        calls = []

        def deterministic_test_adapter(scenario):
            calls.append(scenario.scenario_id)
            return Assessment(scenario.scenario_id, "PASS", ("test adapter",))

        result = review_scenario(SCENARIOS[0], deterministic_test_adapter)
        self.assertEqual(calls, [SCENARIOS[0].scenario_id])
        self.assertEqual(result, Assessment("balance-number", "PASS", ("test adapter",)))

    def test_local_adapter_is_repeatable(self):
        first = offline_rubric_adapter(SCENARIOS[1])
        second = offline_rubric_adapter(SCENARIOS[1])
        self.assertEqual(first, second)


if __name__ == "__main__":
    unittest.main()
