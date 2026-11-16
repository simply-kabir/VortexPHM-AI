from __future__ import annotations
import numpy as np
import pandas as pd
from src.core.config import NOMINAL

DRIFT_RATE = 0.0005      # +0.05 % per cycle (brief)
SNR_DB = 32.0


def add_noise_snr(x: np.ndarray, snr_db: float, rng) -> np.ndarray:
    p_sig = np.var(x, axis=0) + 1e-12
    p_noise = p_sig / (10 ** (snr_db / 10))
    return x + rng.normal(0, np.sqrt(p_noise), size=x.shape)


def inject_drift(v: pd.DataFrame, col: str, start: int, rate: float = DRIFT_RATE) -> None:
    m = v["cycle"] >= start
    v.loc[m, col] = v.loc[m, col] * (1 + rate * (v.loc[m, "cycle"] - start))


def inject_step_bias(v: pd.DataFrame, col: str, start: int, frac: float = 0.01) -> None:
    v.loc[v["cycle"] >= start, col] *= (1 + frac)


def make_drift_units(df: pd.DataFrame, mean_cols: list[str], n_per_unit: int = 2,
                     min_len: int = 16, seed: int = 42) -> pd.DataFrame:
    """Copy the NOMINAL early segment of real units, inject a sensor fault, label it FAULT_SENSOR_DRIFT.
    Virtual units inherit the parent's split so train/test never mix."""
    rng = np.random.default_rng(seed)
    out = []
    for uid, g in df[df["fault_class"] == NOMINAL].groupby("uid"):
        if len(g) < min_len:
            continue
        for k in range(n_per_unit):
            v = g.copy()
            v[mean_cols] = v[mean_cols].astype("float64")      # injected values are float64 (pandas 3 refuses silent downcasts)
            v["group_unit"] = uid
            v["uid"] = f"{uid}-drift{k}"
            start = int(rng.integers(8, max(9, len(v) - 6))) + int(v["cycle"].min())   # after the 6-cycle baseline
            col = str(rng.choice(mean_cols))
            (inject_drift if k % 2 == 0 else inject_step_bias)(v, col, start)
            v[mean_cols] = add_noise_snr(v[mean_cols].to_numpy(), SNR_DB, rng)
            lag = 6 if k % 2 == 0 else 0            # slow drift needs about 6 cycles (0.3 %) to be measurable; a step bias is immediate
            v["fault_class"] = np.where(v["cycle"] >= start + lag, "FAULT_SENSOR_DRIFT", NOMINAL)
            v["onset_cycle"], v["fail_cycle"], v["rul"], v["is_virtual"] = start + lag, np.nan, np.nan, True
            out.append(v)
    if not out:
        raise ValueError("No nominal segment of at least min_len cycles; lower min_len or check the nominal labelling (hs / health parameters).")
    return pd.concat(out, ignore_index=True)
