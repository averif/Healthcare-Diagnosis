"""Explain a Decision Tree (or Random Forest) prediction in plain English.

For one patient we follow the path from the root of the tree to the leaf that produced the
prediction. At every split the predicted probability changes, and that change is credited to the
feature tested at the split. The contributions add up exactly:

    leaf probability = base rate (root) + sum of feature contributions

So every reason shown to a user is a faithful account of how the model reached its answer,
not an approximation.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.tree import DecisionTreeClassifier

from .features import FeatureSpec, _code, spec_index


@dataclass(frozen=True)
class EncodedColumn:
    feature: str  # original feature name
    category: str | None  # set for one-hot columns, e.g. "4" for cp == 4


@dataclass
class Reason:
    feature: str
    label: str
    value: str  # formatted patient value, e.g. "168 mg/dL"
    condition: str  # e.g. "above 154.5 mg/dL"
    text: str  # full sentence
    contribution: float  # change in probability of the predicted class (+ raises, - lowers)
    imputed: bool = False

    def to_dict(self) -> dict:
        return asdict(self)


def encoded_columns(pre: ColumnTransformer) -> list[EncodedColumn]:
    """Map every column produced by the preprocessor back to its original feature."""
    columns: list[EncodedColumn] = []
    for _, transformer, cols in pre.transformers_:
        if transformer == "drop" or not len(cols):
            continue
        onehot = None
        if isinstance(transformer, Pipeline) and "onehot" in transformer.named_steps:
            onehot = transformer.named_steps["onehot"]
        if onehot is None:
            columns.extend(EncodedColumn(c, None) for c in cols)
        else:
            for col, cats in zip(cols, onehot.categories_, strict=True):
                columns.extend(EncodedColumn(col, _code(c)) for c in cats)
    return columns


def imputed_values(pre: ColumnTransformer) -> dict[str, object]:
    """Value the pipeline substitutes when a feature is missing (median / most frequent)."""
    values: dict[str, object] = {}
    for _, transformer, cols in pre.transformers_:
        if transformer == "drop":
            continue
        imputer = (
            transformer.named_steps["impute"] if isinstance(transformer, Pipeline) else transformer
        )
        values.update(zip(cols, imputer.statistics_, strict=True))
    return values


def global_importance(pipeline: Pipeline) -> list[dict]:
    """Tree feature importances summed back onto the original (un-encoded) features."""
    pre: ColumnTransformer = pipeline.named_steps["pre"]
    model = pipeline.named_steps["model"]
    totals: dict[str, float] = {}
    for col, imp in zip(encoded_columns(pre), model.feature_importances_, strict=True):
        totals[col.feature] = totals.get(col.feature, 0.0) + float(imp)
    ranked = sorted(totals.items(), key=lambda kv: kv[1], reverse=True)
    return [{"feature": f, "importance": round(v, 4)} for f, v in ranked]


def _fmt(x: float) -> str:
    return f"{x:.4g}"


def _numeric_condition(spec: FeatureSpec, low: float | None, high: float | None) -> str:
    unit = f" {spec.unit}" if spec.unit else ""
    if low is not None and high is not None:
        return f"between {_fmt(low)} and {_fmt(high)}{unit}"
    if low is not None:
        return f"above {_fmt(low)}{unit}"
    return f"at most {_fmt(high)}{unit}"


def explain(
    pipeline: Pipeline,
    specs: list[FeatureSpec],
    inputs: dict[str, object],
    target_class: int | None = None,
) -> dict:
    """Explain one prediction.

    ``inputs`` maps feature name -> raw value (``None`` = not provided, will be imputed).
    ``target_class`` defaults to the predicted class.
    """
    pre: ColumnTransformer = pipeline.named_steps["pre"]
    model = pipeline.named_steps["model"]
    by_name = spec_index(specs)
    columns = encoded_columns(pre)
    fills = imputed_values(pre)

    frame = pd.DataFrame([{s.name: inputs.get(s.name) for s in specs}]).astype(float)
    encoded = pre.transform(frame)
    proba = model.predict_proba(encoded)[0]
    cls = int(np.argmax(proba)) if target_class is None else target_class

    # A Random Forest averages its trees' probabilities, so averaging each tree's path
    # contributions keeps the explanation exact (base + contributions == prediction).
    trees: list[DecisionTreeClassifier] = list(getattr(model, "estimators_", [model]))
    single = len(trees) == 1
    weight = 1.0 / len(trees)

    contrib: dict[str, float] = {}
    bounds: dict[str, list[float | None]] = {}  # numeric feature -> [low, high]
    category_tests: dict[str, list[tuple[str, bool]]] = {}  # feature -> [(category, is_equal)]
    order: list[str] = []
    base_rate = 0.0
    path_length = 0.0
    for tree in trees:
        t = tree.tree_
        values = t.value[:, 0, :]
        probs = values / values.sum(axis=1, keepdims=True)  # class proportions at each node
        path = tree.decision_path(encoded).indices
        base_rate += weight * float(probs[0, cls])
        path_length += weight * (len(path) - 1)

        # Walk the path, crediting each probability change to the feature tested at the split.
        for parent, child in zip(path[:-1], path[1:], strict=True):
            col = columns[t.feature[parent]]
            feat = col.feature
            if feat not in order:
                order.append(feat)
            change = float(probs[child, cls] - probs[parent, cls])
            contrib[feat] = contrib.get(feat, 0.0) + weight * change
            if not single:
                continue  # split thresholds differ between trees; only describe single trees

            threshold = float(t.threshold[parent])
            went_right = child == t.children_right[parent]  # right branch: value > threshold
            if col.category is not None:
                category_tests.setdefault(feat, []).append((col.category, went_right))
            elif by_name[feat].kind == "numeric":
                low, high = bounds.setdefault(feat, [None, None])
                if went_right:
                    bounds[feat][0] = threshold if low is None else max(low, threshold)
                else:
                    bounds[feat][1] = threshold if high is None else min(high, threshold)

    reasons: list[Reason] = []
    for feat in order:
        spec = by_name[feat]
        raw = inputs.get(feat)
        imputed = raw is None or (isinstance(raw, float) and np.isnan(raw))
        value = fills[feat] if imputed else raw
        shown = spec.describe_value(value)

        if feat in bounds:
            condition = _numeric_condition(spec, *bounds[feat])
            text = f"{spec.label} is {shown}, {condition}"
        elif feat in category_tests:
            equal = [c for c, eq in category_tests[feat] if eq]
            if equal:
                condition = f"is {spec.choices.get(equal[0], equal[0])}"
            else:
                names = [spec.choices.get(c, c) for c, _ in category_tests[feat]]
                condition = "is not " + " or ".join(names)
            text = f"{spec.label} {condition}"
        elif spec.kind == "binary":
            condition = f"is {shown}"
            text = f"{spec.label}: {shown}"
        else:  # numeric/categorical feature inside a forest
            condition = f"is {shown}"
            text = f"{spec.label} is {shown}"
        if imputed:
            text += " (not provided; typical value assumed)"
        reasons.append(
            Reason(feat, spec.label, shown, condition, text, round(contrib[feat], 4), imputed)
        )

    reasons.sort(key=lambda r: abs(r.contribution), reverse=True)
    return {
        "target_class": cls,
        "base_rate": round(base_rate, 4),
        "probability": round(float(proba[cls]), 4),
        "path_length": round(path_length, 1),
        "method": "decision path" if single else f"mean decision path over {len(trees)} trees",
        "reasons": [r.to_dict() for r in reasons],
    }
