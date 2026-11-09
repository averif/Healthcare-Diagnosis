"""Evaluation: hold-out metrics, nested cross-validation and the symptom robustness test."""

from __future__ import annotations

import warnings

import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.exceptions import UndefinedMetricWarning
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
    top_k_accuracy_score,
)
from sklearn.model_selection import (
    GridSearchCV,
    RepeatedStratifiedKFold,
    StratifiedKFold,
    cross_validate,
)
from sklearn.pipeline import Pipeline

from .paths import RANDOM_STATE
from .pipelines import PRIMARY, Candidate, one_standard_error_rule


def binary_metrics(y_true, y_pred, y_score) -> dict:
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    fpr, tpr, thr = roc_curve(y_true, y_score)
    return {
        "accuracy": round(accuracy_score(y_true, y_pred), 4),
        "balanced_accuracy": round(balanced_accuracy_score(y_true, y_pred), 4),
        "precision": round(precision_score(y_true, y_pred, zero_division=0), 4),
        "recall": round(recall_score(y_true, y_pred), 4),  # sensitivity
        "specificity": round(tn / (tn + fp), 4) if (tn + fp) else 0.0,
        "f1": round(f1_score(y_true, y_pred), 4),
        "roc_auc": round(roc_auc_score(y_true, y_score), 4),
        "confusion_matrix": [[int(tn), int(fp)], [int(fn), int(tp)]],
        "roc_curve": {
            "fpr": [round(float(x), 4) for x in fpr],
            "tpr": [round(float(x), 4) for x in tpr],
            "thresholds": [round(float(min(x, 1.0)), 4) for x in thr],
        },
        "support": {"negative": int(tn + fp), "positive": int(tp + fn)},
    }


def multiclass_metrics(y_true, y_proba, labels) -> dict:
    y_pred = np.asarray(labels)[np.argmax(y_proba, axis=1)]
    return {
        "accuracy": round(accuracy_score(y_true, y_pred), 4),
        "top3_accuracy": round(top_k_accuracy_score(y_true, y_proba, k=3, labels=labels), 4),
        "f1_macro": round(f1_score(y_true, y_pred, average="macro", zero_division=0), 4),
        "f1": round(f1_score(y_true, y_pred, average="macro", zero_division=0), 4),
        "support": len(y_true),
    }


def selection_metric(multiclass: bool) -> str:
    """Metric used to choose hyperparameters.

    Binary modules use balanced accuracy, (sensitivity + specificity) / 2. A trivial model scores
    0.5 whatever the class balance. F1 is gamed when the positive class is the majority: on the
    liver data (71% disease) "always predict disease" already reaches F1 = 0.83.
    """
    return "f1_macro" if multiclass else "balanced_accuracy"


def make_search(
    candidate: Candidate, multiclass: bool, inner_splits: int
) -> GridSearchCV | Pipeline:
    if not candidate.grid:
        return clone(candidate.pipeline)
    return GridSearchCV(
        clone(candidate.pipeline),
        candidate.grid,
        scoring=selection_metric(multiclass),
        cv=StratifiedKFold(inner_splits, shuffle=True, random_state=RANDOM_STATE),
        refit=one_standard_error_rule if candidate.key == PRIMARY else True,
        n_jobs=-1,
    )


def nested_cv(candidate: Candidate, X, y, multiclass: bool) -> dict:
    """Unbiased performance estimate: hyperparameters are tuned inside every outer fold."""
    if multiclass:
        outer = StratifiedKFold(5, shuffle=True, random_state=RANDOM_STATE)
        scoring = {"accuracy": "accuracy", "f1_macro": "f1_macro"}
        inner = 3
    else:
        outer = RepeatedStratifiedKFold(n_splits=5, n_repeats=2, random_state=RANDOM_STATE)
        scoring = {
            "accuracy": "accuracy",
            "balanced_accuracy": "balanced_accuracy",
            "precision": "precision",
            "recall": "recall",
            "f1": "f1",
            "roc_auc": "roc_auc",
        }
        inner = 5
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", category=UndefinedMetricWarning)
        scores = cross_validate(
            make_search(candidate, multiclass, inner), X, y, cv=outer, scoring=scoring, n_jobs=1
        )
    return {
        metric: {
            "mean": round(float(np.mean(scores[f"test_{metric}"])), 4),
            "std": round(float(np.std(scores[f"test_{metric}"])), 4),
        }
        for metric in scoring
    }


def hide_symptoms(X: pd.DataFrame, k: int, rng: np.random.Generator) -> pd.DataFrame:
    """Simulate a patient who reports only some symptoms: randomly hide up to k of them
    (always keeping at least two)."""
    values = X.to_numpy(copy=True)  # pandas 3 returns read-only views
    for row in values:
        present = np.flatnonzero(row)
        n_hide = min(k, max(len(present) - 2, 0))
        if n_hide:
            row[rng.choice(present, size=n_hide, replace=False)] = 0
    return pd.DataFrame(values, columns=X.columns, index=X.index)


def symptom_robustness(
    candidates: list[Candidate], params: dict[str, dict], X, y, hidden=(0, 1, 2, 3), repeats=5
) -> dict:
    """Top-1 / top-3 accuracy on unseen rows as more symptoms are hidden, per algorithm."""
    rng = np.random.default_rng(RANDOM_STATE)
    labels = np.unique(y)
    cv = StratifiedKFold(5, shuffle=True, random_state=RANDOM_STATE)
    results: dict[str, dict] = {}
    for cand in candidates:
        top1 = {k: [] for k in hidden}
        top3 = {k: [] for k in hidden}
        for train_idx, test_idx in cv.split(X, y):
            model = clone(cand.pipeline).set_params(**params.get(cand.key, {}))
            model.fit(X.iloc[train_idx], y.iloc[train_idx])
            for k in hidden:
                for _ in range(repeats if k else 1):
                    Xt = hide_symptoms(X.iloc[test_idx], k, rng)
                    proba = model.predict_proba(Xt)
                    yt = y.iloc[test_idx]
                    top1[k].append(accuracy_score(yt, labels[np.argmax(proba, axis=1)]))
                    top3[k].append(top_k_accuracy_score(yt, proba, k=3, labels=labels))
        results[cand.key] = {
            "label": cand.label,
            "hidden_symptoms": list(hidden),
            "top1": [round(float(np.mean(top1[k])), 4) for k in hidden],
            "top3": [round(float(np.mean(top3[k])), 4) for k in hidden],
        }
    return results
