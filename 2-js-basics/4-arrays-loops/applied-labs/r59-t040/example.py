"""
Security-Scenario Rubric Checker and Assessment
R59-T040: Applied Lab for 2-js-basics/4-arrays-loops.
"""

from typing import Any, Dict, List, Optional, Tuple

THREAT_CONTROL_DOMAINS: List[Tuple[List[str], List[str]]] = [
    (
        ["tamper", "injection", "modification", "pollution", "corrupt"],
        ["validate", "freeze", "schema", "sanitize", "immutable", "verify", "bounds"]
    ),
    (
        ["overflow", "overrun", "exhaustion", "loop", "dos"],
        ["limit", "bounds", "break", "timeout", "throttle", "condition"]
    ),
    (
        ["sql", "query", "database", "injection"],
        ["parameterize", "prepared", "orm", "escape"]
    )
]


def is_control_related_to_threat(threat: str, control: str) -> bool:
    """Checks whether the control vocabulary addresses the named threat."""
    t_lower = threat.lower()
    c_lower = control.lower()

    # Domain vocabulary matching
    for threat_cues, control_cues in THREAT_CONTROL_DOMAINS:
        if any(tc in t_lower for tc in threat_cues):
            return any(cc in c_lower for cc in control_cues)

    # Word intersection fallback
    stop_words = {"a", "an", "the", "in", "on", "of", "to", "for", "with", "by", "is", "and"}
    t_words = {w for w in t_lower.split() if w not in stop_words}
    c_words = {w for w in c_lower.split() if w not in stop_words}
    return len(t_words & c_words) > 0


def evaluate_scenario(scenario: Any) -> Dict[str, Any]:
    """
    Evaluates a scenario against the structural security rubric.
    Rules:
      - Complete scenario with related control -> status: 'pass'
      - Scenario missing 'asset' -> status: 'fail'
      - Scenario with control unrelated to threat -> status: 'flagged_for_review'
    """
    if not isinstance(scenario, dict):
        raise TypeError("Scenario must be a dictionary object")

    asset = scenario.get("asset")
    threat = scenario.get("threat")
    control = scenario.get("control")
    residual_risk = scenario.get("residual_risk")
    explanation = scenario.get("explanation")

    # Missing or blank asset fails
    if not asset or not str(asset).strip():
        return {
            "status": "fail",
            "error": "Missing required asset",
            "details": "Every security scenario must identify the specific asset being protected."
        }

    # Verify all remaining fields exist
    missing_fields = []
    for field_name, field_val in [
        ("threat", threat),
        ("control", control),
        ("residual_risk", residual_risk),
        ("explanation", explanation)
    ]:
        if not field_val or not str(field_val).strip():
            missing_fields.append(field_name)

    if missing_fields:
        return {
            "status": "fail",
            "error": f"Missing required fields: {', '.join(missing_fields)}"
        }

    # Evaluate threat-control alignment
    if not is_control_related_to_threat(str(threat), str(control)):
        return {
            "status": "flagged_for_review",
            "reason": "Control appears unrelated to named threat; human review required for explanation"
        }

    return {
        "status": "pass",
        "message": "Scenario satisfies structural rubric requirements"
    }


# Three reference fictional scenarios tied to 2-js-basics/4-arrays-loops
SCENARIO_1_COMPLETE = {
    "asset": "User session token array stored in browser memory",
    "threat": "Tampering with token array elements via prototype pollution or script injection",
    "control": "Validate each array element during iteration using Object.freeze and strict schema checks",
    "residual_risk": "Memory overhead for frozen array elements; does not prevent physical client memory dump",
    "explanation": "Freezing array buffers prevents unauthorized modification during loop traversals"
}

SCENARIO_2_MISSING_ASSET = {
    "asset": "",  # Missing asset
    "threat": "Buffer overrun through unbounded while loop",
    "control": "Enforce strict index bounds checking on each iteration",
    "residual_risk": "Potential off-by-one error on boundary conditions",
    "explanation": "Bounds checks prevent runaway loops"
}

SCENARIO_3_UNRELATED_CONTROL = {
    "asset": "Inventory price array",
    "threat": "SQL injection vulnerability via raw database query concatenation in loop",
    "control": "Compress array elements with gzip before rendering",  # Unrelated to SQL injection
    "residual_risk": "High risk of SQL injection remains unaddressed",
    "explanation": "Compression minimizes bandwidth usage but does not parameterize queries"
}


# Three applied questions and rationales
APPLIED_QUESTIONS = {
    "q1_predict_output": {
        "question": "What status is returned when evaluating Scenario 1 (complete scenario with token array asset and array validation control)?",
        "predicted_answer": "pass",
        "rationale": "Scenario 1 contains all required non-empty fields, and the control directly addresses array tampering."
    },
    "q2_diagnose_failure": {
        "question": "Why does Scenario 2 fail the structural rubric check?",
        "diagnosed_reason": "missing_asset",
        "rationale": "The asset field is blank, violating the mandatory structural requirement that every threat scenario must identify an underlying asset."
    },
    "q3_boundary_policy": {
        "question": "When an evaluation encounters an unknown threat domain not present in the keyword heuristic dictionary, what boundary policy should the automated rubric apply?",
        "policy": "flag_for_human_review",
        "rationale": "Automated heuristics should not falsely reject or approve unfamiliar threat domains; human review judges the explanation."
    }
}


def run_assessment():
    """Runs the 3 scenarios and prints evaluation outputs."""
    print("=== Scenario 1 (Complete) ===")
    print(evaluate_scenario(SCENARIO_1_COMPLETE))

    print("\n=== Scenario 2 (Missing Asset) ===")
    print(evaluate_scenario(SCENARIO_2_MISSING_ASSET))

    print("\n=== Scenario 3 (Unrelated Control) ===")
    print(evaluate_scenario(SCENARIO_3_UNRELATED_CONTROL))


if __name__ == '__main__':
    run_assessment()
