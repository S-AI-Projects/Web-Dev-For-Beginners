import unittest
from dataclasses import replace

from example import SCENARIOS, evaluate_scenario, trace_matches_output


class ScenarioRubricTests(unittest.TestCase):
    def test_complete_scenarios_pass_and_trace_every_field(self):
        for scenario in SCENARIOS:
            with self.subTest(scenario=scenario.scenario_id):
                result = evaluate_scenario(scenario)
                self.assertEqual(result["final_output"]["status"], "PASS")
                self.assertEqual(
                    [item["step"] for item in result["trace"]],
                    [
                        "record_asset",
                        "record_threat",
                        "record_control",
                        "record_residual_risk",
                    ],
                )
                self.assertTrue(trace_matches_output(result))

    def test_missing_asset_fails(self):
        result = evaluate_scenario(replace(SCENARIOS[0], asset=""))
        self.assertEqual(result["final_output"]["status"], "FAIL")
        self.assertIn("missing asset", [item["message"] for item in result["final_output"]["findings"]])

    def test_control_for_an_unrelated_threat_is_flagged_for_review(self):
        scenario = replace(
            SCENARIOS[0],
            control_category="text_only_rendering",
            control="display the value as text",
        )
        result = evaluate_scenario(scenario)
        self.assertEqual(result["final_output"]["status"], "REVIEW")
        self.assertEqual(result["final_output"]["findings"][0]["severity"], "review")

    def test_final_output_cannot_diverge_from_last_intermediate_state(self):
        result = evaluate_scenario(SCENARIOS[1])
        self.assertTrue(trace_matches_output(result))
        result["final_output"]["recorded_fields"]["threat"] = "different final threat"
        self.assertFalse(trace_matches_output(result))


if __name__ == "__main__":
    unittest.main()
