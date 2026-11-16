from __future__ import annotations
import numpy as np, pandas as pd, xgboost as xgb


def pretty(name: str) -> str:
    sensor = name.split("_c_")[0]
    kind = "trend" if "_sl" in name else "10-cycle avg" if "_rm" in name else "variability" if name.endswith("_std_z") else "level"
    return f"{sensor} ({kind})"


class Explainer:
    def __init__(self, booster: xgb.Booster, cols: list[str], classes: list[str]):
        self.b, self.cols, self.classes = booster, cols, classes

    def explain(self, row: pd.DataFrame, class_idx: int, k: int = 3, n_bars: int = 10) -> dict:
        contribs = self.b.predict(xgb.DMatrix(row[self.cols]), pred_contribs=True)[0]   # (n_classes, n_features+1)
        c = contribs[class_idx]
        vals, base = c[:-1], float(c[-1])
        order = np.argsort(-np.abs(vals))[:n_bars]
        x = row[self.cols].iloc[0].to_numpy()
        bars = [dict(feature=pretty(self.cols[i]), raw=self.cols[i], shap=float(vals[i]),
                     value=float(x[i]), arrow="↑" if x[i] > 0 else "↓") for i in order]
        return dict(base_value=base, top3=bars[:k], waterfall=bars)
