"""Train, evaluate and export every disease model.

    python -m medml.train                 # all modules
    python -m medml.train diabetes heart  # selected modules
    python -m medml.train --fast          # skip nested CV (quick smoke run)

For each module this writes:
    ml/models/<disease>.joblib       deployed Decision Tree pipeline (preprocessing included)
    ml/models/<disease>.card.json    model card: data, hyperparameters, metrics, limitations
    ml/reports/<disease>/*.png       confusion matrix, ROC, importance, tree, comparison
and finally ml/reports/summary.md with the headline comparison table.
"""

from __future__ import annotations

import argparse
import json
import time
import warnings
from datetime import UTC, datetime

import joblib
import numpy as np
from sklearn.model_selection import GridSearchCV, train_test_split
from sklearn.tree import export_text

from . import plots
from .data import Dataset, load
from .evaluate import (
    binary_metrics,
    make_search,
    multiclass_metrics,
    nested_cv,
    selection_metric,
    symptom_robustness,
)
from .explain import encoded_columns, global_importance
from .inference import RISK_BANDS
from .paths import MODELS_DIR, RANDOM_STATE, REPORTS_DIR
from .pipelines import PRIMARY, candidates

MODEL_VERSION = "1.0.0"

#: Algorithm deployed per module (default: the primary Decision Tree).
DEPLOYED = {"symptom": "random_forest"}
DEPLOYMENT_RATIONALE = {
    "symptom": (
        "A single Decision Tree reached only ~0.6 top-1 accuracy on unseen symptom patterns: with "
        "131 sparse binary symptoms and 5-10 examples per disease it keys on individual symptoms "
        "that new patients often do not report. A Random Forest (an ensemble of 200 decision "
        "trees) scored ~1.0 and stayed above 0.9 top-1 / 0.99 top-3 with 3 symptoms hidden, so "
        "it is deployed for this module. Explanations remain exact (averaged tree paths)."
    ),
}
ALL = ["diabetes", "heart", "liver", "symptom"]

LIMITATIONS = {
    "diabetes": [
        "Trained only on adult women of Pima Indian heritage (age 21+); may not generalise to "
        "men, children or other populations.",
        "Insulin and skin thickness were missing for many records and were imputed.",
    ],
    "heart": [
        "Small dataset (303 patients from one US clinic, 1988).",
        "Several inputs (thallium test, fluoroscopy vessels, exercise ECG) need hospital tests.",
    ],
    "liver": [
        "Patients from one region of India; 76% male.",
        "The 'healthy' class are non-liver patients from the same hospital, "
        "not the general public.",
    ],
    "symptom": [
        "Synthetic-style dataset: only 305 unique symptom patterns for 41 diseases.",
        "Covers 41 conditions only; anything else will be mapped to the closest of these.",
        "Not suitable for emergencies; red-flag symptoms always trigger an urgent-care warning.",
    ],
}

INTENDED_USE = (
    "Preliminary clinical decision support and education. Outputs must be reviewed by a qualified "
    "healthcare professional and are not a diagnosis."
)


def log(msg: str) -> None:
    print(f"[{datetime.now():%H:%M:%S}] {msg}", flush=True)


def train_module(name: str, fast: bool) -> dict:
    data: Dataset = load(name)
    multiclass = not data.is_binary
    out_dir = REPORTS_DIR / name
    out_dir.mkdir(parents=True, exist_ok=True)
    log(f"{data.title}: {len(data.X)} rows, {data.X.shape[1]} features")

    X_train, X_test, y_train, y_test = train_test_split(
        data.X, data.y, test_size=0.2, stratify=data.y, random_state=RANDOM_STATE
    )
    labels = np.arange(len(data.class_names))

    comparison: dict[str, dict] = {}
    roc_curves: dict[str, dict] = {}
    best_params: dict[str, dict] = {}
    deployed_key = DEPLOYED.get(name, PRIMARY)
    searches: dict = {}
    for cand in candidates(data.features, multiclass):
        t0 = time.perf_counter()
        search = make_search(cand, multiclass, inner_splits=3 if multiclass else 5)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            search.fit(X_train, y_train)
        model = search.best_estimator_ if isinstance(search, GridSearchCV) else search
        params = search.best_params_ if isinstance(search, GridSearchCV) else {}
        best_params[cand.key] = params
        proba = model.predict_proba(X_test)
        if multiclass:
            test = multiclass_metrics(y_test, proba, labels)
        else:
            test = binary_metrics(y_test, (proba[:, 1] >= 0.5).astype(int), proba[:, 1])
            roc_curves[cand.label] = {**test["roc_curve"], "auc": test["roc_auc"]}
        entry = {"label": cand.label, "params": _jsonable(params), "test": test}
        if not fast:
            entry["cv"] = nested_cv(cand, data.X, data.y, multiclass)
        comparison[cand.key] = entry
        searches[cand.key] = search
        metric = "f1" if multiclass else "balanced_accuracy"
        log(
            f"  {cand.label:<28} test {metric}={test[metric]:.3f} ({time.perf_counter() - t0:.1f}s)"
        )

    deployed_search = searches[deployed_key]
    pipeline = deployed_search.best_estimator_
    model = pipeline.named_steps["model"]
    cv_res = deployed_search.cv_results_
    best_idx = int(np.nanargmax(cv_res["mean_test_score"]))
    trees = list(getattr(model, "estimators_", [model]))
    tree_stats = {
        "depth": max(int(t.get_depth()) for t in trees),
        "leaves": round(float(np.mean([t.get_n_leaves() for t in trees])), 1),
        "n_trees": len(trees),
    }

    robustness = None
    if multiclass:
        log("  robustness test (hiding symptoms) ...")
        robust_cands = [c for c in candidates(data.features, True) if c.key != "majority_baseline"]
        robustness = symptom_robustness(robust_cands, best_params, data.X, data.y)
        plots.robustness(robustness, out_dir / "robustness.png")

    importance = global_importance(pipeline)
    card = {
        "disease": name,
        "title": data.title,
        "version": MODEL_VERSION,
        "algorithm": type(model).__name__,
        "deployment_rationale": DEPLOYMENT_RATIONALE.get(name),
        "trained_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "intended_use": INTENDED_USE,
        "limitations": LIMITATIONS[name],
        "dataset": {
            "source": data.source,
            "raw_rows": data.raw_rows,
            "rows": len(data.X),
            "class_balance": data.class_balance(),
            "cleaning": data.cleaning_log,
            "split": {"train": len(X_train), "test": len(X_test), "stratified": True},
        },
        "feature_names": list(data.X.columns),
        "features": [f.to_dict() for f in data.features] if not multiclass else None,
        "class_names": data.class_names,
        "hyperparameters": _jsonable(best_params[deployed_key]),
        "model_selection": {
            "search": "GridSearchCV, stratified k-fold",
            "scoring": selection_metric(multiclass),
            "candidates_evaluated": len(cv_res["params"]),
            "refit_rule": (
                "one-standard-error (simplest tree within 1 SE of the best CV score)"
                if deployed_key == PRIMARY
                else "best mean CV score"
            ),
            "best_cv_score": round(float(cv_res["mean_test_score"][best_idx]), 4),
            "selected_cv_score": round(
                float(cv_res["mean_test_score"][deployed_search.best_index_]), 4
            ),
        },
        "tree": tree_stats,
        "evaluation": {
            "test": comparison[deployed_key]["test"],
            "nested_cv": comparison[deployed_key].get("cv"),
        },
        "comparison": comparison,
        "feature_importance": importance,
        "risk_bands": None if multiclass else {k: v for k, v in RISK_BANDS},
        "robustness": robustness,
    }

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, MODELS_DIR / f"{name}.joblib", compress=3)
    (MODELS_DIR / f"{name}.card.json").write_text(json.dumps(card, indent=2), encoding="utf-8")
    names = [
        c.feature + (f"={c.category}" if c.category else "")
        for c in encoded_columns(pipeline.named_steps["pre"])
    ]
    if len(trees) == 1:
        text = export_text(trees[0], feature_names=names)
        (out_dir / "tree.txt").write_text(text, encoding="utf-8")

    _figures(data, card, pipeline, roc_curves, out_dir, multiclass, fast)
    log(f"  saved {card['algorithm']} {tree_stats}")
    return card


def _figures(data, card, pipeline, roc_curves, out_dir, multiclass, fast) -> None:
    title = data.title
    test = card["evaluation"]["test"]
    plots.importance(
        card["feature_importance"],
        data.features,
        out_dir / "feature_importance.png",
        f"{title}: {card['algorithm'].removesuffix('Classifier')} feature importance",
    )
    if not multiclass:
        plots.confusion(
            test["confusion_matrix"],
            data.class_names,
            out_dir / "confusion_matrix.png",
            f"{title}: Decision Tree, hold-out test set",
        )
        plots.roc(roc_curves, out_dir / "roc_curve.png", f"{title}: ROC curves, hold-out test set")
        plots.tree_diagram(pipeline, data.features, data.class_names, out_dir / "tree.png")
    if not fast:
        metrics = (
            ["accuracy", "f1_macro"]
            if multiclass
            else ["accuracy", "balanced_accuracy", "recall", "f1", "roc_auc"]
        )
        plots.comparison(
            card["comparison"],
            metrics,
            out_dir / "model_comparison.png",
            f"{title}: nested cross-validation",
        )


def _jsonable(params: dict) -> dict:
    return {
        k.removeprefix("model__"): (v.item() if hasattr(v, "item") else v)
        for k, v in params.items()
    }


def write_summary() -> None:
    """Rebuild ml/reports/summary.md from every model card on disk."""
    cards = [
        json.loads((MODELS_DIR / f"{m}.card.json").read_text(encoding="utf-8"))
        for m in ALL
        if (MODELS_DIR / f"{m}.card.json").exists()
    ]

    def fmt(value: float | None) -> str:
        return "—" if value is None else f"{value:.3f}"

    lines = [
        "# Model evaluation summary",
        "",
        "_Generated by `python -m medml.train`. Do not edit by hand._",
        "",
        "## Deployed models (hold-out test set, 20%)",
        "",
        "| Module | Algorithm | Rows | Depth / leaves | Accuracy | Balanced acc. | Recall "
        "| Specificity | F1 | ROC AUC |",
        "|---|---|---|---|---|---|---|---|---|---|",
    ]
    for c in cards:
        t = c["evaluation"]["test"]
        tree = c["tree"]
        leaves = tree["leaves"] if tree["n_trees"] > 1 else int(tree["leaves"])
        size = f"{tree['depth']} / {leaves}" + (
            f" (mean of {tree['n_trees']} trees)" if tree["n_trees"] > 1 else ""
        )
        cells = [
            fmt(t.get(k))
            for k in ("accuracy", "balanced_accuracy", "recall", "specificity", "f1", "roc_auc")
        ]
        algorithm = c["algorithm"].removesuffix("Classifier")
        lines.append(
            f"| {c['title']} | {algorithm} | {c['dataset']['rows']} | {size} | "
            + " | ".join(cells)
            + " |"
        )
    for c in cards:
        if not c["evaluation"]["nested_cv"]:
            continue
        multiclass = c["disease"] == "symptom"
        metrics = (
            ["accuracy", "f1_macro"]
            if multiclass
            else ["accuracy", "balanced_accuracy", "recall", "f1", "roc_auc"]
        )
        lines += [
            "",
            f"## {c['title']}: algorithm comparison (nested CV, mean ± sd)",
            "",
            "| Algorithm | " + " | ".join(m.replace("_", " ") for m in metrics) + " |",
            "|---|" + "---|" * len(metrics),
        ]
        for res in c["comparison"].values():
            cells = [f"{res['cv'][m]['mean']:.3f} ± {res['cv'][m]['std']:.3f}" for m in metrics]
            lines.append(f"| {res['label']} | " + " | ".join(cells) + " |")
        if c.get("robustness"):
            lines += [
                "",
                "Robustness: top-1 / top-3 accuracy on unseen rows with 0, 1, 2, 3 symptoms hidden",
                "",
                "| Algorithm | 0 hidden | 1 hidden | 2 hidden | 3 hidden |",
                "|---|---|---|---|---|",
            ]
            for r in c["robustness"].values():
                cells = [f"{a:.2f} / {b:.2f}" for a, b in zip(r["top1"], r["top3"], strict=True)]
                lines.append(f"| {r['label']} | " + " | ".join(cells) + " |")
    (REPORTS_DIR / "summary.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Train MediAssist models")
    parser.add_argument("modules", nargs="*", default=ALL, choices=ALL)
    parser.add_argument("--fast", action="store_true", help="skip nested cross-validation")
    args = parser.parse_args()

    for module in args.modules:
        train_module(module, args.fast)
    write_summary()
    log("done")


if __name__ == "__main__":
    main()
