"""python -m src.data_pipeline.build_dataset --dataset ncmapss
   python -m src.data_pipeline.build_dataset --dataset cmapss --subset FD002"""
import argparse, json
import numpy as np, pandas as pd
from src.core.config import *
from src.data_pipeline.ingestion import *
from src.data_pipeline.regime_normalizer import *
from src.data_pipeline.injector import make_drift_units
from src.data_pipeline.features import add_residual_features, engine_baseline
from src.data_pipeline.quality_checker import *


def label_units(df: pd.DataFrame) -> pd.DataFrame:
    health = [c for c in df.columns if c.endswith("_mod")]
    mods = sorted({c.split("_")[0] for c in health})
    mag = pd.DataFrame({m: df[[c for c in health if c.startswith(m + "_")]].abs()
                        .groupby(df["uid"]).max().sum(axis=1) for m in mods})
    dom = mag.idxmax(axis=1)                               # dominant degrading module per unit
    df = df.copy()
    unhealthy = (df["hs"] == 0) if "hs" in df else (df[health].abs().sum(axis=1) > 1e-3)
    df["fault_class"] = np.where(unhealthy, df["uid"].map(dom).map(MODULE_TO_CLASS).fillna("EXCLUDED"), NOMINAL)
    onset = df[df["fault_class"] != NOMINAL].groupby("uid")["cycle"].min()
    df["onset_cycle"] = df["uid"].map(onset).fillna(df.groupby("uid")["cycle"].transform("max") + 1)
    df["fail_cycle"] = (df["cycle"] + df["rul"]).groupby(df["uid"]).transform("max")
    df["group_unit"], df["is_virtual"] = df["uid"], False
    return df


def build_ncmapss():
    frames, reports = [], []
    for p in sorted((RAW / "ncmapss").glob("*.h5")):
        for split in ("dev", "test"):
            raw = load_ncmapss(p, split, stride=10)
            comp = completeness(raw, [c for c in raw.columns if c != "uid"])
            phys = physics_violations(raw, PHYSICS_NC)
            reports.append((comp, phys, len(raw)))
            raw = add_corrected(raw, NC_TEMPS, NC_PRESS, NC_SPEEDS, NC_FLOWS)
            corr = [c + "_c" for c in NC_TEMPS + NC_PRESS + NC_SPEEDS + NC_FLOWS]
            frames.append(aggregate_cycles(raw, corr))
            del raw
    df = pd.concat(frames, ignore_index=True)
    df = label_units(df)
    means = [c for c in df.columns if c.endswith("_c_mean")]
    feats = means + [c for c in df.columns if c.endswith("_c_std")]

    virt = make_drift_units(df, means)                     # inject BEFORE normalization
    df = pd.concat([df, virt], ignore_index=True)
    nom = df[(df["split"] == "dev") & (df["fault_class"] == NOMINAL) & (~df["is_virtual"])]
    df = RegimeNormalizer(feats, "Fc").fit(nom).transform(df)
    zc = [c + "_z" for c in feats]
    df = engine_baseline(df, zc, BASELINE_K)                        # each engine relative to its own start of life
    nom_mask = (df["split"] == "dev") & (df["fault_class"] == NOMINAL) & (~df["is_virtual"])
    df = add_residual_features(df, [c + "_z" for c in means], nom_mask)   # cross-sensor residuals

    stuck = find_stuck(df[~df["is_virtual"]], means)
    comp = min(r[0] for r in reports)
    phys = {k: max(r[1].get(k, 0) for r in reports) for k in reports[0][1]}
    RESULTS.mkdir(exist_ok=True); PROC.mkdir(parents=True, exist_ok=True)
    (RESULTS / "quality_report_ncmapss.json").write_text(json.dumps(build_report(comp, phys, stuck, sum(r[2] for r in reports)), indent=2))
    df.to_parquet(PROC / "ncmapss.parquet")
    print(df.groupby(["split", "fault_class"]).uid.nunique())


def build_cmapss(subset: str):
    tr, te = load_cmapss(RAW / "cmapss", subset)
    tr["split"], te["split"] = "dev", "test"
    for d, s in ((tr, "d"), (te, "t")):
        d["uid"] = f"{subset}-{s}-u" + d["unit"].astype(str)
    df = pd.concat([tr, te], ignore_index=True)
    comp = completeness(df, CMAPSS_SENSORS)
    phys = physics_violations(df, PHYSICS_CM)
    df, km = assign_cmapss_regimes(df, 1 if subset in ("FD001", "FD003") else 6)
    df = add_corrected(df, CM_TEMPS, CM_PRESS, CM_SPEEDS, CM_FLOWS)
    corr = [c + "_c" for c in CM_TEMPS + CM_PRESS + CM_SPEEDS]
    df = df.rename(columns={c: c + "_mean" for c in corr})
    feats = [c + "_mean" for c in corr]
    df["fail_cycle"] = (df["cycle"] + df["rul"]).groupby(df["uid"]).transform("max")
    df["onset_cycle"] = (df["fail_cycle"] - RUL_CAP).clip(lower=1)     # approximation: degradation "starts" RUL_CAP before failure
    df["fault_class"] = np.where(df["cycle"] < df["onset_cycle"], NOMINAL, "UNLABELED")
    df["group_unit"], df["is_virtual"] = df["uid"], False
    nom = df[(df["split"] == "dev") & (df["cycle"] <= 30)]
    df = RegimeNormalizer(feats, "Fc").fit(nom).transform(df)
    stuck = find_stuck(df, feats)
    RESULTS.mkdir(exist_ok=True); PROC.mkdir(parents=True, exist_ok=True)
    (RESULTS / f"quality_report_{subset}.json").write_text(json.dumps(build_report(comp, phys, stuck, len(df)), indent=2))
    df.to_parquet(PROC / f"cmapss_{subset}.parquet")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", choices=["ncmapss", "cmapss"], required=True)
    ap.add_argument("--subset", default="FD001")
    a = ap.parse_args()
    build_ncmapss() if a.dataset == "ncmapss" else build_cmapss(a.subset)
