"""python -m src.models.train_models --dataset ncmapss
   python -m src.models.train_models --dataset cmapss_FD001"""
import argparse, json
import joblib, numpy as np, pandas as pd, xgboost as xgb
from sklearn.ensemble import IsolationForest
from sklearn.metrics import classification_report, confusion_matrix, f1_score, precision_score
from sklearn.model_selection import GroupKFold, GroupShuffleSplit
from sklearn.utils.class_weight import compute_sample_weight
from src.core.config import *
from src.data_pipeline.features import add_temporal_features
from src.models.evaluation import calibrate_threshold, evaluate_alarms, nasa_score, summarize_alarms


def make_clf(k):
    return xgb.XGBClassifier(objective="multi:softprob", num_class=k, n_estimators=400, max_depth=6,
                             learning_rate=0.05, subsample=0.8, colsample_bytree=0.8,
                             tree_method="hist", random_state=SEED)


def main(name: str):
    df = pd.read_parquet(PROC / f"{name}.parquet")
    z = [c for c in df.columns if c.endswith("_z")]
    df = add_temporal_features(df, z)
    feats = z + [c for c in df.columns if c.endswith(("_rm10", "_sl10"))]
    dev, test = df[df.split == "dev"].copy(), df[df.split == "test"].copy()
    RESULTS.mkdir(exist_ok=True); ARTIFACTS.mkdir(parents=True, exist_ok=True)
    res, meta = {}, {}

    # ---- engine-level train/val split (val used for threshold calibration + sigma)
    tr_i, va_i = next(GroupShuffleSplit(1, test_size=0.25, random_state=SEED).split(dev, groups=dev.group_unit))
    tr, va = dev.iloc[tr_i].copy(), dev.iloc[va_i].copy()

    # ---- baseline vs Isolation Forest (trained on NOMINAL only).
    # Thresholds are calibrated on OUT-OF-FOLD scores of ALL dev engines (each engine scored by a model that never saw it),
    # which mimics unseen engines and uses far more nominal cycles than a single small validation split.
    dev["iso_score"] = np.nan
    col_i = dev.columns.get_loc("iso_score")
    for a_, b_ in GroupKFold(n_splits=min(5, dev.group_unit.nunique())).split(dev, groups=dev.group_unit):
        tr_f = dev.iloc[a_]
        m_f = IsolationForest(n_estimators=200, random_state=SEED, n_jobs=-1).fit(tr_f[tr_f.cycle < tr_f.onset_cycle][feats])
        dev.iloc[b_, col_i] = -m_f.score_samples(dev.iloc[b_][feats])
    iso = IsolationForest(n_estimators=300, random_state=SEED, n_jobs=-1).fit(dev[dev.cycle < dev.onset_cycle][feats])
    test["iso_score"] = -iso.score_samples(test[feats])
    zmean = [c for c in z if c.endswith("_c_mean_z")]
    for d in (dev, test):
        d["base_score"] = d[zmean].abs().max(axis=1)
    thr_iso = calibrate_threshold(dev, "iso_score")
    thr_base = calibrate_threshold(dev, "base_score")
    res["baseline_fixed_3sigma"] = summarize_alarms(evaluate_alarms(test, "base_score", 3.0))
    res["baseline_calibrated"] = summarize_alarms(evaluate_alarms(test, "base_score", thr_base))
    res["isolation_forest"] = summarize_alarms(evaluate_alarms(test, "iso_score", thr_iso))
    res["calibration"] = dict(target_far=0.01, oof_far_isolation_forest=float(np.nanmean(evaluate_alarms(dev, "iso_score", thr_iso).fa_cycle)))
    faulty = dev[dev.cycle >= dev.onset_cycle]
    anom_ref = float(np.quantile(faulty.iso_score, 0.95)) if len(faulty) else thr_iso * 1.5
    score_min = float(np.median(dev.loc[dev.cycle < dev.onset_cycle, "iso_score"]))     # A=0 at median nominal score

    # ---- supervised classifier (only where labels exist)
    lab = dev[dev.fault_class.isin(CLASSES)]
    classes = [c for c in CLASSES if c in set(lab.fault_class)]
    if len(classes) > 1:
        cid = {c: i for i, c in enumerate(classes)}
        y = lab.fault_class.map(cid).to_numpy()
        cv = []
        for a, b in GroupKFold(n_splits=min(3, lab.group_unit.nunique())).split(lab, y, lab.group_unit):
            if len(np.unique(y[a])) < len(classes):
                continue                                    # fold lost a class -> need more units per class
            m = make_clf(len(classes)).fit(lab.iloc[a][feats], y[a], sample_weight=compute_sample_weight("balanced", y[a]))
            cv.append(f1_score(y[b], m.predict(lab.iloc[b][feats]), average="macro"))
        clf = make_clf(len(classes)).fit(lab[feats], y, sample_weight=compute_sample_weight("balanced", y))
        tl = test[test.fault_class.isin(classes)]
        yt, pred = tl.fault_class.map(cid).to_numpy(), clf.predict(tl[feats])
        idx = list(range(len(classes)))
        res["classifier"] = dict(
            classes=classes, cv_macro_f1=[float(x) for x in cv],
            test_macro_f1=float(f1_score(yt, pred, average="macro")),
            test_macro_precision=float(precision_score(yt, pred, average="macro", zero_division=0)),
            report=classification_report(yt, pred, labels=idx, target_names=classes, output_dict=True, zero_division=0),
            confusion=confusion_matrix(yt, pred, labels=idx).tolist())
        meta["classes"] = classes
        clf.get_booster().save_model(ARTIFACTS / "clf.json")

    # ---- RUL regressor (real engines only)
    rd, rv, rt = dev[~dev.is_virtual], va[~va.is_virtual], test[~test.is_virtual]
    rtr = tr[~tr.is_virtual]
    reg_tmp = xgb.XGBRegressor(n_estimators=500, max_depth=6, learning_rate=0.05, subsample=0.8, colsample_bytree=0.8, random_state=SEED)
    reg_tmp.fit(rtr[feats], rtr.rul.clip(upper=RUL_CAP))
    sigma = float(np.std(reg_tmp.predict(rv[feats]).clip(0, RUL_CAP) - rv.rul.clip(upper=RUL_CAP)))
    reg = xgb.XGBRegressor(n_estimators=500, max_depth=6, learning_rate=0.05, subsample=0.8, colsample_bytree=0.8, random_state=SEED)
    reg.fit(rd[feats], rd.rul.clip(upper=RUL_CAP))
    p = reg.predict(rt[feats]).clip(0, RUL_CAP); t = rt.rul.clip(upper=RUL_CAP).to_numpy()
    last = rt.assign(p=p, t=t).sort_values("cycle").groupby("uid").tail(1)     # standard C-MAPSS metric: last cycle per engine
    res["rul"] = dict(rmse_all_cycles=float(np.sqrt(np.mean((p - t) ** 2))),
                      rmse_last_cycle=float(np.sqrt(np.mean((last.p - last.t) ** 2))),
                      nasa_score_last_cycle=nasa_score(last.p, last.t), sigma_val=sigma)
    reg.get_booster().save_model(ARTIFACTS / "rul.json")
    joblib.dump(iso, ARTIFACTS / "iforest.joblib")

    meta.update(feature_cols=feats, iso_threshold=thr_iso, anom_ref=anom_ref, rul_sigma=sigma,
                rul_cap=RUL_CAP, persist_k=PERSIST_K, persist_n=PERSIST_N, score_min=score_min, conf_min=0.60)
    (ARTIFACTS / "meta.json").write_text(json.dumps(meta, indent=2))
    (RESULTS / f"benchmark_{name}.json").write_text(json.dumps(res, indent=2))
    print(json.dumps(res, indent=2)[:3000])


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--dataset", required=True)
    main(ap.parse_args().dataset)
