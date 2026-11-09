"""The explainer must be *faithful*: base rate + contributions == predicted probability."""

import numpy as np
import pandas as pd
import pytest
from sklearn.pipeline import Pipeline
from sklearn.tree import DecisionTreeClassifier

from medml.data import load
from medml.explain import encoded_columns, explain, global_importance
from medml.pipelines import build_preprocessor, one_standard_error_rule


@pytest.fixture(scope="module", params=["diabetes", "heart", "liver"])
def fitted(request):
    data = load(request.param)
    pipe = Pipeline(
        [
            ("pre", build_preprocessor(data.features)),
            ("model", DecisionTreeClassifier(max_depth=5, random_state=0)),
        ]
    ).fit(data.X, data.y)
    return data, pipe


def _row(data, i):
    return {k: (None if pd.isna(v) else float(v)) for k, v in data.X.iloc[i].items()}


def test_contributions_add_up_to_prediction(fitted):
    data, pipe = fitted
    for i in range(0, len(data.X), 37):
        inputs = _row(data, i)
        result = explain(pipe, data.features, inputs, target_class=1)
        expected = pipe.predict_proba(pd.DataFrame([inputs]).astype(float))[0, 1]
        total = result["base_rate"] + sum(r["contribution"] for r in result["reasons"])
        assert total == pytest.approx(expected, abs=1e-3)
        assert result["probability"] == pytest.approx(expected, abs=1e-4)


def test_reasons_are_readable_and_ranked(fitted):
    data, pipe = fitted
    result = explain(pipe, data.features, _row(data, 0), target_class=1)
    reasons = result["reasons"]
    assert reasons, "every prediction needs at least one reason"
    assert all(r["text"] and r["label"] for r in reasons)
    magnitudes = [abs(r["contribution"]) for r in reasons]
    assert magnitudes == sorted(magnitudes, reverse=True)


def test_missing_optional_value_is_flagged_as_imputed():
    data = load("diabetes")
    pipe = Pipeline(
        [
            ("pre", build_preprocessor(data.features)),
            ("model", DecisionTreeClassifier(random_state=0)),
        ]
    ).fit(data.X, data.y)
    inputs = _row(data, 0) | {"Insulin": None, "SkinThickness": None}
    reasons = explain(pipe, data.features, inputs, target_class=1)["reasons"]
    for r in reasons:
        if r["feature"] in ("Insulin", "SkinThickness"):
            assert r["imputed"] and "not provided" in r["text"]


def test_one_hot_columns_map_back_to_original_features():
    data = load("heart")
    pre = build_preprocessor(data.features).fit(data.X)
    cols = encoded_columns(pre)
    assert len(cols) == pre.transform(data.X).shape[1]
    assert {c.feature for c in cols} == set(data.X.columns)
    assert any(c.feature == "cp" and c.category == "4" for c in cols)


def test_global_importance_sums_to_one(fitted):
    _, pipe = fitted
    total = sum(i["importance"] for i in global_importance(pipe))
    assert total == pytest.approx(1.0, abs=1e-3)


def test_one_standard_error_rule_prefers_simpler_tree():
    results = {
        "mean_test_score": [0.70, 0.71, 0.72],
        "std_test_score": [0.03, 0.03, 0.03],
        "param_model__max_depth": [3, 6, None],
        "param_model__min_samples_leaf": [5, 5, 1],
        "split0_test_score": [0] * 3,
        "split1_test_score": [0] * 3,
        "split2_test_score": [0] * 3,
        "split3_test_score": [0] * 3,
    }
    # best = 0.72, SE = 0.03 / 2 = 0.015 -> threshold 0.705: depth 6 qualifies, depth 3 does not
    assert one_standard_error_rule(results) == 1
    results["mean_test_score"] = [0.65, 0.71, 0.72]
    results["std_test_score"] = [0.03, 0.03, 0.2]  # noisy best -> threshold 0.62
    assert one_standard_error_rule(results) == 0
    assert np.isfinite(results["mean_test_score"]).all()


def test_random_forest_explanation_is_exact_on_symptoms():
    from sklearn.ensemble import RandomForestClassifier

    data = load("symptom")
    pipe = Pipeline(
        [
            ("pre", build_preprocessor(data.features)),
            ("model", RandomForestClassifier(n_estimators=25, random_state=0)),
        ]
    ).fit(data.X, data.y)
    inputs = {k: float(v) for k, v in data.X.iloc[10].items()}
    result = explain(pipe, data.features, inputs)
    expected = pipe.predict_proba(pd.DataFrame([inputs]))[0].max()
    total = result["base_rate"] + sum(r["contribution"] for r in result["reasons"])
    assert total == pytest.approx(expected, abs=1e-3)
    assert result["method"].startswith("mean decision path")
    top = result["reasons"][0]
    assert top["value"] in {"present", "absent"}
