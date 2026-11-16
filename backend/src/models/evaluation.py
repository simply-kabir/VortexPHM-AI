from __future__ import annotations
import numpy as np, pandas as pd
from src.core.config import PERSIST_K, PERSIST_N, NOMINAL


def evaluate_alarms(df, score_col, thr, k=PERSIST_K, n=PERSIST_N) -> pd.DataFrame:
    """Per-engine alarm evaluation. Alarm = >=k flags in the last n cycles.
    False alarm = persistent alarm BEFORE onset. Lead = fail_cycle - first persistent alarm at/after onset."""
    rows = []
    for uid, g in df.sort_values(["uid", "cycle"]).groupby("uid", sort=False):
        cyc = g["cycle"].to_numpy()
        flags = (g[score_col].to_numpy() > thr).astype(int)
        pers = np.convolve(flags, np.ones(n, dtype=int))[: len(flags)] >= k
        pre = cyc < g["onset_cycle"].iloc[0]
        hits = np.where(pers & ~pre)[0]
        fail = g["fail_cycle"].iloc[0]
        rows.append(dict(
            uid=uid, virtual=bool(g["is_virtual"].iloc[0]),
            fa_engine=bool(pers[pre].any()),
            fa_cycle=float(pers[pre].mean()) if pre.any() else np.nan,
            detected=bool(hits.size),
            lead=float(fail - cyc[hits[0]]) if hits.size and not np.isnan(fail) else np.nan,
            life_frac=float((fail - cyc[hits[0]]) / fail) if hits.size and not np.isnan(fail) else np.nan))
    return pd.DataFrame(rows)


def summarize_alarms(r: pd.DataFrame) -> dict:
    real, virt = r[~r.virtual], r[r.virtual]
    return dict(
        far_cycle=float(np.nanmean(r.fa_cycle)), far_engine=float(r.fa_engine.mean()),
        detection_rate=float(real.detected.mean()) if len(real) else None,
        median_lead_detected=float(real.lead.median()) if len(real) else None,
        share_lead_ge_35=float((real.lead.fillna(0) >= 35).mean()) if len(real) else None,
        median_lead_pct_of_life=float(real.life_frac.median()) if len(real) else None,
        drift_detection_rate=float(virt.detected.mean()) if len(virt) else None)


def calibrate_threshold(val, score_col, target_far=0.01, k=PERSIST_K, n=PERSIST_N) -> float:
    """Smallest threshold with persistent-alarm false-alarm rate <= target on held-out validation engines."""
    nominal_scores = val.loc[val["cycle"] < val["onset_cycle"], score_col]
    cands = np.quantile(nominal_scores, np.linspace(0.90, 0.9999, 80))
    for thr in cands:
        if np.nanmean(evaluate_alarms(val, score_col, thr, k, n).fa_cycle) <= target_far:
            return float(thr)
    return float(cands[-1])


def nasa_score(pred, true) -> float:
    d = np.asarray(pred) - np.asarray(true)
    return float(np.sum(np.where(d < 0, np.exp(-d / 13) - 1, np.exp(d / 10) - 1)))
