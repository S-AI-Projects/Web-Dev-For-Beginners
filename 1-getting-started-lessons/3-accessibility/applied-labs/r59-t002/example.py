"""
Dependency-Plan Validation and Topological Ordering
Applied Lab: R59-T002
Curriculum: 1-getting-started-lessons/3-accessibility
Student: Vedika Yadav (URN: e26b07f0785)

This module validates and topologically orders a task plan representation.
In accessibility remediation workflows, tasks must be sequenced so prerequisites
(such as semantic structure audits and landmark definitions) execute before downstream
tasks (such as ARIA live region bindings and screen-reader assertions).
"""

from typing import Dict, List, Set


class PlanValidationError(Exception):
    """Base exception for plan validation errors."""
    pass


class MissingDependencyError(PlanValidationError):
    """Raised when a task references an unknown dependency ID."""
    def __init__(self, task_id: str, missing_dep_id: str):
        self.task_id = task_id
        self.missing_dep_id = missing_dep_id
        super().__init__(
            f"Unknown dependency '{missing_dep_id}' referenced by task '{task_id}'"
        )


class CircularDependencyError(PlanValidationError):
    """Raised when a dependency cycle is detected among tasks."""
    def __init__(self, cycle_nodes: List[str]):
        self.cycle_nodes = cycle_nodes
        super().__init__(
            f"Circular dependency cycle detected among tasks: {cycle_nodes}"
        )


def validate_and_order_plan(plan: Dict[str, List[str]]) -> List[str]:
    """
    Validates a task dependency plan and returns a deterministic topological ordering.

    Each key in `plan` is a task ID, and its value is a list of task IDs that must complete
    BEFORE this task can execute.
    
    Contract:
    - Independent tasks (empty dependency list) execute first.
    - If B depends on A and C depends on B: returns ['A', 'B', 'C'].
    - Cycles such as A -> B -> A are detected and rejected via CircularDependencyError.
    - References to task IDs not defined in the plan raise MissingDependencyError with the missing ID.
    - Empty plan {} is valid and returns [].
    - Single task {'A': []} is valid and returns ['A'].
    - Equal-priority tasks are ordered deterministically by alphabetical task ID.
    """
    # Boundary case: Empty plan
    if not plan:
        return []

    # 1. Validate that all dependencies exist in the plan
    all_task_ids: Set[str] = set(plan.keys())
    for task_id, dependencies in plan.items():
        for dep in dependencies:
            if dep not in all_task_ids:
                raise MissingDependencyError(task_id, dep)

    # 2. Build graph and compute in-degrees
    # An edge goes from prerequisite -> dependent task.
    # When dependency D is in plan[T], D must run before T, so D -> T.
    dependents: Dict[str, List[str]] = {task_id: [] for task_id in all_task_ids}
    in_degree: Dict[str, int] = {task_id: 0 for task_id in all_task_ids}

    for task_id, dependencies in plan.items():
        # De-duplicate dependencies to handle duplicate entries cleanly
        unique_deps = set(dependencies)
        in_degree[task_id] = len(unique_deps)
        for dep in unique_deps:
            dependents[dep].append(task_id)

    # 3. Kahn's Algorithm for Topological Sort
    # Start with nodes that have in_degree == 0 (no prerequisites)
    # Sort ready queue alphabetically to guarantee deterministic ordering
    ready_queue: List[str] = sorted([t for t, deg in in_degree.items() if deg == 0])
    ordered: List[str] = []

    while ready_queue:
        current = ready_queue.pop(0)
        ordered.append(current)

        for dependent in dependents[current]:
            in_degree[dependent] -= 1
            if in_degree[dependent] == 0:
                # Insert in alphabetical order to maintain determinism
                ready_queue.append(dependent)
                ready_queue.sort()

    # 4. Check for cycles
    if len(ordered) < len(all_task_ids):
        unresolved = sorted([t for t, deg in in_degree.items() if deg > 0])
        raise CircularDependencyError(unresolved)

    return ordered


# Standard educational test fixtures
FIXTURES = {
    "standard_linear": {
        "A": [],
        "B": ["A"],
        "C": ["B"]
    },
    "cyclic_two_node": {
        "A": ["B"],
        "B": ["A"]
    },
    "unknown_dependency": {
        "A": [],
        "B": ["A"],
        "C": ["NON_EXISTENT_TASK"]
    },
    "boundary_empty": {},
    "boundary_single": {
        "A": []
    },
    "boundary_self_cycle": {
        "A": ["A"]
    },
    "multiple_independent": {
        "TaskZ": [],
        "TaskA": [],
        "TaskM": []
    }
}
