"""A local, fictional data-type security rubric for the JavaScript lesson."""

from __future__ import annotations

from dataclasses import dataclass
import json
from typing import Any


REQUIRED_FIELDS = ("asset", "threat", "control", "residual_risk")
COMPATIBLE_CONTROLS = {
    "numeric_coercion": "numeric_validation",
    "unsafe_string_rendering": "text_only_rendering",
    "truthy_string_boolean": "strict_boolean_parsing",
}


@dataclass(frozen=True)
class Scenario:
    scenario_id: str
    lesson_concept: str
    asset: str
    threat_category: str
    threat: str
    control_category: str
    control: str
    residual_risk: str


def evaluate_scenario(scenario: Scenario) -> dict[str, Any]:
    """Check required fields and the declared threat/control category pair.

    This structural check cannot judge whether a human-written explanation is
    technically sound. The category pair only indicates what a reviewer should
    compare in the scenario text.
    """
    trace: list[dict[str, Any]] = []
    state: dict[str, str] = {"scenario_id": scenario.scenario_id}
    for field in REQUIRED_FIELDS:
        state[field] = getattr(scenario, field)
        trace.append({"step": f"record_{field}", "state": dict(state)})

    missing = [field for field in REQUIRED_FIELDS if not state[field].strip()]
    findings: list[dict[str, str]] = []
    if missing:
        findings.extend(
            {"severity": "error", "message": f"missing {field}"}
            for field in missing
        )

    expected_control = COMPATIBLE_CONTROLS.get(scenario.threat_category)
    if not missing and expected_control != scenario.control_category:
        findings.append({
            "severity": "review",
            "message": "declared control category does not match the threat category",
        })

    status = "FAIL" if missing else "REVIEW" if findings else "PASS"
    final_output = {
        "scenario_id": state["scenario_id"],
        "status": status,
        "recorded_fields": {field: state[field] for field in REQUIRED_FIELDS},
        "findings": findings,
    }
    return {"trace": trace, "final_output": final_output}


def trace_matches_output(result: dict[str, Any]) -> bool:
    """Verify that the final result describes the last recorded state."""
    if not result["trace"]:
        return False
    last_state = result["trace"][-1]["state"]
    output = result["final_output"]
    return (
        output["scenario_id"] == last_state["scenario_id"]
        and output["recorded_fields"]
        == {field: last_state[field] for field in REQUIRED_FIELDS}
    )


SCENARIOS = (
    Scenario(
        scenario_id="balance-number",
        lesson_concept="numbers",
        asset="a balance received as a JavaScript number",
        threat_category="numeric_coercion",
        threat="a numeric string is concatenated instead of added",
        control_category="numeric_validation",
        control="convert input to a finite number before arithmetic",
        residual_risk="floating-point rounding may still affect decimal currency",
    ),
    Scenario(
        scenario_id="profile-string",
        lesson_concept="strings",
        asset="a profile name stored as a JavaScript string",
        threat_category="unsafe_string_rendering",
        threat="untrusted text is interpreted as HTML when displayed",
        control_category="text_only_rendering",
        control="render the value as text and enforce an appropriate length",
        residual_risk="look-alike Unicode characters can still confuse readers",
    ),
    Scenario(
        scenario_id="consent-boolean",
        lesson_concept="booleans",
        asset="a consent choice represented as a JavaScript boolean",
        threat_category="truthy_string_boolean",
        threat="the string false is truthy and accidentally enables a feature",
        control_category="strict_boolean_parsing",
        control="accept only an explicit boolean and default to false",
        residual_risk="a valid true value does not prove the user understood the choice",
    ),
)


def main() -> None:
    print(json.dumps([evaluate_scenario(item) for item in SCENARIOS], indent=2))


if __name__ == "__main__":
    main()
