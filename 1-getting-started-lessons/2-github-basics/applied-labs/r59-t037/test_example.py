"""
Unit tests for R59-T037: Training-only imputation contract and regression tests.
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(__file__))
from example import MeanImputer


class TestMeanImputer(unittest.TestCase):
    """Verifies the contract of training-only imputation and data leakage prevention."""

    def test_reference_contract(self):
        """
        Contract check:
        Training [2, None, 4] yields mean 3.
        Validation [100, None] becomes [100, 3], not [100, 100].
        """
        imputer = MeanImputer()
        train_input = [2, None, 4]
        val_input = [100, None]

        imputer.fit(train_input)
        self.assertEqual(imputer.mean_, 3.0)

        val_output = imputer.transform(val_input)
        self.assertEqual(val_output, [100.0, 3.0])
        # Assert explicitly that validation observation (100) was NOT used for imputation
        self.assertNotEqual(val_output, [100.0, 100.0])

    def test_all_missing_training_rejected(self):
        """All-missing training input must be rejected with ValueError."""
        imputer = MeanImputer()
        with self.assertRaises(ValueError):
            imputer.fit([None, None])

    def test_empty_training_rejected(self):
        """Empty training list must be rejected with ValueError."""
        imputer = MeanImputer()
        with self.assertRaises(ValueError):
            imputer.fit([])

    def test_transform_before_fit_rejected(self):
        """Calling transform without fit must raise RuntimeError."""
        imputer = MeanImputer()
        with self.assertRaises(RuntimeError):
            imputer.transform([1, None, 3])

    def test_no_missing_values(self):
        """Standard dataset without missing values fits and transforms accurately."""
        imputer = MeanImputer()
        imputer.fit([10, 20, 30])
        self.assertEqual(imputer.mean_, 20.0)
        self.assertEqual(imputer.transform([5, None, 15]), [5.0, 20.0, 15.0])

    def test_single_observation(self):
        """Single valid observation among missing values."""
        imputer = MeanImputer()
        imputer.fit([None, 42, None])
        self.assertEqual(imputer.mean_, 42.0)
        self.assertEqual(imputer.transform([None]), [42.0])

    def test_documentation_files_exist(self):
        """Verify lab README and lesson README exist and mention the contract fixtures."""
        current_dir = os.path.dirname(__file__)
        lab_readme = os.path.join(current_dir, 'README.md')
        lesson_readme = os.path.join(current_dir, '../../README.md')

        self.assertTrue(os.path.exists(lab_readme), "Lab README.md must exist")
        self.assertTrue(os.path.exists(lesson_readme), "Lesson README.md must exist")

        with open(lab_readme, 'r', encoding='utf-8') as f:
            lab_content = f.read()
            self.assertIn('[2,None,4]', lab_content.replace(' ', ''))
            self.assertIn('[100,None]', lab_content.replace(' ', ''))

        with open(lesson_readme, 'r', encoding='utf-8') as f:
            lesson_content = f.read()
            self.assertIn('r59-t037', lesson_content)


if __name__ == '__main__':
    unittest.main()
