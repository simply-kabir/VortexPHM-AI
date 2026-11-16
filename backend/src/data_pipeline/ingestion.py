from __future__ import annotations
from pathlib import Path
import h5py
import numpy as np
import pandas as pd

# ---------------- C-MAPSS ----------------
CMAPSS_SENSORS = ["T2", "T24", "T30", "T50", "P2", "P15", "P30", "Nf", "Nc", "epr", "Ps30", "phi",
                  "NRf", "NRc", "BPR", "farB", "htBleed", "Nf_dmd", "PCNfR_dmd", "W31", "W32"]
CMAPSS_COLS = ["unit", "cycle", "op1", "op2", "op3"] + CMAPSS_SENSORS


def load_cmapss(raw_dir: Path, subset: str = "FD001") -> tuple[pd.DataFrame, pd.DataFrame]:
    tr = pd.read_csv(raw_dir / f"train_{subset}.txt", sep=r"\s+", header=None, names=CMAPSS_COLS)
    te = pd.read_csv(raw_dir / f"test_{subset}.txt", sep=r"\s+", header=None, names=CMAPSS_COLS)
    rul_end = pd.read_csv(raw_dir / f"RUL_{subset}.txt", header=None).iloc[:, 0].to_numpy()
    for d in (tr, te):
        d[["unit", "cycle"]] = d[["unit", "cycle"]].astype(int)      # robust to files written with float formatting
    tr["rul"] = tr.groupby("unit")["cycle"].transform("max") - tr["cycle"]
    last = te.groupby("unit")["cycle"].transform("max")
    te["rul"] = (last - te["cycle"]) + te["unit"].map(lambda u: rul_end[u - 1])
    return tr, te


# ---------------- N-CMAPSS ----------------
def _names(f: h5py.File, key: str) -> list[str]:
    return [n.decode() if isinstance(n, bytes) else str(n) for n in np.array(f[key]).ravel()]


def load_ncmapss(h5_path: Path, split: str = "dev", stride: int = 10) -> pd.DataFrame:
    """One row per sampled second. stride=10 keeps RAM sane (data is 1 Hz)."""
    with h5py.File(h5_path, "r") as f:
        parts = []
        for key in ["W", "X_s", "T", "A"]:
            arr = f[f"{key}_{split}"][::stride]
            parts.append(pd.DataFrame(arr, columns=_names(f, f"{key}_var")))
        df = pd.concat(parts, axis=1)
        df["rul"] = np.array(f[f"Y_{split}"][::stride]).ravel()
    ds = h5_path.stem.split("_")[-1]                       # e.g. DS02-006
    df["uid"] = ds + "-" + split[:1] + "-u" + df["unit"].astype(int).astype(str)
    df["cycle"] = df["cycle"].astype(int)
    df["split"] = split
    return df.astype({c: "float32" for c in df.select_dtypes("float64").columns})


def aggregate_cycles(df: pd.DataFrame, sensor_cols: list[str]) -> pd.DataFrame:
    """1 Hz flight data -> one row per (uid, cycle): mean & std of each corrected sensor."""
    g = df.groupby(["uid", "cycle"], sort=True)
    mean = g[sensor_cols].mean().add_suffix("_mean")
    std = g[sensor_cols].std().fillna(0.0).add_suffix("_std")
    health = [c for c in df.columns if c.endswith("_mod")]
    keep = [c for c in (["Fc", "hs", "rul", "split"] + health) if c in df.columns]
    meta = g[keep].last()
    return pd.concat([mean, std, meta], axis=1).reset_index()
