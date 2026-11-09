import numpy as np
import pytest

from medml.data import load


@pytest.mark.parametrize("name", ["diabetes", "heart", "liver"])
def test_binary_datasets_are_clean(name):
    data = load(name)
    assert data.is_binary
    assert set(data.y.unique()) == {0, 1}
    assert list(data.X.columns) == [f.name for f in data.features]
    assert len(data.X) == len(data.y)
    assert data.cleaning_log


def test_pima_zeros_become_missing():
    data = load("diabetes")
    for col in ["Glucose", "BloodPressure", "SkinThickness", "Insulin", "BMI"]:
        assert (data.X[col] == 0).sum() == 0
    assert data.X["Insulin"].isna().sum() == 374


def test_heart_target_is_binarised():
    data = load("heart")
    assert data.class_balance() == {"No heart disease": 164, "Heart disease": 139}


def test_liver_duplicates_removed_and_labels_remapped():
    data = load("liver")
    assert len(data.X) == 570  # 583 raw rows - 13 duplicates
    assert not data.X.assign(y=data.y).duplicated().any()
    assert data.class_balance()["Liver disease"] > data.class_balance()["No liver disease"]
    assert set(data.X["Gender"].unique()) == {0, 1}


def test_symptoms_are_deduplicated_and_cleaned():
    data = load("symptom")
    assert len(data.class_names) == 41
    assert not data.X.duplicated().any()
    assert len(data.X) < 400  # 4,962 raw rows collapse to ~305 unique patterns
    assert all(" " not in c for c in data.X.columns)
    assert "fluid_overload.1" not in data.X.columns
    assert "Osteoarthritis" in data.class_names
    assert set(np.unique(data.X.to_numpy())) <= {0, 1}
