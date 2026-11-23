# R59-T043: trace a data-type security scenario

This local-only example applies the lesson's number, string, and boolean concepts to three fictional security scenarios. Each record names an asset, threat, control, and residual risk. The checker validates required fields and flags a mismatched declared threat/control category for human review.

The trace records the state after each field is added. `trace_matches_output` checks that the final result is derived from the last recorded state. This is a structural teaching aid; it does not prove the scenario is secure or evaluate the quality of the prose. No real system, account, service, or data is used.

Run from the repository root:

```bash
python3 -m unittest discover -s 2-js-basics/1-data-types/applied-labs/r59-t043 -p "test_*.py"
python3 2-js-basics/1-data-types/applied-labs/r59-t043/example.py
```
