# Applied Lab: Security-Scenario Rubric & Assessment (R59-T040)

## Purpose and Problem Statement
When developing algorithms and loop structures (such as iterating over sensitive tokens, buffers, or pricing data), systems must balance automated verification with human oversight.

This lab implements a **structural rubric checker** that grades security scenario representations (`asset`, `threat`, `control`, `residual_risk`, `explanation`):
- **Pass:** A complete scenario with an aligned, relevant control passes structural grading (`SCENARIO_1_COMPLETE`).
- **Fail:** A scenario missing an asset fails structural validation (`SCENARIO_2_MISSING_ASSET`).
- **Flagged for Review:** A scenario where the control is unrelated to the named threat is flagged for human review (`SCENARIO_3_UNRELATED_CONTROL`).

## Applied Assessment Questions
1. **Predict an Output:** Evaluating `SCENARIO_1_COMPLETE` yields status `"pass"`.
2. **Diagnose a Failure:** `SCENARIO_2_MISSING_ASSET` fails with `"Missing required asset"`.
3. **Choose a Boundary Policy:** Unfamiliar or unclassified domains should be flagged for human review rather than blindly rejected or approved.

## Running the Assessment and Checks

Run the assessment demonstration:
```bash
python3 2-js-basics/4-arrays-loops/applied-labs/r59-t040/example.py
```

Run the automated test suite:
```bash
python3 -m unittest discover -s 2-js-basics/4-arrays-loops/applied-labs/r59-t040 -p "test_*.py"
```

## Scope and Boundaries
- Uses Python standard library only.
- Demonstrates structural rubric assessment; human review evaluates qualitative explanations.
