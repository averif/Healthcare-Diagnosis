"""Download the four raw datasets into ml/data/raw and verify their checksums.

Usage (from the repository root):
    python ml/scripts/download_data.py           # download missing files, verify all
    python ml/scripts/download_data.py --force   # re-download everything

Only the Python standard library is used, so this works before any packages are installed.
"""

from __future__ import annotations

import argparse
import hashlib
import sys
import urllib.request
from dataclasses import dataclass
from pathlib import Path

RAW_DIR = Path(__file__).resolve().parents[1] / "data" / "raw"


@dataclass(frozen=True)
class Dataset:
    filename: str
    url: str
    sha256: str  # empty string = not pinned yet (prints the hash so it can be pinned)
    citation: str


DATASETS = [
    Dataset(
        filename="diabetes_pima.csv",
        url="https://raw.githubusercontent.com/plotly/datasets/master/diabetes.csv",
        sha256="698c203a14aa31941d2251175330c9199f3ccdb31597abbba2a3e35416257a72",
        citation="Pima Indians Diabetes Database, National Institute of Diabetes and Digestive "
        "and Kidney Diseases; Smith et al. (1988).",
    ),
    Dataset(
        filename="heart_cleveland.data",
        url="https://archive.ics.uci.edu/ml/machine-learning-databases/heart-disease/"
        "processed.cleveland.data",
        sha256="a74b7efa387bc9d108d7d0115d831fe9b414b29ae7124f331b622b4efa0427c8",
        citation="Janosi, A., Steinbrunn, W., Pfisterer, M., Detrano, R. (1988). Heart Disease. "
        "UCI Machine Learning Repository. https://doi.org/10.24432/C52P4X",
    ),
    Dataset(
        filename="liver_ilpd.csv",
        url="https://archive.ics.uci.edu/ml/machine-learning-databases/00225/"
        "Indian%20Liver%20Patient%20Dataset%20(ILPD).csv",
        sha256="84feac16488de5cf89bd22bd802c77f25841fe93e9ddd32355683e94d46c3425",
        citation="Ramana, B., Venkateswarlu, N. (2012). ILPD (Indian Liver Patient Dataset). "
        "UCI Machine Learning Repository. https://doi.org/10.24432/C5D02C",
    ),
    Dataset(
        filename="symptoms_train.csv",
        url="https://raw.githubusercontent.com/anujdutt9/Disease-Prediction-from-Symptoms/"
        "master/dataset/training_data.csv",
        sha256="ed0017701c9ed78f8342871e743f1ce39351f30612f620aefdccc398ee1c4f27",
        citation="Disease Prediction Using Machine Learning (132 symptoms, 41 diseases), "
        "Kaggle; mirrored by anujdutt9/Disease-Prediction-from-Symptoms on GitHub.",
    ),
    Dataset(
        filename="symptoms_test.csv",
        url="https://raw.githubusercontent.com/anujdutt9/Disease-Prediction-from-Symptoms/"
        "master/dataset/test_data.csv",
        sha256="3b9d0dda2a870e7cf6273c41e40ebd2a7f5634434a120840e96223a1dd80b0b7",
        citation="Hold-out split of the same symptom dataset.",
    ),
]


def sha256_of(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def download(ds: Dataset, force: bool) -> bool:
    target = RAW_DIR / ds.filename
    if force or not target.exists():
        print(f"downloading {ds.filename} ...")
        request = urllib.request.Request(ds.url, headers={"User-Agent": "mediassist-data-fetch"})
        with urllib.request.urlopen(request, timeout=60) as response:
            target.write_bytes(response.read())

    digest = sha256_of(target)
    if ds.sha256 and digest != ds.sha256:
        print(f"  CHECKSUM MISMATCH for {ds.filename}: {digest}", file=sys.stderr)
        return False
    status = "verified" if ds.sha256 else f"unpinned sha256={digest}"
    print(f"  ok {ds.filename} ({target.stat().st_size:,} bytes, {status})")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="re-download existing files")
    args = parser.parse_args()

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    results = [download(ds, args.force) for ds in DATASETS]
    return 0 if all(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
