"""Figures for the model performance page and the final report (PNG, 150 dpi)."""

from __future__ import annotations

from pathlib import Path

import matplotlib

matplotlib.use("Agg")  # headless: no GUI needed

import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from sklearn.pipeline import Pipeline  # noqa: E402
from sklearn.tree import plot_tree  # noqa: E402

from .explain import encoded_columns  # noqa: E402
from .features import FeatureSpec, spec_index  # noqa: E402

BRAND = "#0d8574"
GREY = "#94a3b8"
plt.rcParams.update({"figure.dpi": 150, "axes.spines.top": False, "axes.spines.right": False})


def _save(fig, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.tight_layout()
    fig.savefig(path, bbox_inches="tight")
    plt.close(fig)


def confusion(cm: list[list[int]], class_names: list[str], path: Path, title: str) -> None:
    cm_arr = np.asarray(cm)
    fig, ax = plt.subplots(figsize=(4.2, 3.6))
    ax.imshow(cm_arr, cmap="Greens")
    for (i, j), v in np.ndenumerate(cm_arr):
        color = "white" if v > cm_arr.max() / 2 else "black"
        ax.text(j, i, str(v), ha="center", va="center", fontsize=13, color=color)
    ax.set_xticks([0, 1], [f"Pred.\n{c}" for c in class_names], fontsize=8)
    ax.set_yticks([0, 1], [f"Actual\n{c}" for c in class_names], fontsize=8)
    ax.set_title(title, fontsize=10)
    _save(fig, path)


def roc(curves: dict[str, dict], path: Path, title: str) -> None:
    """curves: label -> {"fpr": [...], "tpr": [...], "auc": float}"""
    fig, ax = plt.subplots(figsize=(4.5, 4))
    for i, (label, c) in enumerate(curves.items()):
        ax.plot(
            c["fpr"],
            c["tpr"],
            lw=2.2 if i == 0 else 1.2,
            color=BRAND if i == 0 else None,
            label=f"{label} (AUC {c['auc']:.2f})",
        )
    ax.plot([0, 1], [0, 1], ls="--", color=GREY, lw=1)
    ax.set_xlabel("False positive rate (1 - specificity)")
    ax.set_ylabel("True positive rate (sensitivity)")
    ax.set_title(title, fontsize=10)
    ax.legend(fontsize=7, loc="lower right")
    _save(fig, path)


def importance(items: list[dict], specs: list[FeatureSpec], path: Path, title: str, top=12) -> None:
    by_name = spec_index(specs)
    items = [i for i in items if i["importance"] > 0][:top][::-1]
    fig, ax = plt.subplots(figsize=(5.5, 0.35 * len(items) + 1))
    ax.barh(
        [by_name[i["feature"]].label for i in items], [i["importance"] for i in items], color=BRAND
    )
    ax.set_xlabel("Importance (share of impurity reduction)")
    ax.set_title(title, fontsize=10)
    _save(fig, path)


def comparison(nested: dict[str, dict], metrics: list[str], path: Path, title: str) -> None:
    labels = [v["label"] for v in nested.values()]
    x = np.arange(len(metrics))
    width = 0.8 / len(labels)
    fig, ax = plt.subplots(figsize=(7, 3.6))
    for i, (key, res) in enumerate(nested.items()):
        means = [res["cv"][m]["mean"] for m in metrics]
        stds = [res["cv"][m]["std"] for m in metrics]
        color = {"decision_tree": BRAND, "majority_baseline": GREY}.get(key)
        ax.bar(x + i * width, means, width, yerr=stds, capsize=2, label=labels[i], color=color)
    ax.set_xticks(x + width * (len(labels) - 1) / 2, [m.replace("_", " ") for m in metrics])
    ax.set_ylim(0, 1.05)
    ax.set_ylabel("Nested CV score (mean ± sd)")
    ax.set_title(title, fontsize=10, pad=24)
    ax.legend(
        fontsize=7, ncol=len(labels), loc="lower center", bbox_to_anchor=(0.5, 1.0), frameon=False
    )
    _save(fig, path)


def tree_diagram(pipeline: Pipeline, specs: list[FeatureSpec], class_names, path: Path, depth=3):
    by_name = spec_index(specs)
    names = []
    for col in encoded_columns(pipeline.named_steps["pre"]):
        label = by_name[col.feature].label
        if col.category is not None:
            label += f" = {by_name[col.feature].choices.get(col.category, col.category)}"
        names.append(label)
    fig, ax = plt.subplots(figsize=(16, 7))
    plot_tree(
        pipeline.named_steps["model"],
        feature_names=names,
        class_names=class_names,
        max_depth=depth,
        filled=True,
        rounded=True,
        impurity=False,
        proportion=True,
        fontsize=7,
        ax=ax,
    )
    _save(fig, path)


def robustness(results: dict[str, dict], path: Path) -> None:
    fig, axes = plt.subplots(1, 2, figsize=(8, 3.4), sharey=True)
    for ax, metric, title in zip(
        axes, ["top1", "top3"], ["Top-1 accuracy", "Top-3 accuracy"], strict=True
    ):
        for key, res in results.items():
            ax.plot(
                res["hidden_symptoms"],
                res[metric],
                marker="o",
                lw=2.2 if key == "decision_tree" else 1.2,
                color=BRAND if key == "decision_tree" else None,
                label=res["label"],
            )
        ax.set_title(title, fontsize=10)
        ax.set_xlabel("Symptoms hidden per patient")
        ax.set_xticks(results[next(iter(results))]["hidden_symptoms"])
    axes[0].set_ylabel("Accuracy on unseen rows")
    axes[0].set_ylim(0, 1.05)
    axes[1].legend(fontsize=7)
    _save(fig, path)
