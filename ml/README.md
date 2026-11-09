# ML pipeline

| Folder | Purpose |
|---|---|
| `scripts/download_data.py` | Fetches the raw datasets and verifies SHA-256 checksums |
| `data/raw/` | Original, untouched dataset files (committed; all are small) |
| `data/processed/` | Cleaned data produced by the pipeline (not committed) |
| `notebooks/` | Exploratory data analysis, one notebook per disease (Phase 2) |
| `src/medml/` | Reusable preprocessing, training, evaluation and explanation code (Phase 2) |
| `models/` | Trained `.joblib` models plus a JSON model card for each |
| `reports/` | Generated evaluation plots and metric tables for the final report |

```bash
# from the repository root, with the shared .venv active
python ml/scripts/download_data.py      # fetch + verify datasets
pip install -r ml/requirements.txt      # training extras (Jupyter, plotting)
pip install -e ml                       # installs the `medml` package (also used by the backend)

python -m medml.train                   # train all 4 modules (~5 min, nested CV)
python -m medml.train heart --fast      # one module, skip nested CV
pytest ml/tests                         # data, explainer and inference tests
jupyter lab ml/notebooks                # exploratory data analysis
```

## How a model is built

1. **Load and clean** (`data.py`): zeros as missing, duplicates removed, labels remapped, typos fixed.
2. **Split** 80 / 20, stratified by class, fixed seed 42.
3. **Tune** a Decision Tree with `GridSearchCV` (depth, leaf size, split criterion, cost-complexity
   pruning, class weights) using F1. The **one-standard-error rule** then picks the simplest tree
   that scores within 1 SE of the best: shorter trees give shorter, clearer explanations.
4. **Compare** against Logistic Regression, Random Forest, a majority-class baseline (and Naive
   Bayes for symptoms) using **nested cross-validation**, so tuning never sees the scoring fold.
5. **Export** the pipeline (preprocessing included) to `models/<disease>.joblib` and a
   **model card** (`models/<disease>.card.json`) with data provenance, hyperparameters, metrics,
   ROC curve, confusion matrix, feature importance and limitations.

## Explanations

`explain.py` follows the patient's path through the tree and credits each change in predicted
probability to the feature tested at that split. The contributions add up **exactly** to the
prediction (tested in `tests/test_explain.py`), so the reasons are faithful, not approximate.

```text
Diabetic, probability 0.88 (high risk)
  +0.458  Plasma glucose (2-h OGTT) is 168 mg/dL, above 166.5 mg/dL
  -0.040  Number of pregnancies is 2, at most 6.5
  -0.036  2-hour serum insulin is 125 µU/mL, at most 139.5 µU/mL (not provided; typical value assumed)
```

See [`docs/04-datasets.md`](../docs/04-datasets.md) for the data dictionary and known data-quality issues.
