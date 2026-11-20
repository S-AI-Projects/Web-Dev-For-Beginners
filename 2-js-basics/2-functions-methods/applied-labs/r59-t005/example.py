"""
Security Scenario Rubric Checker with Offline Service Adapter
Applied Lab: R59-T005
Curriculum: 2-js-basics/2-functions-methods
Student: Vedika Yadav (URN: e26b07f0785)

This module implements a rubric evaluator for security scenarios tied to JavaScript functions
and methods. It puts external threat-evaluation dependencies behind a callable interface
and provides a deterministic local offline adapter.
"""

from typing import Dict, Any, Optional
from abc import ABC, abstractmethod


class SecurityRelevanceService(ABC):
    """Abstract interface representing an external threat/control evaluation service."""
    @abstractmethod
    def evaluate_relevance(self, threat: str, control: str) -> Dict[str, Any]:
        """Evaluates whether the control mitigates the specified threat."""
        pass


class DeterministicLocalAdapter(SecurityRelevanceService):
    """
    Offline local adapter providing deterministic evaluation.
    Replaces remote cloud or model services with bounded token correlation.
    """
    def evaluate_relevance(self, threat: str, control: str) -> Dict[str, Any]:
        t_lower = threat.lower()
        c_lower = control.lower()

        # Semantic relevance domain matching:
        # 1. Parameter / Input validation domain
        if any(w in t_lower for w in ["parameter", "type", "nan", "argument", "injection"]):
            if any(w in c_lower for w in ["validation", "type-checking", "guard", "default parameter", "sanitize"]):
                return {"relevant": True, "confidence": 1.0}

        # 2. Call-stack / recursion domain
        if any(w in t_lower for w in ["recursion", "stack", "overflow"]):
            if any(w in c_lower for w in ["base-case", "depth", "bounds", "iteration"]):
                return {"relevant": True, "confidence": 1.0}

        # 3. Output encoding / return value XSS domain
        if any(w in t_lower for w in ["script", "xss", "return value", "sanitization"]):
            if any(w in c_lower for w in ["encode", "escape", "sanitize", "textcontent"]):
                return {"relevant": True, "confidence": 1.0}

        # If control has unrelated concepts (e.g. arrow function syntax, visual styling)
        return {"relevant": False, "confidence": 0.0, "reason": "Control concepts do not mitigate named threat"}


# Three educational fictional scenarios tied to JavaScript Functions & Methods
FICTIONAL_SCENARIOS = {
    "complete_valid": {
        "asset": "Function calculation parameters for user transactions",
        "threat": "Type confusion and NaN injection via unchecked string parameters",
        "control": "Explicit type-checking and default parameter functions validating inputs",
        "residual_risk": "Floating-point precision edge cases on extremely large values"
    },
    "missing_asset": {
        "asset": "",
        "threat": "Uncontrolled recursion causing call-stack overflow",
        "control": "Base-case recursion bounds checking function",
        "residual_risk": "Memory consumption under extreme concurrent invocations"
    },
    "unrelated_control": {
        "asset": "Return value of user-greeting function",
        "threat": "Cross-site script injection via unsanitized return values",
        "control": "Refactoring function declaration to arrow function syntax",
        "residual_risk": "XSS vulnerabilities remain entirely unaddressed"
    }
}


def evaluate_scenario(
    scenario: Dict[str, Any],
    adapter: Optional[SecurityRelevanceService] = None
) -> Dict[str, Any]:
    """
    Evaluates a security scenario based on structural completeness and threat-control consistency.

    Contract:
    - Verifies presence of 'asset', 'threat', 'control', and 'residual_risk'.
    - If asset is missing or empty, returns status: 'FAIL'.
    - Evaluates relevance via the service adapter. If control is unrelated, returns status: 'REVIEW'.
    - If complete and internally consistent, returns status: 'PASS'.
    """
    if adapter is None:
        adapter = DeterministicLocalAdapter()

    required_fields = ["asset", "threat", "control", "residual_risk"]
    for field in required_fields:
        val = scenario.get(field)
        if not val or not str(val).strip():
            return {
                "status": "FAIL",
                "reason": f"Missing or empty required field: {field}"
            }

    # Evaluate threat vs control relevance via the adapter
    relevance_result = adapter.evaluate_relevance(
        scenario["threat"],
        scenario["control"]
    )

    if not relevance_result.get("relevant", False):
        return {
            "status": "REVIEW",
            "reason": "Control appears unrelated to named threat; flagged for human review",
            "details": relevance_result
        }

    return {
        "status": "PASS",
        "reason": "Scenario is complete and structurally consistent"
    }
