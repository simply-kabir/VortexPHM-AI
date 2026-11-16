from __future__ import annotations
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from src.core.config import T_REF_R, P_REF_PSIA

NC_TEMPS, NC_PRESS = ["T24", "T30", "T48", "T50"], ["P15", "P21", "P24", "Ps30", "P40", "P50"]
NC_SPEEDS, NC_FLOWS = ["Nf", "Nc"], ["Wf"]
CM_TEMPS, CM_PRESS, CM_SPEEDS, CM_FLOWS = ["T24", "T30", "T50"], ["P15", "P30", "Ps30"], ["Nf", "Nc"], []


def add_corrected(df, temps, press, speeds, flows=(), t2="T2", p2="P2") -> pd.DataFrame:
    """Aerodynamic corrections using fan-inlet total T2/P2 (units: Rankine / psia)."""
    theta = df[t2] / T_REF_R
    delta = df[p2] / P_REF_PSIA
    out = df.copy()
    for c in temps:  out[c + "_c"] = df[c] / theta
    for c in press:  out[c + "_c"] = df[c] / delta
    for c in speeds: out[c + "_c"] = df[c] / np.sqrt(theta)
    for c in flows:  out[c + "_c"] = df[c] / (delta * np.sqrt(theta))
    return out


def assign_cmapss_regimes(df: pd.DataFrame, n_regimes: int = 6, km: KMeans | None = None):
    """FD002/FD004 have 6 operating regimes; FD001/FD003 have 1 (use n_regimes=1)."""
    ops = df[["op1", "op2", "op3"]].to_numpy()
    if km is None:
        km = KMeans(n_regimes, n_init=10, random_state=42).fit(ops)
    out = df.copy()
    out["Fc"] = km.predict(ops)
    return out, km


class RegimeNormalizer:
    """Per-regime z-scoring using NOMINAL data only. Fit on train nominal, apply everywhere."""

    def __init__(self, cols: list[str], regime_col: str = "Fc"):
        self.cols, self.regime_col = cols, regime_col

    def fit(self, df_nominal: pd.DataFrame):
        g = df_nominal.groupby(self.regime_col)[self.cols]
        self.mean_ = g.mean()
        self.std_ = g.std().replace(0, np.nan).fillna(1.0)
        return self

    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        m = self.mean_.reindex(df[self.regime_col]).to_numpy()
        s = self.std_.reindex(df[self.regime_col]).to_numpy()
        z = (df[self.cols].to_numpy() - m) / (s + 1e-9)
        zdf = pd.DataFrame(z, columns=[c + "_z" for c in self.cols], index=df.index)
        return pd.concat([df, zdf], axis=1)
