# 4. Datasets

All raw files are downloaded by [`ml/scripts/download_data.py`](../ml/scripts/download_data.py),
which verifies a pinned SHA-256 checksum for each, so every team member trains on identical data.

| Module | Dataset | Rows | Features | Target | Source |
|---|---|---|---|---|---|
| Diabetes | Pima Indians Diabetes | 768 | 8 numeric | `Outcome` (0/1) | NIDDK; Smith et al. 1988 |
| Heart | UCI Heart Disease, Cleveland subset | 303 | 13 (mixed) | `num` 0–4 → binary (0 = none, 1–4 = disease) | Janosi et al. 1988, UCI ML Repository |
| Liver | Indian Liver Patient Dataset (ILPD) | 583 | 10 (mixed) | `Selector` 1 = disease, 2 = no disease | Ramana & Venkateswarlu 2012, UCI ML Repository |
| Symptoms | Disease Prediction from Symptoms | 4,920 train + 42 test | 131 binary symptoms (132 columns, one a duplicate) | `prognosis` (41 diseases) | Kaggle (GitHub mirror) |

## 4.1 Data-quality findings (initial profiling)

These issues were found while profiling the raw files in Phase 1. They are handled in Phase 2
and discussed in the report, because ignoring them is a common source of misleadingly high
accuracy in student projects.

### Diabetes (Pima)
- **Hidden missing values.** Zero is physiologically impossible for several fields but appears as
  a placeholder: `Insulin` 374 zeros (48.7 %), `SkinThickness` 227 (29.6 %), `BloodPressure` 35,
  `BMI` 11, `Glucose` 5. **Plan:** convert these zeros to missing and impute with the training-fold median
  inside the pipeline (no leakage). Also compare against dropping `Insulin` and `SkinThickness`.
- **Class imbalance:** 500 negative vs 268 positive (65 / 35). **Plan:** stratified splits, and
  `class_weight="balanced"` tried during tuning. Report recall and F1, not just accuracy.

### Heart disease (Cleveland)
- 6 missing values (`ca` 4, `thal` 2), encoded as `?`. **Plan:** impute (most frequent).
- Target is 0–4 severity. **Plan:** binarise to presence/absence (164 vs 139, roughly balanced),
  which matches the standard benchmark setup.
- Categorical codes (`cp`, `restecg`, `slope`, `thal`) are one-hot encoded so the tree does not
  treat them as ordered numbers.
- We use the original UCI Cleveland file rather than the popular 1,025-row Kaggle version, which
  is made of repeated copies of the same patients and inflates test accuracy through leakage.

### Liver (ILPD)
- **13 exact duplicate rows**, removed before splitting so the same patient cannot appear in both
  train and test.
- 4 missing values in the albumin/globulin ratio. **Plan:** median imputation.
- Class imbalance: 416 disease vs 167 non-disease (71 / 29). Gender skew: 441 male vs 142 female.
  Both are noted as limitations in the model card.
- Label encoding is inverted relative to convention (1 = disease, 2 = healthy). **Plan:** remap to 1 / 0.

### Symptoms
- **Massive duplication: only 304 of the 4,920 training rows are unique** (each of the 41 diseases
  has exactly 120 rows built from a few symptom templates).
- **41 of the 42 "test" rows are identical to a training row.** A model scores about 100 % on this
  test set while learning almost nothing transferable.
- A trailing empty column (`Unnamed: 133`) and a typo'd column name (`spotting_ urination`) need cleaning.
- **Plan:**
  - deduplicate before splitting;
  - evaluate with grouped cross-validation;
  - add a **robustness test** that randomly removes 1–3 reported symptoms, mimicking real patients who report only some of them;
  - report honest top-1 and top-3 accuracy.

## 4.2 Feature dictionary (used to build input forms and validation ranges)

### Diabetes
| Feature | Unit | Plausible input range |
|---|---|---|
| Pregnancies | count | 0–20 |
| Glucose (2-h OGTT plasma) | mg/dL | 40–300 |
| BloodPressure (diastolic) | mm Hg | 30–140 |
| SkinThickness (triceps) | mm | 5–100 |
| Insulin (2-h serum) | µU/mL | 10–900 |
| BMI | kg/m² | 10–70 |
| DiabetesPedigreeFunction | score | 0.05–2.5 |
| Age | years | 18–100 |

### Heart
| Feature | Meaning | Values |
|---|---|---|
| age | Age | 18–100 years |
| sex | Sex | 0 = female, 1 = male |
| cp | Chest pain type | 1 typical angina, 2 atypical, 3 non-anginal, 4 asymptomatic |
| trestbps | Resting blood pressure | 80–220 mm Hg |
| chol | Serum cholesterol | 100–600 mg/dL |
| fbs | Fasting blood sugar > 120 mg/dL | 0 / 1 |
| restecg | Resting ECG | 0 normal, 1 ST-T abnormality, 2 LV hypertrophy |
| thalach | Max heart rate achieved | 60–220 bpm |
| exang | Exercise-induced angina | 0 / 1 |
| oldpeak | ST depression (exercise vs rest) | 0–7 |
| slope | Slope of peak exercise ST | 1 up, 2 flat, 3 down |
| ca | Major vessels coloured by fluoroscopy | 0–3 |
| thal | Thalassemia | 3 normal, 6 fixed defect, 7 reversible defect |

### Liver
| Feature | Unit | Plausible input range |
|---|---|---|
| Age | years | 4–90 |
| Gender | Male / Female | |
| Total Bilirubin | mg/dL | 0.1–80 |
| Direct Bilirubin | mg/dL | 0.1–20 |
| Alkaline Phosphotase | IU/L | 50–2500 |
| Alamine Aminotransferase (ALT) | IU/L | 5–2000 |
| Aspartate Aminotransferase (AST) | IU/L | 5–5000 |
| Total Proteins | g/dL | 2–10 |
| Albumin | g/dL | 0.5–6 |
| Albumin/Globulin Ratio | ratio | 0.2–3 |

### Symptoms
131 binary symptom flags (e.g. `itching`, `high_fever`, `chest_pain`, `yellowing_of_eyes`). The
UI offers a searchable multi-select with human-readable labels. A set of **red-flag symptoms**
(e.g. `chest_pain`, `breathlessness`, `coma`, `stomach_bleeding`) always triggers an urgent-care
warning, regardless of the model's output.
