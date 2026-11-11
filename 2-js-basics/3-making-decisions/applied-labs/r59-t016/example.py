"""
Security Scenario Rubric Checker for JavaScript Basics: Making Decisions.

This module models security decision-making scenarios using conditional logic,
evaluating answers across asset, threat, control, and residual risk criteria.
"""

from typing import Dict, Any, Tuple


# Three fictional scenarios tied to decision-making logic
FICTIONAL_SCENARIOS = {
    "complete_valid": {
        "asset": "User Authentication Session Token",
        "threat": "Token theft via session hijacking / replay attack",
        "control": "Conditional check validating token expiration and IP binding before granting access",
        "residual_risk": "Token theft if the user device's storage is compromised directly",
    },
    "missing_asset": {
        "asset": "",  # Missing asset
        "threat": "Privilege escalation via query parameter manipulation",
        "control": "Strict if-else role-based access check on user permissions",
        "residual_risk": "Misconfigured role definitions in user store",
    },
    "unrelated_control": {
        "asset": "Customer Database Records",
        "threat": "SQL Injection in search query condition",
        "control": "Adding client-side image compression before uploading profile avatars",
        "residual_risk": "Database queries remain unparameterized",
    },
}


# ---------------------------------------------------------------------------
# Extracted Responsibility: Threat-Control Relevance Validator
# ---------------------------------------------------------------------------

def validate_control_relevance(threat: str, control: str) -> bool:
    """
    Extracted helper verifying whether the stated control addresses the threat.
    Uses common keyword domains between threat and control descriptions.
    """
    threat_lower = threat.lower()
    control_lower = control.lower()

    # Keyword mappings between threats and controls
    domain_keywords = [
        ("token", ["token", "session", "jwt", "expiration"]),
        ("session", ["session", "token", "cookie", "timeout"]),
        ("privilege", ["role", "permission", "authorization", "access"]),
        ("escalation", ["role", "permission", "authorization", "check"]),
        ("injection", ["parameter", "sanitize", "escape", "prepared", "sql", "statement"]),
        ("sql", ["sql", "parameter", "query", "sanitize", "prepared"]),
        ("xss", ["escape", "encode", "csp", "sanitize", "innertext"]),
    ]

    for key, related_terms in domain_keywords:
        if key in threat_lower:
            if any(term in control_lower for term in related_terms):
                return True
            return False

    # Default fallback: check direct word overlap
    threat_words = set(threat_lower.split())
    control_words = set(control_lower.split())
    overlap = threat_words.intersection(control_words)
    return len(overlap) > 0


# ---------------------------------------------------------------------------
# Rubric Evaluator
# ---------------------------------------------------------------------------

def evaluate_scenario(scenario: Dict[str, Any]) -> Dict[str, str]:
    """
    Evaluates a security scenario against the structural rubric.

    Returns:
        Dict with 'status': 'PASS' | 'FAIL' | 'REVIEW', and descriptive 'reason'.
    """
    # 1. Structural completeness checks
    required_fields = ["asset", "threat", "control", "residual_risk"]
    for field in required_fields:
        val = scenario.get(field)
        if not val or not str(val).strip():
            return {
                "status": "FAIL",
                "reason": f"Missing or empty required field: {field}",
            }

    # 2. Control-threat relevance check (using extracted helper)
    threat = str(scenario.get("threat", ""))
    control = str(scenario.get("control", ""))
    is_relevant = validate_control_relevance(threat, control)

    if not is_relevant:
        return {
            "status": "REVIEW",
            "reason": "Control appears unrelated to the named threat; requires instructor review",
        }

    return {
        "status": "PASS",
        "reason": "Scenario is complete and structurally consistent",
    }


# Baseline implementation retained for equivalence testing
def evaluate_scenario_baseline(scenario: Dict[str, Any]) -> Dict[str, str]:
    """Monolithic baseline implementation before responsibility extraction."""
    for f in ["asset", "threat", "control", "residual_risk"]:
        if not scenario.get(f) or not str(scenario.get(f)).strip():
            return {"status": "FAIL", "reason": f"Missing or empty required field: {f}"}

    threat = str(scenario.get("threat", "")).lower()
    control = str(scenario.get("control", "")).lower()

    if "injection" in threat and not any(k in control for k in ["parameter", "sql", "sanitize", "escape"]):
        return {"status": "REVIEW", "reason": "Control appears unrelated to the named threat; requires instructor review"}
    if "token" in threat and not any(k in control for k in ["token", "session"]):
        return {"status": "REVIEW", "reason": "Control appears unrelated to the named threat; requires instructor review"}

    return {"status": "PASS", "reason": "Scenario is complete and structurally consistent"}
