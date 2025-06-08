from pathlib import Path

RESULTS_DIR = Path("results")
RAW_DIR = RESULTS_DIR / "raw"
RESULTS_DIR.mkdir(exist_ok=True)
RAW_DIR.mkdir(exist_ok=True)

METRICS_FILE = RESULTS_DIR / "metrics.csv"
BASE_FIELDS = ["date", "model", "avg", "std"]