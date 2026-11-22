# Applied Lab R59-T030: Dependency-Plan Validation & Scenario Assessment

This applied lab extends **Creating Accessible Webpages** (`1-getting-started-lessons/3-accessibility/README.md`) by implementing a deterministic dependency graph validator and topological task scheduler for web accessibility auditing workflows.

## Concepts & Lesson Mapping

Web accessibility remediation involves systematic, phased interventions (WCAG compliance, screen reader support, keyboard navigation). These remediation tasks have strict prerequisites:
1. **Prerequisite Ordering:** Structural semantic audits (`AUDIT_SEMANTICS`) must precede ARIA enhancements and image text descriptions (`ADD_IMAGE_ALT`, `ADD_FORM_LABELS`). Focus indicators must be styled before keyboard tab order tests (`VERIFY_KEYBOARD_NAV`) can be verified.
2. **Missing Dependency Detection:** If a remediation task refers to an unknown or missing task ID, the validator halts execution and flags the missing dependency by task ID.
3. **Cycle Detection:** Mutually recursive dependencies (e.g. `KEYBOARD_TEST` depends on `FOCUS_RING_STYLE` while `FOCUS_RING_STYLE` depends on `KEYBOARD_TEST`) create execution deadlocks. The validator detects cycles and rejects invalid task plans before runtime.
4. **Deterministic Tie-Breaking:** When multiple independent tasks are unblocked simultaneously, deterministic alphabetical ordering prevents flaky test runs and ensures reproducible build logs.

## Prerequisites
- Python 3.9+ standard library only (no third-party dependencies required).

## How to Run

### Run Demo
From the repository root:
```bash
python3 1-getting-started-lessons/3-accessibility/applied-labs/r59-t030/example.py
```

### Run Tests
From the repository root:
```bash
python3 -m unittest discover -s 1-getting-started-lessons/3-accessibility/applied-labs/r59-t030 -p "test_*.py" -v
```

## Input Fixtures

1. **Canonical Linear Plan (`PLAN_CANONICAL`):**
   - Tasks: `A` (deps: `[]`), `B` (deps: `["A"]`), `C` (deps: `["B"]`)
   - Outcome: Valid, execution order `["A", "B", "C"]`.

2. **Cyclic Dependency Plan (`PLAN_CYCLE_2`):**
   - Tasks: `A` (deps: `["B"]`), `B` (deps: `["A"]`)
   - Outcome: Rejected with error `"Cyclic dependency detected: A -> B -> A"`.

3. **Unknown Dependency Plan (`PLAN_UNKNOWN_DEP`):**
   - Tasks: `A` (deps: `[]`), `B` (deps: `["A"]`), `C` (deps: `["UNKNOWN_X"]`)
   - Outcome: Rejected with error `"Task 'C' depends on unknown task 'UNKNOWN_X'"`.

4. **Accessibility Remediation Plan (`PLAN_A11Y_REMEDIATION`):**
   - Tasks: `AUDIT_SEMANTICS` (no deps), `ADD_IMAGE_ALT` (depends on `AUDIT_SEMANTICS`), `ADD_FORM_LABELS` (depends on `AUDIT_SEMANTICS`), `VERIFY_KEYBOARD_NAV` (depends on both alt and labels).
   - Outcome: Valid, execution order `["AUDIT_SEMANTICS", "ADD_FORM_LABELS", "ADD_IMAGE_ALT", "VERIFY_KEYBOARD_NAV"]`.

## Applied Assessment Questions

1. **Question 1 (Predict an Output):** Predict the exact execution order of the multi-branch accessibility remediation plan.
   - *Rationale:* `AUDIT_SEMANTICS` executes first, unblocking `ADD_FORM_LABELS` and `ADD_IMAGE_ALT`. Lexicographical tie-breaking selects `ADD_FORM_LABELS` before `ADD_IMAGE_ALT`. Once both are complete, `VERIFY_KEYBOARD_NAV` runs.
2. **Question 2 (Diagnose a Failure):** Diagnose why a mutual dependency between keyboard verification and focus styling fails validation.
   - *Rationale:* A cyclic dependency deadlock exists. Styles must be established prior to verification.
3. **Question 3 (Choose a Boundary Policy):** Choose and justify the tie-breaking policy when multiple tasks are ready.
   - *Rationale:* Deterministic lexicographical tie-breaking eliminates non-deterministic scheduling jitter and prevents flaky test suites.

## Expected Output

Running `run_demo()` produces the following JSON summary:

```json
{
  "canonical_validation": {
    "valid": true,
    "order": [
      "A",
      "B",
      "C"
    ],
    "errors": [],
    "tasks_count": 3
  },
  "cycle_validation": {
    "valid": false,
    "order": [],
    "errors": [
      "Cyclic dependency detected: A -> B -> A"
    ],
    "tasks_count": 2
  },
  "unknown_dep_validation": {
    "valid": false,
    "order": [],
    "errors": [
      "Task 'C' depends on unknown task 'UNKNOWN_X'"
    ],
    "tasks_count": 3
  },
  "assessment_questions": [
    {
      "question_id": "Q1_PREDICT_OUTPUT",
      "question_text": "Predict the exact topological execution order of the accessibility remediation plan.",
      "predicted_order": [
        "AUDIT_SEMANTICS",
        "ADD_FORM_LABELS",
        "ADD_IMAGE_ALT",
        "VERIFY_KEYBOARD_NAV"
      ],
      "actual_order": [
        "AUDIT_SEMANTICS",
        "ADD_FORM_LABELS",
        "ADD_IMAGE_ALT",
        "VERIFY_KEYBOARD_NAV"
      ],
      "matches_prediction": true,
      "rationale": "AUDIT_SEMANTICS has 0 dependencies so executes first. This unblocks both ADD_FORM_LABELS and ADD_IMAGE_ALT. Under alphabetical tie-breaking, ADD_FORM_LABELS precedes ADD_IMAGE_ALT. Finally, VERIFY_KEYBOARD_NAV executes once both prerequisites finish."
    },
    {
      "question_id": "Q2_DIAGNOSE_FAILURE",
      "question_text": "Diagnose why mutual dependency between KEYBOARD_TEST and FOCUS_RING_STYLE fails validation.",
      "valid": false,
      "failure_category": "cyclic_dependency",
      "culprit_tasks": [
        "FOCUS_RING_STYLE",
        "KEYBOARD_TEST"
      ],
      "diagnosed_error": "Cyclic dependency detected: FOCUS_RING_STYLE -> KEYBOARD_TEST -> FOCUS_RING_STYLE",
      "remediation": "Break the circular dependency: styles (FOCUS_RING_STYLE) must be established before interactive keyboard verification (KEYBOARD_TEST) can execute."
    },
    {
      "question_id": "Q3_CHOOSE_BOUNDARY_POLICY",
      "question_text": "Choose and justify the boundary resolution policy when multiple tasks are ready.",
      "chosen_policy": "deterministic_lexicographical_tiebreak",
      "rejected_policy": "arbitrary_hash_or_thread_order",
      "rationale": "In automated CI accessibility test pipelines, arbitrary task order leads to flaky tests, non-reproducible test reports, and divergent state diffs across different developer machines and Node/Python versions. Alphabetical tie-breaking guarantees 100% deterministic, reproducible execution orders."
    }
  ]
}
```

## Scope and Limitations
- **Simulation / Graph Theory Scope:** This lab models task dependencies and computes topological orders using Kahn's algorithm. It does not spawn OS processes or interact with live screen readers.
- **Static Analysis Boundary:** Cycles and missing dependencies are analyzed statically from task declarations.
- No third-party packages, cloud APIs, or external models are used.
