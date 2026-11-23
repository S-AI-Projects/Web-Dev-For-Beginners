# R59-T044: keep review behind an offline adapter

This local-only example applies the lesson's number, string, and boolean concepts to three fictional security scenarios. A callable `ReviewAdapter` boundary keeps evaluation replaceable; `offline_rubric_adapter` is the deterministic local implementation used by the example and tests.

The adapter checks required asset, threat, control, and residual-risk fields and flags a mismatched declared threat/control category for human review. It does not contact a service or prove the text is secure. The mock does not establish real-service authentication, network availability, rate limits, data handling, or provider-specific policy behavior.

Run from the repository root:

```bash
python3 -m unittest discover -s 2-js-basics/1-data-types/applied-labs/r59-t044 -p "test_*.py"
python3 2-js-basics/1-data-types/applied-labs/r59-t044/example.py
```
