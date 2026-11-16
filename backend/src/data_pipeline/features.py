import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge


def add_temporal_features(df: pd.DataFrame, cols: list[str], w: int = 10) -> pd.DataFrame:
    """Past-only rolling mean and slope per engine (no leakage)."""
    df = df.sort_values(["uid", "cycle"]).reset_index(drop=True)
    rm = df.groupby("uid")[cols].rolling(w, min_periods=3).mean().reset_index(level=0, drop=True)
    prev = rm.groupby(df["uid"]).shift(w)
    sl = ((rm - prev) / w).fillna(0.0)
    rm = rm.fillna(0.0)                                   # z-scored data: 0 == nominal mean
    rm.columns = [f"{c}_rm{w}" for c in cols]
    sl.columns = [f"{c}_sl{w}" for c in cols]
    return pd.concat([df, rm, sl], axis=1)


def engine_baseline(df: pd.DataFrame, cols: list[str], k: int = 6) -> pd.DataFrame:
    """Subtract each engine's OWN mean over its first k cycles (commissioning baseline).
    Every N-CMAPSS engine starts at a slightly different health level, so a fleet-wide z-score leaves large
    engine-to-engine offsets that detectors mistake for anomalies. After this step 'nominal' means
    'close to this engine's own start of life'. Only the first k cycles are used (they are nominal)."""
    d = df.sort_values(["uid", "cycle"])
    base = d.groupby("uid").head(k).groupby("uid")[cols].mean()
    out = df.copy()
    out[cols] = out[cols].to_numpy() - base.reindex(out["uid"]).to_numpy()
    return out


def add_residual_features(df: pd.DataFrame, zmean_cols: list[str], fit_mask: pd.Series) -> pd.DataFrame:
    """Analytical redundancy: predict each sensor from all the others with a ridge model fitted on nominal
    training data and keep the residual. A drifting single sensor produces a large residual on itself; real
    degradation moves a correlated set of sensors, which the cross-sensor model explains better.
    New columns: <sensor>_c_mean_res_z (they end in _z so every later step picks them up)."""
    X = df[zmean_cols].to_numpy(dtype=float)
    fm = fit_mask.to_numpy()
    res = np.zeros_like(X)
    for j in range(X.shape[1]):
        others = [i for i in range(X.shape[1]) if i != j]
        m = Ridge(alpha=1.0).fit(X[fm][:, others], X[fm][:, j])
        res[:, j] = X[:, j] - m.predict(X[:, others])
    new = [c[:-2] + "_res_z" for c in zmean_cols]
    return pd.concat([df, pd.DataFrame(res, columns=new, index=df.index)], axis=1)
