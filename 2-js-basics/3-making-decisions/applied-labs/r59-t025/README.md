# Applied Lab R59-T025: Decision-Making Scenario Rubric Checker

This applied lab extends **JavaScript Basics: Making Decisions** by implementing a Python-based structural rubric checker for cybersecurity decision scenarios.

## Concepts & Lesson Mapping
In "Making Decisions", programs evaluate Boolean conditions to choose execution paths (`if...else`, logical operators). In this lab:
- Conditional rules evaluate security scenario representations (`asset`, `threat`, `control`, `residual_risk`, `explanation`).
- Structural completeness requires each field to be present and non-empty.
- Threat-control relevance verifies that the proposed control addresses the named threat domain.
- When an asset is missing, the scenario fails structural validation.
- When a control is unrelated to the threat, the scenario is flagged for human review.
- Explanations are judged by human reviewers; automated grading is strictly confined to structural rubrics.

## Prerequisites
- Python 3.9+ standard library only (no third-party dependencies).

## How to Run

### Run Demo
```bash
python3 2-js-basics/3-making-decisions/applied-labs/r59-t025/example.py
```

### Run Tests
From repository root:
```bash
python3 -m unittest discover -s 2-js-basics/3-making-decisions/applied-labs/r59-t025 -p "test_*.py" -v
```

## Input Fixtures

Three reference scenarios illustrate distinct conditional outcomes:

1. **Scenario 1 (`SCN-001`) - Complete:**
   - **Asset:** "Session authentication token"
   - **Threat:** "Token tampering / privilege escalation in client-side decision logic"
   - **Control:** "Cryptographic signature validation and server-side role check before granting admin access"
   - **Residual Risk:** "Replay attack if token lacks expiration or nonce"
   - **Explanation:** "Evaluates role === 'admin' only on verified signed tokens to prevent unauthorized branching."
   - **Outcome:** `pass`

2. **Scenario 2 (`SCN-002`) - Missing Asset:**
   - **Asset:** `""` (empty)
   - **Threat:** "Brute-force credential guessing on login decision branch"
   - **Control:** "Exponential rate limiting and lockout after 5 failed attempts"
   - **Residual Risk:** "Distributed IP credential stuffing"
   - **Explanation:** "Protects login decision branch from automated credential stuffing."
   - **Outcome:** `fail` (missing required asset field)

3. **Scenario 3 (`SCN-003`) - Unrelated Control:**
   - **Asset:** "User profile data in browser localStorage"
   - **Threat:** "Cross-site scripting (XSS) injecting malicious script into DOM decision paths"
   - **Control:** "Encrypt database backups at rest using AES-256"
   - **Residual Risk:** "Backups stolen from cloud storage bucket"
   - **Explanation:** "Encrypts database backups, but database at-rest encryption does not mitigate DOM XSS in client storage."
   - **Outcome:** `flagged_for_review` (database backup encryption does not mitigate DOM XSS)

## Expected Output

```json
[
  {
    "scenario_id": "SCN-001",
    "status": "pass",
    "errors": [],
    "flags": [],
    "requires_human_review": false
  },
  {
    "scenario_id": "SCN-002",
    "status": "fail",
    "errors": [
      "Missing required asset field"
    ],
    "flags": [],
    "requires_human_review": false
  },
  {
    "scenario_id": "SCN-003",
    "status": "flagged_for_review",
    "errors": [],
    "flags": [
      "Control is unrelated to named threat (requires human review)"
    ],
    "requires_human_review": true
  }
]
```

## Scope and Limitations
- **Simulation / Heuristic Label:** Threat-control relevance uses a deterministic keyword/domain heuristic. Real-world threat modeling requires contextual human assessment.
- **Automated Grading Boundary:** The checker verifies schema completeness and domain relevance. It does NOT evaluate semantic plausibility, correctness of risk calculations, or prose quality, which remain under human review.
- No network requests, cloud APIs, or external models are used.
