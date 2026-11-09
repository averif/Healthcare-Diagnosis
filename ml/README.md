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
python ml/scripts/download_data.py      # from the repository root
pip install -r ml/requirements.txt      # training extras (Jupyter, plotting)
```

See [`docs/04-datasets.md`](../docs/04-datasets.md) for the data dictionary and known data-quality issues.
