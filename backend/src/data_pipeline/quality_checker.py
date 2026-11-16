from __future__ import annotations
import numpy as np
import pandas as pd

PHYSICS_NC = [("P2", "P24"), ("P24", "P30"), ("T2", "T24"), ("T24", "T30")]   # lhs < rhs (N-CMAPSS)
PHYSICS_CM = [("P2", "P15"), ("P15", "P30"), ("T2", "T24"), ("T24", "T30")]   # lhs < rhs (C-MAPSS)


def completeness(df: pd.DataFrame, cols: list[str]) -> float:
    return float(1.0 - df[cols].isna().to_numpy().mean())


def physics_violations(df: pd.DataFrame, rules) -> dict[str, float]:
    return {f"{a}<{b}": float((df[a] >= df[b]).mean()) for a, b in rules if a in df and b in df}


def find_stuck(df: pd.DataFrame, cols: list[str], window: int = 15) -> dict[str, int]:
    """Flag sensors that vary globally but go perfectly flat inside a per-engine window.
    Sensors constant across the whole dataset are 'constant by design' (C-MAPSS has several) and are skipped."""
    flagged = {}
    d = df.sort_values(["uid", "cycle"])
    for c in cols:
        if d[c].nunique() <= 1:
            continue
        s = d.groupby("uid")[c].rolling(window).std()
        n = int((s == 0).sum())
        if n:
            flagged[c] = n
    return flagged


def build_report(comp: float, physics: dict, stuck: dict, sample_rows: int) -> dict:
    ok = comp >= 0.9998 and all(v == 0 for v in physics.values()) and not stuck
    return dict(completeness=comp, physics_violation_rate=physics, stuck_sensors=stuck,
                rows_checked=sample_rows, passed=bool(ok))
