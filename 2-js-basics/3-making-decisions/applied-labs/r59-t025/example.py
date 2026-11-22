"""R59-T025: Decision-making security scenario rubric checker.

This module illustrates computational decision-making concepts from
"JavaScript Basics: Making Decisions" using Python 3.9+ standard library.
It evaluates security scenario representations (asset, threat, control,
residual risk, and human explanation) against a structural rubric.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Tuple


# Predefined domain vocabulary mapping threat concepts to relevant control keywords.
# This deterministic heuristic inspects whether a control addresses its named threat.
THREAT_CONTROL_DOMAINS: List[Tuple[List[str], List[str]]] = [
    (
        ["token", "tamper", "privilege", "escalation", "spoof", "signature", "session", "auth"],
        ["token", "signature", "cryptographic", "server-side", "role", "validate", "verify", "session", "auth"]
    ),
    (
        ["brute", "guess", "credential", "stuffing", "password", "login"],
        ["rate", "limit", "lockout", "delay", "throttle", "attempt", "exponential", "mfa"]
    ),
    (
        ["xss", "cross-site", "script", "injection", "dom", "sanitize"],
        ["sanitize", "encode", "csp", "content-security-policy", "escape", "http-only", "input validation"]
    ),
    (
        ["database", "backup", "rest", "storage", "disk"],
        ["encrypt", "aes", "backup", "kms", "at-rest", "volume"]
    ),
]


def is_control_related_to_threat(threat: str, control: str) -> bool:
    """Check if the control contains concepts addressing the named threat.

    Args:
        threat: Description of the security threat.
        control: Description of the security control.

    Returns:
        True if the control matches the threat's domain or shares key vocabulary,
        False if the control appears completely unrelated.
    """
    threat_lower = threat.lower()
    control_lower = control.lower()

    # Check direct word overlap between threat and control (ignoring stop words)
    stop_words = {"a", "an", "the", "in", "on", "of", "to", "for", "and", "or", "is", "at", "by"}
    threat_words = {w.strip(".,/()[]-") for w in threat_lower.split() if w.strip(".,/()[]-") not in stop_words}
    control_words = {w.strip(".,/()[]-") for w in control_lower.split() if w.strip(".,/()[]-") not in stop_words}

    if len(threat_words & control_words) >= 1:
        return True

    # Check domain association
    for threat_cues, control_cues in THREAT_CONTROL_DOMAINS:
        matches_threat = any(cue in threat_lower for cue in threat_cues)
        if matches_threat:
            matches_control = any(cue in control_lower for cue in control_cues)
            if matches_control:
                return True
            # Threat matched a specific domain, but control matched none of its cues
            return False

    # Default to True if domain is unclassified so unexpected threats aren't falsely rejected
    return True


def evaluate_scenario(scenario: Any) -> Dict[str, Any]:
    """Evaluate a scenario dictionary against the structural rubric.

    Rubric rules:
    1. Input must be a dictionary.
    2. Required fields must exist and be non-empty strings:
       - asset: if missing or blank -> status: "fail", error recorded.
       - threat: must be present and non-empty.
       - control: must be present and non-empty.
       - residual_risk: must be present and non-empty.
       - explanation: must be present and non-empty.
    3. Threat-control alignment:
       - Control must be relevant to the named threat.
       - If unrelated -> status: "flagged_for_review", flag recorded.
    4. Explanations are judged by human reviewers; the checker validates
       structure and presence.

    Returns:
        Structured evaluation result dictionary:
        {
            "scenario_id": str,
            "status": "pass" | "fail" | "flagged_for_review",
            "errors": List[str],
            "flags": List[str],
            "requires_human_review": bool
        }
    """
    if not isinstance(scenario, dict):
        raise TypeError(f"Expected scenario to be a dict, got {type(scenario).__name__}")

    scenario_id = str(scenario.get("scenario_id", "UNKNOWN"))
    errors: List[str] = []
    flags: List[str] = []

    required_fields = ["asset", "threat", "control", "residual_risk", "explanation"]
    for field in required_fields:
        val = scenario.get(field)
        if val is None or not isinstance(val, str) or not val.strip():
            if field == "asset":
                errors.append("Missing required asset field")
            else:
                errors.append(f"Missing required {field} field")

    # If missing required fields, fail immediately
    if errors:
        return {
            "scenario_id": scenario_id,
            "status": "fail",
            "errors": errors,
            "flags": flags,
            "requires_human_review": False
        }

    # Verify control relevance to threat
    threat = scenario["threat"]
    control = scenario["control"]
    if not is_control_related_to_threat(threat, control):
        flags.append("Control is unrelated to named threat (requires human review)")
        return {
            "scenario_id": scenario_id,
            "status": "flagged_for_review",
            "errors": [],
            "flags": flags,
            "requires_human_review": True
        }

    return {
        "scenario_id": scenario_id,
        "status": "pass",
        "errors": [],
        "flags": [],
        "requires_human_review": False
    }


# Reference Scenarios
SCENARIO_1_COMPLETE = {
    "scenario_id": "SCN-001",
    "asset": "Session authentication token",
    "threat": "Token tampering / privilege escalation in client-side decision logic",
    "control": "Cryptographic signature validation and server-side role check before granting admin access",
    "residual_risk": "Replay attack if token lacks expiration or nonce",
    "explanation": "Evaluates role === 'admin' only on verified signed tokens to prevent unauthorized branching."
}

SCENARIO_2_MISSING_ASSET = {
    "scenario_id": "SCN-002",
    "asset": "",
    "threat": "Brute-force credential guessing on login decision branch",
    "control": "Exponential rate limiting and lockout after 5 failed attempts",
    "residual_risk": "Distributed IP credential stuffing",
    "explanation": "Protects login decision branch from automated credential stuffing."
}

SCENARIO_3_UNRELATED_CONTROL = {
    "scenario_id": "SCN-003",
    "asset": "User profile data in browser localStorage",
    "threat": "Cross-site scripting (XSS) injecting malicious script into DOM decision paths",
    "control": "Encrypt database backups at rest using AES-256",
    "residual_risk": "Backups stolen from cloud storage bucket",
    "explanation": "Encrypts database backups, but database at-rest encryption does not mitigate DOM XSS in client storage."
}

REFERENCE_SCENARIOS = [
    SCENARIO_1_COMPLETE,
    SCENARIO_2_MISSING_ASSET,
    SCENARIO_3_UNRELATED_CONTROL,
]


def run_demo() -> str:
    """Execute evaluation on all three reference scenarios and format output."""
    results = [evaluate_scenario(scn) for scn in REFERENCE_SCENARIOS]
    output = json.dumps(results, indent=2)
    return output


if __name__ == "__main__":
    print(run_demo())
