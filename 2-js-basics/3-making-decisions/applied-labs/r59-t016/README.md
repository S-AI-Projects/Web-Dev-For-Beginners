# Applied Lab R59-T016: Security Scenario Rubric Checker

**Topic:** JavaScript Basics: Making Decisions (2-js-basics/3-making-decisions)
**Student:** Alok Gupta (URN: E26B07F0573)

## Overview
This applied lab demonstrates programmatic decision making by implementing a structural security-scenario rubric evaluator. In applications, conditional branches are frequently used to validate inputs, assess access policies, and flag suspicious states for human review.

## Fictional Scenarios
1. **Complete & Valid Scenario (`complete_valid`)**:
   - Asset: User Authentication Session Token
   - Threat: Token theft via session hijacking / replay attack
   - Control: Conditional check validating token expiration and IP binding before granting access
   - Residual Risk: Token theft if the user device's storage is compromised directly
   - Expected Output: `status: PASS`

2. **Incomplete Scenario (`missing_asset`)**:
   - Asset: *(Empty)*
   - Threat: Privilege escalation via query parameter manipulation
   - Control: Role-based authorization checks
   - Residual Risk: Misconfigured role definitions
   - Expected Output: `status: FAIL` (Missing required field: asset)

3. **Inconsistent Scenario (`unrelated_control`)**:
   - Asset: Customer Database Records
   - Threat: SQL Injection in search query condition
   - Control: Adding client-side image compression before uploading profile avatars
   - Residual Risk: Database queries remain unparameterized
   - Expected Output: `status: REVIEW` (Control appears unrelated to the named threat)

## Refactoring Note
- **Baseline**: Monolithic conditional branch evaluating fields and hardcoded threat matching.
- **Refactored**: Extracted the `validate_control_relevance(threat, control)` function responsibility, separating structural validation from semantic domain matching while maintaining 100% contract equivalence across all fixtures.

## Automated Check
Run the tests using standard library unittest:

```bash
python3 -m unittest discover -s 2-js-basics/3-making-decisions/applied-labs/r59-t016 -p "test_*.py"
```

## Scope and Limitations
This checker is a deterministic structural rubric tool designed for educational evaluation. It verifies completeness and expected keyword domains without requiring paid cloud APIs or heavy models. Human review remains essential to evaluate the depth and rationale of freeform security explanations.
