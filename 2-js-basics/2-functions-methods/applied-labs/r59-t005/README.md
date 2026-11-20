# Applied Lab R59-T005: Security Scenario Rubric Checker with Offline Service Adapter

**Curriculum Topic:** 2-js-basics/2-functions-methods  
**Student:** Vedika Yadav (URN: `e26b07f0785`)

---

## 1. Overview and Lesson Alignment

In "JavaScript Basics: Methods and Functions", students learn how functions encapsulate modular logic, accept input parameters, and return computed results. Security analysis similarly decomposes application risks into structured components:
- **Asset**: The resource being protected (e.g. calculation parameters).
- **Threat**: The potential attack vector (e.g. type confusion or NaN parameter injection).
- **Control**: The defensive function or validation guard implemented.
- **Residual Risk**: Known limitations or boundary conditions remaining after controls are applied.

---

## 2. Callable Interface & Offline Service Adapter

To evaluate threat-control consistency without relying on flaky third-party AI APIs or cloud threat databases:
- **Interface (`SecurityRelevanceService`)**: An abstract callable interface declaring `evaluate_relevance(threat, control)`.
- **Adapter (`DeterministicLocalAdapter`)**: A local deterministic implementation using bounded token mapping.
- **What this mock does NOT establish**: The local adapter evaluates structural relevance and expected security keywords; it does not connect to live CVE feeds or model dynamic execution exploits. Human review is required to judge the qualitative depth of student explanations.

---

## 3. Fictional Scenarios and Expected Output

| Scenario | Asset | Threat | Control | Result |
| :--- | :--- | :--- | :--- | :--- |
| `complete_valid` | Function calculation parameters | Type confusion & NaN injection | Type-checking & default parameter guards | **PASS** |
| `missing_asset` | *(Empty)* | Recursion stack overflow | Recursion bounds checking function | **FAIL** (missing asset) |
| `unrelated_control`| Greeting return value | XSS injection via return values | Arrow function syntax refactor | **REVIEW** (unrelated control) |

---

## 4. Running the Automated Checks

```bash
python3 -m unittest discover -s 2-js-basics/2-functions-methods/applied-labs/r59-t005 -p "test_*.py" -v
```
