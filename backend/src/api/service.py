from __future__ import annotations
import json, time
import numpy as np, pandas as pd, xgboost as xgb, joblib
from src.core.config import ARTIFACTS, SERVING
from src.decision_engine.amm import AMM
from src.decision_engine.cost_model import cost_benefit
from src.decision_engine.urgency import urgency_index
from src.xai.explain import Explainer


class InferenceService:
    def __init__(self):
        self.meta = json.loads((ARTIFACTS / "meta.json").read_text())
        self.cols, self.classes = self.meta["feature_cols"], self.meta["classes"]
        self.clf, self.rul = xgb.Booster(), xgb.Booster()
        self.clf.load_model(ARTIFACTS / "clf.json"); self.rul.load_model(ARTIFACTS / "rul.json")
        self.iso = joblib.load(ARTIFACTS / "iforest.joblib")
        self.explainer = Explainer(self.clf, self.cols, self.classes)
        self.fleet = pd.read_parquet(SERVING / "fleet.parquet").sort_values(["uid", "cycle"]).reset_index(drop=True)
        self.by_uid = {u: g.reset_index(drop=True) for u, g in self.fleet.groupby("uid")}

    def engines(self): return list(self.by_uid)
    def cycles(self, uid): return self.by_uid[uid]["cycle"].tolist()

    def diagnose(self, uid: str, cycle: int, with_explain: bool = True) -> dict:
        t0 = time.perf_counter()
        g = self.by_uid[uid]
        row = g[g.cycle == cycle]
        if row.empty:
            raise KeyError(f"{uid} cycle {cycle}")
        X = row[self.cols]
        probs = self.clf.predict(xgb.DMatrix(X))[0]
        ci = int(np.argmax(probs))
        raw = float(-self.iso.score_samples(X)[0])
        lo, hi = self.meta["score_min"], self.meta["anom_ref"]
        scale = lambda s: float(np.clip((s - lo) / max(hi - lo, 1e-9), 0, 1))     # anomaly score A in [0,1]
        anom, thr01 = scale(raw), scale(self.meta["iso_threshold"])
        rul = float(np.clip(self.rul.predict(xgb.DMatrix(X))[0], 0, self.meta["rul_cap"]))
        pdict = {c: float(p) for c, p in zip(self.classes, probs)}
        is_anom = anom > thr01
        label = self.classes[ci]
        if is_anom and float(probs[ci]) < self.meta.get("conf_min", 0.60):
            label = "UNCERTAIN_ANOMALY"
        out = dict(engine_id=uid, cycle=int(cycle), n_cycles=int(g.cycle.max()),
                   anomaly_score=anom, anomaly_score_raw=raw, anomaly_threshold=thr01,
                   is_anomalous=is_anom, uncertain=(label == "UNCERTAIN_ANOMALY"),
                   fault_class=label, fault_probs=pdict, rul=rul, rul_sigma=self.meta["rul_sigma"],
                   urgency=urgency_index(anom, thr01, 1.0, pdict, rul, self.meta["rul_cap"]),
                   cost=cost_benefit(rul, self.meta["rul_sigma"]),
                   amm=[dict(code=c, task=t) for c, t in AMM.get(label, [])],
                   sensors={c.split("_c_")[0]: float(row[c].iloc[0]) for c in self.cols if c.endswith("_c_mean_z")})
        if with_explain:
            ts = time.perf_counter()
            out["explain"] = self.explainer.explain(row, ci)
            out["explain_ms"] = round((time.perf_counter() - ts) * 1000, 2)
        out["latency_ms"] = round((time.perf_counter() - t0) * 1000, 2)
        return out
