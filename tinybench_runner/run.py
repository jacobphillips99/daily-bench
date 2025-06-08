from __future__ import annotations

import csv
import json
from datetime import datetime, timezone
from typing import Any, Iterable

import lm_eval  # type: ignore
from tinybench_runner.constants import BASE_FIELDS, METRICS_FILE, RAW_DIR
from tinybench_runner.harness import evaluate


def _mean_std(vals: Iterable[float]) -> tuple[float, float]:
    vals = list(vals)
    mean = sum(vals) / len(vals)
    var = sum((x - mean) ** 2 for x in vals) / len(vals)
    return mean, var ** 0.5


def run_bench(*, provider_interface: str, model: str) -> None:
    ts = datetime.now(tz=timezone.utc)
    metrics = evaluate(provider_interface=provider_interface, model=model)
    avg, std = _mean_std(metrics.values())

    raw_path = RAW_DIR / f"{ts:%Y-%m-%dT%H%MZ}-{model}.json"
    raw_path.write_text(json.dumps(metrics, indent=2))

    row: dict[str, Any] = {
        "date": ts.isoformat(timespec="seconds"),
        "model": model,
        "avg": avg,
        "std": std,
        **metrics,
    }

    file_exists = METRICS_FILE.exists()
    fieldnames = BASE_FIELDS + sorted([k for k in row if k not in BASE_FIELDS])
    with METRICS_FILE.open("a", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        if not file_exists:
            writer.writeheader()
        writer.writerow(row)
