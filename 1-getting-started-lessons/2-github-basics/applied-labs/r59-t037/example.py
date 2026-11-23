"""
Mean Imputer with strict training-only fitting and transform separation.
R59-T037: Training-only imputation worked example.
"""

from typing import List, Optional, Union

Number = Union[int, float]
OptionalNumber = Optional[Number]


class MeanImputer:
    """
    Imputes missing values (None) using the arithmetic mean of observed training values.
    Guarantees strict separation of fit and transform steps to prevent data leakage.
    """

    def __init__(self) -> None:
        self.mean_: Optional[float] = None

    def fit(self, data: List[OptionalNumber]) -> 'MeanImputer':
        """
        Fit the imputer by computing the arithmetic mean of non-missing values in training data.

        Raises:
            ValueError: If data is empty or contains only missing (None) values.
        """
        if not data:
            raise ValueError("Training data cannot be empty.")

        valid_values = [v for v in data if v is not None]
        if not valid_values:
            raise ValueError("Cannot fit imputer: all training observations are missing.")

        self.mean_ = float(sum(valid_values) / len(valid_values))
        return self

    def transform(self, data: List[OptionalNumber]) -> List[float]:
        """
        Impute missing values in data using the previously fitted training mean.

        Raises:
            RuntimeError: If transform is called before fit.
        """
        if self.mean_ is None:
            raise RuntimeError("Imputer has not been fitted yet. Call fit() first.")

        return [float(self.mean_ if v is None else v) for v in data]

    def fit_transform(self, data: List[OptionalNumber]) -> List[float]:
        """Convenience method to fit and transform on the same training set."""
        return self.fit(data).transform(data)


def run_worked_example():
    """Executes the reference worked example specified in R59-T037."""
    imputer = MeanImputer()

    # Step 1: Fit on training observations only
    train_data = [2, None, 4]
    imputer.fit(train_data)
    print(f"Training input:     {train_data}")
    print(f"Fitted mean:        {imputer.mean_} (computed from [2, 4])")

    # Step 2: Transform validation observations using stored training mean
    val_data = [100, None]
    val_transformed = imputer.transform(val_data)
    print(f"Validation input:   {val_data}")
    print(f"Transformed output: {val_transformed} (imputed with 3.0, not 100)")

    return imputer.mean_, val_transformed


if __name__ == '__main__':
    run_worked_example()
