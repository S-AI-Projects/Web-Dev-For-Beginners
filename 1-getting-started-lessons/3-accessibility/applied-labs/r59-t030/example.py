"""R59-T030: Dependency-Plan Validation and Scenario Assessment.

Extends 'Creating Accessible Webpages' (1-getting-started-lessons/3-accessibility)
by providing deterministic task plan dependency validation, topological ordering,
cycle detection, missing dependency diagnosis, and structured scenario assessment.
"""

from __future__ import annotations

from collections import deque
import json
from typing import Any, Dict, List, Optional, Tuple, Union


def normalize_plan(plan: Any) -> Dict[str, List[str]]:
    """Normalize input plan into a dictionary mapping task_id to its list of dependency IDs."""
    if not isinstance(plan, (dict, list)):
        raise TypeError(f"Plan must be a dict or list, got {type(plan).__name__}")

    normalized: Dict[str, List[str]] = {}

    if isinstance(plan, dict):
        for task_id, deps in plan.items():
            if not isinstance(task_id, str) or not task_id.strip():
                raise ValueError("Task ID must be a non-empty string")
            if not isinstance(deps, (list, tuple)):
                raise ValueError(f"Dependencies for task '{task_id}' must be a list, got {type(deps).__name__}")
            for d in deps:
                if not isinstance(d, str) or not d.strip():
                    raise ValueError(f"Dependency item in task '{task_id}' must be a non-empty string")
            normalized[task_id.strip()] = [str(d).strip() for d in deps]
    else:  # list of dicts
        for item in plan:
            if not isinstance(item, dict):
                raise TypeError(f"Plan task entry must be a dictionary, got {type(item).__name__}")
            task_id = item.get("id") or item.get("task_id")
            if not task_id or not isinstance(task_id, str) or not task_id.strip():
                raise ValueError("Task dictionary must contain a non-empty 'id' or 'task_id'")
            deps = item.get("dependencies", [])
            if not isinstance(deps, (list, tuple)):
                raise ValueError(f"Dependencies for task '{task_id}' must be a list")
            normalized[task_id.strip()] = [str(d).strip() for d in deps]

    return normalized


def validate_and_order_plan(plan: Any) -> Dict[str, Any]:
    """Validate a task dependency graph and compute its topological execution order.

    Contract:
    1. A has no dependencies, B depends on A, C on B: orders ['A', 'B', 'C'].
    2. Cycles (e.g. A -> B -> A) are rejected with a cycle detection error.
    3. Unknown dependencies (task depends on unregistered task ID) are reported by task ID.
    4. Deterministic tie-breaking: unblocked tasks are sorted alphabetically.

    Args:
        plan: Task graph representation (dict or list of task dicts).

    Returns:
        Structured result dict with valid status, execution order, and errors.
    """
    normalized = normalize_plan(plan)
    errors: List[str] = []
    task_ids = set(normalized.keys())

    # 1. Missing / Unknown Dependency Detection
    for task_id, deps in sorted(normalized.items()):
        for dep in deps:
            if dep not in task_ids:
                errors.append(f"Task '{task_id}' depends on unknown task '{dep}'")

    if errors:
        return {
            "valid": False,
            "order": [],
            "errors": errors,
            "tasks_count": len(normalized)
        }

    # 2. Topological Sort with Cycle Detection (Kahn's Algorithm with deterministic sort)
    in_degree: Dict[str, int] = {t: 0 for t in normalized}
    dependents: Dict[str, List[str]] = {t: [] for t in normalized}

    for task_id, deps in normalized.items():
        in_degree[task_id] = len(deps)
        for dep in deps:
            dependents[dep].append(task_id)

    # Priority queue / sorted list for deterministic tie-breaking
    ready = [t for t, deg in in_degree.items() if deg == 0]
    ready.sort()

    execution_order: List[str] = []

    while ready:
        current = ready.pop(0)
        execution_order.append(current)

        for dep_task in sorted(dependents[current]):
            in_degree[dep_task] -= 1
            if in_degree[dep_task] == 0:
                ready.append(dep_task)
                ready.sort()

    if len(execution_order) < len(normalized):
        # Remaining tasks with in_degree > 0 form a cycle
        unresolved = sorted([t for t, deg in in_degree.items() if deg > 0])
        # Find exact cycle trace
        cycle_str = " -> ".join(unresolved + [unresolved[0]])
        errors.append(f"Cyclic dependency detected: {cycle_str}")
        return {
            "valid": False,
            "order": [],
            "errors": errors,
            "tasks_count": len(normalized)
        }

    return {
        "valid": True,
        "order": execution_order,
        "errors": [],
        "tasks_count": len(normalized)
    }


# Canonical Reference Fixtures
PLAN_CANONICAL = {
    "A": [],
    "B": ["A"],
    "C": ["B"]
}

PLAN_CYCLE_2 = {
    "A": ["B"],
    "B": ["A"]
}

PLAN_CYCLE_SELF = {
    "A": ["A"]
}

PLAN_UNKNOWN_DEP = {
    "A": [],
    "B": ["A"],
    "C": ["UNKNOWN_X"]
}

PLAN_A11Y_REMEDIATION = {
    "AUDIT_SEMANTICS": [],
    "ADD_IMAGE_ALT": ["AUDIT_SEMANTICS"],
    "ADD_FORM_LABELS": ["AUDIT_SEMANTICS"],
    "VERIFY_KEYBOARD_NAV": ["ADD_IMAGE_ALT", "ADD_FORM_LABELS"]
}


# ==============================================================================
# Applied Scenario Assessment Questions (Contribution Focus)
# ==============================================================================

def answer_question_1_predict_output() -> Dict[str, Any]:
    """Question 1 (Predict an output):

    In an accessibility remediation workflow with tasks:
      - AUDIT_SEMANTICS (no deps)
      - ADD_IMAGE_ALT (depends on AUDIT_SEMANTICS)
      - ADD_FORM_LABELS (depends on AUDIT_SEMANTICS)
      - VERIFY_KEYBOARD_NAV (depends on ADD_IMAGE_ALT and ADD_FORM_LABELS)
    Predict the exact topological execution order under alphabetical tie-breaking.
    """
    predicted_order = [
        "AUDIT_SEMANTICS",
        "ADD_FORM_LABELS",
        "ADD_IMAGE_ALT",
        "VERIFY_KEYBOARD_NAV"
    ]
    actual_result = validate_and_order_plan(PLAN_A11Y_REMEDIATION)
    matches = actual_result["order"] == predicted_order

    return {
        "question_id": "Q1_PREDICT_OUTPUT",
        "question_text": "Predict the exact topological execution order of the accessibility remediation plan.",
        "predicted_order": predicted_order,
        "actual_order": actual_result["order"],
        "matches_prediction": matches,
        "rationale": (
            "AUDIT_SEMANTICS has 0 dependencies so executes first. This unblocks both "
            "ADD_FORM_LABELS and ADD_IMAGE_ALT. Under alphabetical tie-breaking, "
            "ADD_FORM_LABELS precedes ADD_IMAGE_ALT. Finally, VERIFY_KEYBOARD_NAV executes once both prerequisites finish."
        )
    }


def answer_question_2_diagnose_failure() -> Dict[str, Any]:
    """Question 2 (Diagnose a failure):

    A developer submits an accessibility workflow where KEYBOARD_TEST depends on
    FOCUS_RING_STYLE, and FOCUS_RING_STYLE depends on KEYBOARD_TEST.
    Diagnose the validation failure reason, identify the culprit tasks, and provide remediation.
    """
    faulty_plan = {
        "KEYBOARD_TEST": ["FOCUS_RING_STYLE"],
        "FOCUS_RING_STYLE": ["KEYBOARD_TEST"]
    }
    validation = validate_and_order_plan(faulty_plan)

    return {
        "question_id": "Q2_DIAGNOSE_FAILURE",
        "question_text": "Diagnose why mutual dependency between KEYBOARD_TEST and FOCUS_RING_STYLE fails validation.",
        "valid": validation["valid"],
        "failure_category": "cyclic_dependency",
        "culprit_tasks": ["FOCUS_RING_STYLE", "KEYBOARD_TEST"],
        "diagnosed_error": validation["errors"][0] if validation["errors"] else "",
        "remediation": (
            "Break the circular dependency: styles (FOCUS_RING_STYLE) must be established before "
            "interactive keyboard verification (KEYBOARD_TEST) can execute."
        )
    }


def answer_question_3_choose_boundary_policy() -> Dict[str, Any]:
    """Question 3 (Choose a boundary policy):

    When multiple independent tasks have 0 unsatisfied dependencies at the same step,
    why must the scheduler enforce deterministic lexicographical tie-breaking instead of
    arbitrary runtime hash ordering?
    """
    return {
        "question_id": "Q3_CHOOSE_BOUNDARY_POLICY",
        "question_text": "Choose and justify the boundary resolution policy when multiple tasks are ready.",
        "chosen_policy": "deterministic_lexicographical_tiebreak",
        "rejected_policy": "arbitrary_hash_or_thread_order",
        "rationale": (
            "In automated CI accessibility test pipelines, arbitrary task order leads to flaky tests, "
            "non-reproducible test reports, and divergent state diffs across different developer machines and Node/Python versions. "
            "Alphabetical tie-breaking guarantees 100% deterministic, reproducible execution orders."
        )
    }


def run_demo() -> str:
    """Run validation across reference plans and output scenario assessment results."""
    demo_output = {
        "canonical_validation": validate_and_order_plan(PLAN_CANONICAL),
        "cycle_validation": validate_and_order_plan(PLAN_CYCLE_2),
        "unknown_dep_validation": validate_and_order_plan(PLAN_UNKNOWN_DEP),
        "assessment_questions": [
            answer_question_1_predict_output(),
            answer_question_2_diagnose_failure(),
            answer_question_3_choose_boundary_policy()
        ]
    }
    return json.dumps(demo_output, indent=2)


if __name__ == "__main__":
    print(run_demo())
