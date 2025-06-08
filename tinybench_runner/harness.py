# tinybench_runner/harness.py
from __future__ import annotations

from pathlib import Path    # ← the missing import

import json
from typing import Any, Iterable

import lm_eval


def evaluate(
    *,
    provider_interface: str,
    model: str,
    tasks: Iterable[str] | None = None,
    shots: int = 0,
) -> dict[str, Any]:
    """
    thin wrapper around lm‑eval‑harness’s simple_evaluate.
    returns raw task‑level metrics only.
    """
    if tasks is None:
        tasks = ["helm_lite"]

    res = lm_eval.simple_evaluate(
        model=provider_interface,
        model_args={"model": model},
        tasks=list(tasks),
        num_fewshot=shots,
    )
    return {t: res["results"][t] for t in tasks}


def save_json(data: dict[str, Any], path: str | Path) -> None:
    """serialize evaluation result to pretty‑printed json."""
    path = Path(path)
    path.write_text(json.dumps(data, indent=2))
