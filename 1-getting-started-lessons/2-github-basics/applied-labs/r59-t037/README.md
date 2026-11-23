# Applied Lab: Training-Only Mean Imputation (R59-T037)

## Purpose and Problem Statement
When preprocessing data for computational tasks or machine learning pipelines, missing values must often be filled (imputed). A critical error is **data leakage**, where information from validation or test datasets leaks into the training phase.

This lab demonstrates strict **fit/transform separation**:
1. The imputation parameter (mean) is computed on **training observations only**.
2. The fitted parameter is then applied to transform validation observations without refitting.

## Exact Input-to-Output Contract
- **Training observations:** `[2, None, 4]`
  - Valid numeric values: `2`, `4`
  - Fitted mean: `(2 + 4) / 2 = 3.0`
- **Validation observations:** `[100, None]`
  - Transformed output: `[100.0, 3.0]` (the missing value is replaced by the stored training mean `3.0`, **not** refitted to `100.0`).
- **Boundary condition:** All-missing training data (e.g. `[None, None]`) is strictly rejected with a `ValueError`.

## Running the Example and Automated Checks

Run the worked example:
```bash
python3 1-getting-started-lessons/2-github-basics/applied-labs/r59-t037/example.py
```

Run the regression test suite:
```bash
python3 -m unittest discover -s 1-getting-started-lessons/2-github-basics/applied-labs/r59-t037 -p "test_*.py"
```

## Scope and Limitations
- Uses Python standard library only (no external dependencies, GPU, or third-party packages required).
- Represents a bounded univariate arithmetic mean simulation illustrating data separation concepts.
