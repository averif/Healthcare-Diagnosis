"""scikit-learn pipelines and hyperparameter grids for every candidate algorithm.

Preprocessing lives *inside* each pipeline, so imputation statistics are learned only from the
training fold (no data leakage) and the saved model accepts raw, unprocessed input.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.naive_bayes import BernoulliNB
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.tree import DecisionTreeClassifier

from .features import FeatureSpec
from .paths import RANDOM_STATE

PRIMARY = "decision_tree"


def build_preprocessor(features: list[FeatureSpec]) -> ColumnTransformer:
    numeric = [f.name for f in features if f.kind == "numeric"]
    binary = [f.name for f in features if f.kind == "binary"]
    categorical = [f.name for f in features if f.kind == "categorical"]

    transformers = []
    if numeric:
        transformers.append(("num", SimpleImputer(strategy="median"), numeric))
    if binary:
        transformers.append(("bin", SimpleImputer(strategy="most_frequent"), binary))
    if categorical:
        transformers.append(
            (
                "cat",
                Pipeline(
                    [
                        ("impute", SimpleImputer(strategy="most_frequent")),
                        (
                            "onehot",
                            OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                        ),
                    ]
                ),
                categorical,
            )
        )
    return ColumnTransformer(transformers, remainder="drop", verbose_feature_names_out=False)


@dataclass(frozen=True)
class Candidate:
    key: str
    label: str
    pipeline: Pipeline
    grid: dict[str, list]


def candidates(features: list[FeatureSpec], multiclass: bool) -> list[Candidate]:
    """The primary Decision Tree plus the baselines it is compared against."""
    pre = build_preprocessor
    weights = [None, "balanced"]

    tree_grid: dict[str, list] = {
        "model__criterion": ["gini", "entropy"],
        "model__max_depth": [2, 3, 4, 5, 6, 8, None],
        "model__min_samples_leaf": [1, 5, 10, 20],
        "model__ccp_alpha": [0.0, 0.005, 0.01],  # cost-complexity pruning
        "model__class_weight": weights,
    }
    if multiclass:
        # 41 diseases with 5-10 rows each: the tree is a long chain of "has symptom X?" splits,
        # roughly one per disease, so depth must not be capped and leaves must stay small.
        tree_grid["model__min_samples_leaf"] = [1, 2]
        tree_grid["model__max_depth"] = [None]
        tree_grid["model__ccp_alpha"] = [0.0, 0.001]

    result = [
        Candidate(
            PRIMARY,
            "Decision Tree",
            Pipeline(
                [
                    ("pre", pre(features)),
                    ("model", DecisionTreeClassifier(random_state=RANDOM_STATE)),
                ]
            ),
            tree_grid,
        ),
        Candidate(
            "logistic_regression",
            "Logistic Regression",
            Pipeline(
                [
                    ("pre", pre(features)),
                    ("scale", StandardScaler()),
                    ("model", LogisticRegression(max_iter=2000)),
                ]
            ),
            {"model__C": list(np.logspace(-2, 2, 5)), "model__class_weight": weights},
        ),
        Candidate(
            "random_forest",
            "Random Forest",
            Pipeline(
                [
                    ("pre", pre(features)),
                    (
                        "model",
                        RandomForestClassifier(n_estimators=200, random_state=RANDOM_STATE),
                    ),
                ]
            ),
            {
                "model__max_depth": [None, 6],
                "model__min_samples_leaf": [1, 5] if not multiclass else [1],
                "model__class_weight": weights,
            },
        ),
        Candidate(
            "majority_baseline",
            "Majority class (baseline)",
            Pipeline([("pre", pre(features)), ("model", DummyClassifier(strategy="prior"))]),
            {},
        ),
    ]
    if multiclass:
        result.insert(
            3,
            Candidate(
                "naive_bayes",
                "Bernoulli Naive Bayes",
                Pipeline([("pre", pre(features)), ("model", BernoulliNB())]),
                {"model__alpha": [0.01, 0.1, 1.0]},
            ),
        )
    return result


def one_standard_error_rule(cv_results: dict) -> int:
    """Pick the *simplest* tree whose score is within one standard error of the best.

    This is the classic CART parsimony rule (Breiman et al., 1984): a shallower tree that scores
    statistically the same as the best one generalises better and gives shorter, clearer
    explanations to patients and doctors.
    """
    means = np.asarray(cv_results["mean_test_score"], dtype=float)
    stds = np.asarray(cv_results["std_test_score"], dtype=float)
    n_splits = sum(1 for k in cv_results if k.startswith("split") and k.endswith("_test_score"))
    best = int(np.nanargmax(means))
    threshold = means[best] - stds[best] / np.sqrt(n_splits)

    depth = [99 if d is None else d for d in cv_results["param_model__max_depth"]]
    leaf = list(cv_results["param_model__min_samples_leaf"])
    eligible = [i for i in range(len(means)) if means[i] >= threshold]
    # simplest = smallest depth, then larger leaves, then highest score
    return min(eligible, key=lambda i: (depth[i], -leaf[i], -means[i]))
