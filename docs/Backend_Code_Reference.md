# VortexPHM-AI — Ultimate Build Guide (data → models → XAI → API → dashboard → deployment → demo)

Everything here assumes: Windows, Python 3.12/3.13, Node 20+, RTX 4060 laptop, repo at `VortexPHM-AI/`.
Run all Python commands **from `backend/`** with `python -m ...` so `src.` imports work.

> **Revision 2** (aligned with the patched documentation set, see `CHANGELOG.md` and `Canonical_Parameters.md`): API routes live under `/api/v1`, three urgency tiers (T1 >= 70, T2 40-69, T3 < 40), anomaly score scaled to [0,1], `UNCERTAIN_ANOMALY` flag, hash-chained audit log. The frontend code in section 8 is the minimal data-wiring reference; the upgraded dual-theme UI with the 3D engine is specified in `UI_Design.md`.

---

## 0. Decisions locked in

| Topic | Decision |
|---|---|
| Datasets | **N-CMAPSS** = primary (real fault modes → classifier, anomaly, RUL). **C-MAPSS FD001–FD004** = benchmark (RUL vs literature, lead time, regime-normalization ablation on FD002/FD004). |
| Sensor-drift class | The only *synthetic* class. Injected on clean nominal segments ("virtual units"), never on top of real degradation. |
| Anomaly models | Isolation Forest (served) + LSTM Autoencoder (offline benchmark, trained on GPU) + **3σ / EWMA baseline** (to prove threshold-CBM is worse). |
| Classifier | XGBoost multi-class. Explanations via XGBoost's native `pred_contribs` (exact TreeSHAP, C++, fast). |
| RUL | XGBoost regressor + Gaussian residual uncertainty (feeds urgency + cost engine). |
| Extras included | Cost-benefit engine, streaming replay simulator, fleet overview, hash-chained audit log, Docker + minimal CI. |
| Extras skipped (stretch only) | Conformal prediction, drift monitoring (PSI). |
| Deployment | Backend → Docker on Render/Railway/Fly (pick one). Frontend → Vercel. |

### The extras, explained (so you know why I picked them)

- **Cost-benefit engine** ✅ — turns "urgency 82" into "deferring has an expected cost of $X vs $15K to inspect now". Uses your $150K–$1.2M UER/IFSD figures. ~60 lines, huge storytelling value.
- **Streaming replay simulator** ✅ — replays an engine's life cycle-by-cycle (SSE) so your live demo shows degradation → alarm → explanation → engineer decision. Without it, the demo is static screenshots.
- **Fleet overview** ✅ — one screen with all engines ranked by urgency + a "fleet time" slider. It's what makes it feel like an airline operations tool, not a notebook.
- **Docker + CI** ✅ — Docker is *required* for deployment; CI (pytest on push) is 15 lines and looks professional.
- **Conformal prediction** ⏸ — statistically guaranteed prediction intervals. Great but adds complexity; we use a simple Gaussian residual band instead.
- **Drift monitoring (PSI/KS)** ⏸ — detects when incoming data stops looking like training data. Mention it as future work.

---

## 1. Corrections to the original brief (do these or an examiner will find them)

| # | Issue | Fix |
|---|---|---|
| 1 | C-MAPSS has **no labels** for HPT / sensor-drift / fan-vs-LPC classes. | Use **N-CMAPSS**: it ships true health parameters per cycle (`fan/LPC/HPC/HPT/LPT` efficiency & flow modifiers). Label = dominant degrading module per unit. Only `FAULT_SENSOR_DRIFT` is synthetic. |
| 2 | `P24` doesn't exist in C-MAPSS. It **does** exist in N-CMAPSS. | Physics rules: N-CMAPSS `P2 < P24 < P30`, `T2 < T24 < T30`. C-MAPSS `P2 < P15 < P30`, `T2 < T24 < T30`. |
| 3 | **My earlier message said `T50 > T30 > T24` — that was wrong.** In these datasets the compressor-exit `T30` is *higher* than LPT-exit `T50`. | Assert only orderings you're sure about (above). Don't assert hot-section orderings unless you've verified them on the data. |
| 4 | θ, δ constants: the datasets use **°R and psia**, not K/kPa. Also use *inlet* conditions (T2, P2), not "ambient". | `θ = T2/518.67`, `δ = P2/14.696`. Corrected temp = T/θ, pressure = P/δ, speed = N/√θ, fuel flow = Wf/(δ√θ). |
| 5 | Row-wise random splits leak (same engine in train and test). | **Always split by engine** (GroupKFold / official dev-test units). |
| 6 | "Lead time ≥ 35 cycles" is easy on C-MAPSS (lives 128–362 cycles) but N-CMAPSS engines live shorter. | Report lead time on C-MAPSS as the headline vs the 35-cycle target; on N-CMAPSS also report lead as **% of life**. Say so upfront. |
| 7 | "Cryptographically hashed / immutable" is only true if enforced. | Hash chain (`prev_hash` → `entry_hash`) + DB triggers blocking UPDATE/DELETE + `/audit/verify`. |
| 8 | AMM codes in the brief are illustrative. | Label them "illustrative task references" in UI/docs; real AMM refs depend on engine type. |
| 9 | Objective 1 says "Foundation: C-MAPSS" but labels need N-CMAPSS. | Update `Project_Overview.md` + `Evaluation_Framework.md` so docs match reality (do this last, 20 minutes). |

---

## 2. Final repo layout

```
VortexPHM-AI/
├── backend/
│   ├── requirements.txt            # full (training)
│   ├── requirements-serve.txt      # slim (deployment, no torch)
│   ├── artifacts/                  # clf.json, rul.json, iforest.joblib, meta.json (committed, small)
│   ├── scripts/
│   │   ├── inspect_ncmapss.py
│   │   └── export_serving.py
│   ├── src/
│   │   ├── __init__.py
│   │   ├── core/{__init__,config}.py
│   │   ├── data_pipeline/{__init__,ingestion,regime_normalizer,injector,quality_checker,features,build_dataset}.py
│   │   ├── models/{__init__,evaluation,train_models,lstm_ae}.py
│   │   ├── xai/{__init__,explain}.py
│   │   ├── decision_engine/{__init__,urgency,cost_model,amm}.py
│   │   └── api/{__init__,db,schemas,service,main}.py
│   └── tests/
├── data/  raw/{cmapss,ncmapss}/  processed/  serving/      # raw+processed are git-ignored
├── frontend/src/{app,components,lib}
├── results/                        # benchmark.json + figures (your evidence)
├── Dockerfile, docker-compose.yml, .dockerignore
└── .github/workflows/ci.yml
```

Create every `__init__.py` (empty files).

---

## 3. Setup (Windows)

**Important:** your repo sits in OneDrive. N-CMAPSS files are large (hundreds of MB to GBs). Either move the repo to `C:\dev\VortexPHM-AI`, or keep `data\raw` and `data\processed` in a folder OneDrive doesn't sync (right-click → "Always keep on this device" is *not* what you want; exclude via OneDrive settings → Backup/Manage folders, or just move the repo).

```powershell
cd VortexPHM-AI\backend
py -3.12 -m venv .venv          # 3.12 is safest for wheels; 3.13 is fine if pip installs cleanly
.venv\Scripts\activate
pip install -U pip
# GPU torch for the LSTM-AE (RTX 4060) – get the exact command from pytorch.org (CUDA build)
pip install -r requirements.txt
```

Use the `requirements.txt` (training) and `requirements-serve.txt` (slim serving image) files from this package: copy both into `backend/`. They include `h5py`, `pyarrow`, `joblib`, `httpx` and optional `psycopg`, and omit LightGBM, requests and python-multipart.

**Data downloads (manual):** NASA Prognostics Center of Excellence → *Prognostics Data Repository*.
- C-MAPSS: put `train_FD00x.txt`, `test_FD00x.txt`, `RUL_FD00x.txt` into `data/raw/cmapss/`.
- N-CMAPSS: put the `.h5` files (start with **two or three** DS files that together cover Fan/LPC/HPC/HPT fault modes) into `data/raw/ncmapss/`.

**Step 0 sanity script** — run this *before* writing anything else. It tells you which modules degrade in which files, and verifies my assumptions about column names (`hs`, `_mod`).

`backend/scripts/inspect_ncmapss.py`
```python
import sys
from pathlib import Path
from src.data_pipeline.ingestion import load_ncmapss

df = load_ncmapss(Path(sys.argv[1]), "dev", stride=50)
health = [c for c in df.columns if c.endswith("_mod")]
print("columns:", df.columns.tolist())
print("\nmin health modifier per unit (which module degrades?):")
print(df.groupby("uid")[health].min().round(4).to_string())
print("\ncycles per unit:\n", df.groupby("uid").cycle.max().to_string())
if "hs" in df:
    print("\nhs mean per unit (1 = healthy, 0 = degraded):\n", df.groupby("uid").hs.mean().round(2).to_string())
```
Run: `python -m scripts.inspect_ncmapss ..\data\raw\ncmapss\N-CMAPSS_DS02-006.h5` (add `backend/scripts/__init__.py`).
**Decide from its output** which DS files you use so that fan, LPC, HPC and HPT each appear in at least ~3 units (needed for GroupKFold). If a class has too few units, merge Fan+LPC (already merged in the label map) or drop the class and say so.

---

## 4. Phase 1 — Telemetry data pipeline (Objective 1)

**Done when:** `data/processed/ncmapss.parquet` + `cmapss_FD00x.parquet` exist and `results/quality_report.json` shows completeness ≥ 99.98%, 0 physics violations, no stuck sensors.

### 4.1 `src/core/config.py`
```python
import os
from pathlib import Path

ROOT = Path(os.getenv("VORTEX_ROOT", Path(__file__).resolve().parents[3]))
DATA = ROOT / "data"
RAW, PROC, SERVING = DATA / "raw", DATA / "processed", DATA / "serving"
ARTIFACTS = ROOT / "backend" / "artifacts"
RESULTS = ROOT / "results"

T_REF_R, P_REF_PSIA = 518.67, 14.696      # sea-level standard, Rankine / psia (NASA sets use these units)

NOMINAL = "NOMINAL"
CLASSES = ["NOMINAL", "FAULT_HPC_EFFICIENCY", "FAULT_FAN_LPC", "FAULT_HPT_THERMAL", "FAULT_SENSOR_DRIFT"]
MODULE_TO_CLASS = {
    "fan": "FAULT_FAN_LPC", "LPC": "FAULT_FAN_LPC",
    "HPC": "FAULT_HPC_EFFICIENCY", "HPT": "FAULT_HPT_THERMAL",
    "LPT": "EXCLUDED_LPT",           # not one of the 5 classes; kept for RUL/anomaly, excluded from classifier
}
RUL_CAP = 125
PERSIST_K, PERSIST_N = 3, 5           # alarm = >=3 flags in the last 5 cycles
SEED = 42
```

### 4.2 `src/data_pipeline/ingestion.py`
```python
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
```

### 4.3 `src/data_pipeline/regime_normalizer.py`
```python
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
```

### 4.4 `src/data_pipeline/injector.py` (sensor drift / step bias / noise)
```python
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
                     min_len: int = 20, seed: int = 42) -> pd.DataFrame:
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
            start = int(rng.integers(5, len(v) - 8)) + int(v["cycle"].min())
            col = str(rng.choice(mean_cols))
            (inject_drift if k % 2 == 0 else inject_step_bias)(v, col, start)
            v[mean_cols] = add_noise_snr(v[mean_cols].to_numpy(), SNR_DB, rng)
            v["fault_class"] = np.where(v["cycle"] >= start + 5, "FAULT_SENSOR_DRIFT", NOMINAL)
            v["onset_cycle"], v["fail_cycle"], v["rul"], v["is_virtual"] = start, np.nan, np.nan, True
            out.append(v)
    if not out:
        raise ValueError("No nominal segment of at least min_len cycles; lower min_len or check the nominal labelling (hs / health parameters).")
    return pd.concat(out, ignore_index=True)
```

### 4.5 `src/data_pipeline/quality_checker.py`
```python
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
```

### 4.6 `src/data_pipeline/features.py`
```python
import pandas as pd


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
```

### 4.7 `src/data_pipeline/build_dataset.py`
```python
"""python -m src.data_pipeline.build_dataset --dataset ncmapss
   python -m src.data_pipeline.build_dataset --dataset cmapss --subset FD002"""
import argparse, json
import numpy as np, pandas as pd
from src.core.config import *
from src.data_pipeline.ingestion import *
from src.data_pipeline.regime_normalizer import *
from src.data_pipeline.injector import make_drift_units
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
```
> Note: `label_units` needs `rul` present (it is, from `Y_*`). `fail_cycle` is `cycle + rul`, constant per engine.
> Note: the C-MAPSS quality report will legitimately list a few flat sensors only if they vary elsewhere; sensors constant in the whole subset are skipped.

---

## 5. Phase 2 — Dual-model training & benchmark (Objective 2)

**Done when:** `results/benchmark_ncmapss.json` and `results/benchmark_cmapss_FD001.json` contain baseline vs Isolation Forest vs LSTM-AE (lead time, FAR) + classifier (macro-F1, precision) + RUL (RMSE, NASA score), and `backend/artifacts/` is populated.

### 5.1 `src/models/evaluation.py` (the formal metrics)
```python
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
```
Why target 1%, not 2%: safety margin so the *test* FAR lands ≤ 2%.

### 5.2 `src/models/train_models.py`
```python
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

    # ---- baseline vs Isolation Forest (trained on NOMINAL only)
    nom_tr = tr[tr.cycle < tr.onset_cycle]
    iso = IsolationForest(n_estimators=300, random_state=SEED, n_jobs=-1).fit(nom_tr[feats])
    for d in (va, test):
        d["iso_score"] = -iso.score_samples(d[feats])
        d["base_score"] = d[[c for c in z if c.endswith("_c_mean_z")]].abs().max(axis=1)
    thr_iso = calibrate_threshold(va, "iso_score")
    thr_base = calibrate_threshold(va, "base_score")
    res["baseline_fixed_3sigma"] = summarize_alarms(evaluate_alarms(test, "base_score", 3.0))
    res["baseline_calibrated"] = summarize_alarms(evaluate_alarms(test, "base_score", thr_base))
    res["isolation_forest"] = summarize_alarms(evaluate_alarms(test, "iso_score", thr_iso))
    faulty = va[va.cycle >= va.onset_cycle]
    anom_ref = float(np.quantile(faulty.iso_score, 0.95)) if len(faulty) else thr_iso * 1.5
    score_min = float(np.median(va.loc[va.cycle < va.onset_cycle, "iso_score"]))     # A=0 at median nominal score

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
```
> ⚠️ Artifacts are written by *whichever dataset you train last*. Train `cmapss_FD00x` first (benchmarks only), then `ncmapss` **last** so serving artifacts come from N-CMAPSS. (Or copy artifacts to a per-dataset folder if you prefer.)

### 5.3 `src/models/lstm_ae.py` (GPU, trained on nominal windows only)
```python
"""python -m src.models.lstm_ae --dataset ncmapss"""
import argparse, json
import numpy as np, pandas as pd, torch, torch.nn as nn, torch.nn.functional as F
from torch.utils.data import DataLoader, TensorDataset
from sklearn.model_selection import GroupShuffleSplit
from src.core.config import *
from src.models.evaluation import calibrate_threshold, evaluate_alarms, summarize_alarms

T = 20


class LSTMAE(nn.Module):
    def __init__(self, n_feat, hidden=64, latent=16):
        super().__init__()
        self.enc = nn.LSTM(n_feat, hidden, batch_first=True)
        self.to_lat, self.from_lat = nn.Linear(hidden, latent), nn.Linear(latent, hidden)
        self.dec, self.out = nn.LSTM(hidden, hidden, batch_first=True), nn.Linear(hidden, n_feat)

    def forward(self, x):
        _, (h, _) = self.enc(x)
        d = self.from_lat(self.to_lat(h[-1])).unsqueeze(1).repeat(1, x.size(1), 1)
        return self.out(self.dec(d)[0])


def make_windows(df, cols):
    X, idx = [], []
    for _, g in df.sort_values(["uid", "cycle"]).groupby("uid", sort=False):
        a = g[cols].to_numpy(np.float32)
        pad = np.vstack([np.repeat(a[:1], T - 1, axis=0), a])
        X.append(np.lib.stride_tricks.sliding_window_view(pad, T, axis=0).transpose(0, 2, 1)); idx.append(g.index.to_numpy())
    return np.concatenate(X), np.concatenate(idx)


@torch.no_grad()
def score(model, dev, X, per_feature=False, bs=1024):
    out = []
    for i in range(0, len(X), bs):
        xb = torch.from_numpy(X[i:i + bs]).to(dev)
        err = (model(xb) - xb) ** 2
        out.append((err.mean(dim=1) if per_feature else err.mean(dim=(1, 2))).cpu().numpy())
    return np.concatenate(out)


def main(name):
    df = pd.read_parquet(PROC / f"{name}.parquet").reset_index(drop=True)
    cols = [c for c in df.columns if c.endswith("_c_mean_z")]
    dev_df, test_df = df[df.split == "dev"], df[df.split == "test"]
    tr_i, va_i = next(GroupShuffleSplit(1, test_size=0.25, random_state=SEED).split(dev_df, groups=dev_df.group_unit))
    tr, va = dev_df.iloc[tr_i], dev_df.iloc[va_i]
    Xtr, itr = make_windows(tr, cols)
    nominal = (df.loc[itr, "cycle"] < df.loc[itr, "onset_cycle"]).to_numpy()
    dev = "cuda" if torch.cuda.is_available() else "cpu"
    model = LSTMAE(len(cols)).to(dev)
    opt = torch.optim.Adam(model.parameters(), 1e-3)
    dl = DataLoader(TensorDataset(torch.from_numpy(Xtr[nominal])), batch_size=256, shuffle=True)
    for ep in range(40):
        for (xb,) in dl:
            xb = xb.to(dev); loss = F.mse_loss(model(xb), xb)
            opt.zero_grad(); loss.backward(); opt.step()
    model.eval()
    va_scored, te_scored = va.copy(), test_df.copy()
    for d in (va_scored, te_scored):
        X, idx = make_windows(d, cols)
        d.loc[idx, "ae_score"] = score(model, dev, X)
    thr = calibrate_threshold(va_scored, "ae_score")
    res = dict(lstm_ae=summarize_alarms(evaluate_alarms(te_scored, "ae_score", thr)), threshold=thr, device=dev)
    (RESULTS / f"lstm_ae_{name}.json").write_text(json.dumps(res, indent=2)); print(res)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--dataset", required=True); main(ap.parse_args().dataset)
```
> Scoring is done on copies of the validation and test frames; `make_windows` returns the row index so scores are written back aligned. Per-sensor error contributions for XAI: `score(model, dev, X, per_feature=True)` returns `(n, n_features)`.

### 5.4 Run order
```powershell
python -m src.data_pipeline.build_dataset --dataset cmapss --subset FD001   # repeat FD002..FD004
python -m src.data_pipeline.build_dataset --dataset ncmapss
python -m src.models.train_models --dataset cmapss_FD001                    # benchmarks
python -m src.models.train_models --dataset cmapss_FD002
python -m src.models.lstm_ae --dataset ncmapss
python -m src.models.train_models --dataset ncmapss                         # LAST: writes serving artifacts
```
**Ablation table to produce (cheap, high marks):** re-run FD002 with/without regime normalization, and N-CMAPSS with/without rolling features; paste RMSE/F1 into the report.

**If targets aren't met** (macro-F1 < 0.91, lead < 35): don't hide it. Try (a) more DS files/units per class, (b) longer rolling windows (20), (c) tune `PERSIST_K/N`, (d) report honestly with the per-class breakdown and explain limits (few engines per class). A truthful 0.87 with sound methodology beats a leaky 0.98.

---

## 6. Phase 3 — XAI & decision triage (Objective 3)

### 6.1 `src/xai/explain.py` (exact TreeSHAP via XGBoost, ~ms latency)
```python
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
```

### 6.2 `src/decision_engine/urgency.py`
```python
import numpy as np

CRITICALITY = {"NOMINAL": 0.0, "FAULT_SENSOR_DRIFT": 0.35, "FAULT_FAN_LPC": 0.6,
               "FAULT_HPC_EFFICIENCY": 0.8, "FAULT_HPT_THERMAL": 1.0}
W_ANOM, W_CRIT, W_RUL = 0.35, 0.35, 0.30
TIER1, TIER2 = 70.0, 40.0          # tune by looking at the U distribution on validation engines


def urgency_index(anom: float, thr: float, anom_ref: float, probs: dict[str, float], rul: float, rul_cap: float = 125) -> dict:
    s_anom = float(np.clip((anom - thr) / max(anom_ref - thr, 1e-9), 0, 1))
    s_crit = float(sum(p * CRITICALITY.get(c, 0.5) for c, p in probs.items()))
    s_rul = float(1 - np.clip(rul / rul_cap, 0, 1))
    u = 100 * (W_ANOM * s_anom + W_CRIT * s_crit + W_RUL * s_rul)
    tier = 1 if u >= TIER1 else 2 if u >= TIER2 else 3      # 1 Critical, 2 Elevated, 3 Monitor
    return dict(index=round(u, 1), tier=tier, components=dict(anomaly=s_anom, criticality=s_crit, rul=s_rul))
```

### 6.3 `src/decision_engine/cost_model.py`
```python
from math import erf, sqrt

# ASSUMPTIONS — replace with numbers you can justify (brief cites $150K–$1.2M per UER/IFSD event)
COST_UER, COST_INSPECTION, DEFER_HORIZON = 450_000, 15_000, 30


def p_fail_within(rul: float, sigma: float, horizon: int = DEFER_HORIZON) -> float:
    return 0.5 * (1 + erf((horizon - rul) / (max(sigma, 1e-6) * sqrt(2))))


def cost_benefit(rul: float, sigma: float) -> dict:
    p = p_fail_within(rul, sigma)
    exp_defer = p * COST_UER
    return dict(p_fail_within_horizon=round(p, 3), horizon_cycles=DEFER_HORIZON,
                expected_cost_defer=round(exp_defer), cost_act_now=COST_INSPECTION,
                suggestion="ACT_NOW" if exp_defer > COST_INSPECTION else "MONITOR",
                note="Assumption-based; edit constants in cost_model.py")
```

### 6.4 `src/decision_engine/amm.py`
```python
# Illustrative task references (real AMM numbers depend on engine type/operator manual)
AMM = {
    "FAULT_HPC_EFFICIENCY": [("AMM 72-41-00", "Core wash / compressor performance recovery"), ("AMM 72-00-00", "Borescope inspection – compressor")],
    "FAULT_FAN_LPC": [("AMM 72-00-00", "Borescope inspection – fan/LPC"), ("AMM 72-21-00", "Fan blade & spinner visual check (illustrative)")],
    "FAULT_HPT_THERMAL": [("AMM 72-00-00", "Borescope inspection – HPT blades/nozzles"), ("AMM 72-50-00", "Turbine section detailed inspection (illustrative)")],
    "FAULT_SENSOR_DRIFT": [("AMM 73-00-00", "Engine fuel & control / sensor check (illustrative)"), ("AMM 77-00-00", "Engine indicating – sensor calibration (illustrative)")],
    "NOMINAL": [],
    "UNCERTAIN_ANOMALY": [("AMM 72-00-00", "General borescope review (classifier not confident; no class-specific work order)")],
}
```

---

## 7. Phase 4 — FastAPI + persistence (audit trail)

### 7.1 `src/api/db.py` (hash chain + append-only enforcement)
```python
from __future__ import annotations
import hashlib, json, os, threading
from datetime import datetime, timezone
from sqlalchemy import DDL, Integer, String, Text, create_engine, event, select, text
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker
from src.core.config import ROOT

GENESIS = "0" * 64
DB_URL = os.getenv("DATABASE_URL") or f"sqlite:///{os.getenv('AUDIT_DB', ROOT / 'backend' / 'audit.db')}"
engine = create_engine(DB_URL, connect_args={"check_same_thread": False} if DB_URL.startswith("sqlite") else {})
SessionLocal = sessionmaker(engine, expire_on_commit=False)
_lock = threading.Lock()


class Base(DeclarativeBase): ...


class AuditLog(Base):
    __tablename__ = "audit_log"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ts: Mapped[str] = mapped_column(String(40))
    engine_id: Mapped[str] = mapped_column(String(64))
    cycle: Mapped[int] = mapped_column(Integer)
    action: Mapped[str] = mapped_column(String(16))
    engineer_license: Mapped[str] = mapped_column(String(32))
    justification: Mapped[str] = mapped_column(Text)
    snapshot: Mapped[str] = mapped_column(Text)          # canonical JSON of the AI recommendation shown to the engineer
    prev_hash: Mapped[str] = mapped_column(String(64))
    entry_hash: Mapped[str] = mapped_column(String(64))


_sqlite_trig = ("CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit_log "
                "BEGIN SELECT RAISE(ABORT,'audit_log is append-only'); END;",
                "CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit_log "
                "BEGIN SELECT RAISE(ABORT,'audit_log is append-only'); END;")
for stmt in _sqlite_trig:
    event.listen(AuditLog.__table__, "after_create", DDL(stmt).execute_if(dialect="sqlite"))
event.listen(AuditLog.__table__, "after_create", DDL(
    "CREATE OR REPLACE FUNCTION audit_block() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'audit_log is append-only'; END; $$ LANGUAGE plpgsql"
).execute_if(dialect="postgresql"))
event.listen(AuditLog.__table__, "after_create", DDL(
    "CREATE TRIGGER audit_no_mod BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION audit_block()"
).execute_if(dialect="postgresql"))


def init_db(): Base.metadata.create_all(engine)
def canonical(d) -> str: return json.dumps(d, sort_keys=True, separators=(",", ":"))
def compute_hash(prev: str, payload: dict) -> str: return hashlib.sha256((prev + "|" + canonical(payload)).encode()).hexdigest()


def append_entry(s: Session, engine_id, cycle, action, lic, justification, snapshot: dict) -> AuditLog:
    with _lock:
        last = s.scalars(select(AuditLog).order_by(AuditLog.id.desc()).limit(1)).first()
        prev = last.entry_hash if last else GENESIS
        ts = datetime.now(timezone.utc).isoformat()
        payload = dict(ts=ts, engine_id=engine_id, cycle=cycle, action=action, engineer_license=lic,
                       justification=justification, snapshot=snapshot)
        row = AuditLog(ts=ts, engine_id=engine_id, cycle=cycle, action=action, engineer_license=lic,
                       justification=justification, snapshot=canonical(snapshot), prev_hash=prev,
                       entry_hash=compute_hash(prev, payload))
        s.add(row); s.commit()
        return row


def verify_chain(s: Session) -> dict:
    prev = GENESIS
    for r in s.scalars(select(AuditLog).order_by(AuditLog.id)):
        payload = dict(ts=r.ts, engine_id=r.engine_id, cycle=r.cycle, action=r.action, engineer_license=r.engineer_license,
                       justification=r.justification, snapshot=json.loads(r.snapshot))
        if r.prev_hash != prev or r.entry_hash != compute_hash(prev, payload):
            return dict(valid=False, broken_at_id=r.id)
        prev = r.entry_hash
    return dict(valid=True, broken_at_id=None)
```

### 7.2 `src/api/schemas.py`
```python
from typing import Literal
from pydantic import BaseModel, Field


class DiagnoseIn(BaseModel):
    engine_id: str
    cycle: int


class DecisionIn(BaseModel):
    engine_id: str
    cycle: int
    action: Literal["ACCEPT", "OVERRIDE", "DEFER"]
    engineer_license: str = Field(pattern=r"^[A-Z0-9-]{6,20}$")
    justification: str = Field(min_length=50)
```

### 7.3 `src/api/service.py` (inference)
```python
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
```

### 7.4 `src/api/main.py`
```python
from __future__ import annotations
import asyncio, json, os
from contextlib import asynccontextmanager
from fastapi import APIRouter, Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session
from src.api import db
from src.api.schemas import DecisionIn, DiagnoseIn
from src.api.service import InferenceService
from src.core.config import RESULTS

svc: InferenceService | None = None


@asynccontextmanager
async def lifespan(app):
    global svc
    db.init_db()
    svc = InferenceService()
    yield


app = FastAPI(title="VortexPHM-AI", version="1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","),
                   allow_methods=["*"], allow_headers=["*"])


def get_db():
    with db.SessionLocal() as s:
        yield s


api = APIRouter()


@api.get("/health")
def health(): return {"status": "ok", "engines": len(svc.engines())}


@api.get("/decision/triage-queue")
def fleet(frac: float = 0.75):
    """Fleet snapshot at 'fleet time' = frac of each engine's life (UI slider)."""
    rows = []
    for uid in svc.engines():
        cyc = svc.cycles(uid)
        c = cyc[min(len(cyc) - 1, int(frac * len(cyc)))]
        d = svc.diagnose(uid, c, with_explain=False)
        rows.append(dict(engine_id=uid, cycle=c, fault_class=d["fault_class"], urgency=d["urgency"], rul=d["rul"], anomalous=d["is_anomalous"],
                         cost=d["cost"], amm=d["amm"][:1]))
    return sorted(rows, key=lambda r: -r["urgency"]["index"])


@api.post("/diagnostics/evaluate")
def diagnose(body: DiagnoseIn):
    try:
        return svc.diagnose(body.engine_id, body.cycle)
    except KeyError:
        raise HTTPException(404, "engine/cycle not found")


@api.get("/engines/{uid}/replay")
async def replay(uid: str, speed: float = 0.3):
    if uid not in svc.by_uid:
        raise HTTPException(404, "unknown engine")

    async def gen():
        for c in svc.cycles(uid):
            yield f"data: {json.dumps(svc.diagnose(uid, c, with_explain=False))}\n\n"
            await asyncio.sleep(speed)
        yield 'data: {"done": true}\n\n'
    return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@api.post("/decision/action", status_code=201)
def decide(body: DecisionIn, s: Session = Depends(get_db)):
    try:
        snap = svc.diagnose(body.engine_id, body.cycle, with_explain=False)
    except KeyError:
        raise HTTPException(404, "engine/cycle not found")
    snap = {k: snap[k] for k in ("fault_class", "urgency", "rul", "anomaly_score", "cost", "amm")}
    r = db.append_entry(s, body.engine_id, body.cycle, body.action, body.engineer_license, body.justification, snap)
    return dict(id=r.id, ts=r.ts, entry_hash=r.entry_hash, prev_hash=r.prev_hash)


@api.get("/audit")
def audit(limit: int = 100, s: Session = Depends(get_db)):
    rows = s.scalars(select(db.AuditLog).order_by(db.AuditLog.id.desc()).limit(limit)).all()
    return [dict(id=r.id, ts=r.ts, engine_id=r.engine_id, cycle=r.cycle, action=r.action, engineer_license=r.engineer_license,
                 justification=r.justification, entry_hash=r.entry_hash, prev_hash=r.prev_hash) for r in rows]


@api.get("/audit/verify")
def audit_verify(s: Session = Depends(get_db)): return db.verify_chain(s)


@api.get("/metrics/benchmark")
def benchmark():
    """Benchmark and quality JSON files written by the evaluation scripts (empty until they have been run)."""
    return {p.stem: json.loads(p.read_text()) for p in sorted(RESULTS.glob("*.json"))}


app.include_router(api, prefix="/api/v1")      # all routes live under /api/v1 (Swagger stays at /docs)
```
Run locally: `uvicorn src.api.main:app --reload --port 8000` → open `http://localhost:8000/docs`.

### 7.5 `scripts/export_serving.py` (ships a tiny demo fleet, not the raw data)
```python
"""python -m scripts.export_serving   -> data/serving/fleet.parquet (8-10 test engines with a mix of fault types)"""
import numpy as np, pandas as pd
from src.core.config import PROC, SERVING
from src.data_pipeline.features import add_temporal_features

df = pd.read_parquet(PROC / "ncmapss.parquet")
z = [c for c in df.columns if c.endswith("_z")]
df = add_temporal_features(df, z)
test = df[df.split == "test"]
pick = []
for cls in ["FAULT_HPC_EFFICIENCY", "FAULT_FAN_LPC", "FAULT_HPT_THERMAL", "FAULT_SENSOR_DRIFT"]:
    ids = test[test.fault_class == cls].uid.drop_duplicates().tolist()
    pick += ids[:2]
pick += test[test.is_virtual == False].uid.drop_duplicates().tolist()[:2]     # a couple of real engines regardless of class
keep = test[test.uid.isin(set(pick))]
SERVING.mkdir(parents=True, exist_ok=True)
keep.to_parquet(SERVING / "fleet.parquet")
print(keep.groupby("uid").size())
```

---

## 8. Phase 5 — Next.js dashboard (Titanium Industrial)

> This section is the **minimal functional dashboard** (single theme, hex colours) that proves the data wiring. The upgraded UI (dual theme, orange accent, top-bar + alert-strip layout, interactive 3D engine) is specified in `UI_Design.md`; reuse `lib/api.ts` and the page logic below, and swap in the new components.

Setup: `cd frontend && npm install && npm i recharts lucide-react` (if peer-dependency errors with React 19: `npm i recharts --legacy-peer-deps`). Ensure `tsconfig.json` has `"paths": {"@/*": ["./src/*"]}`. Create `frontend/.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1`.

Colors below are hex literals so they work whether or not your Tailwind tokens have the exact names.

### 8.1 `src/lib/api.ts`
```ts
export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export type Bar = { feature: string; raw: string; shap: number; value: number; arrow: string };
export type Diagnosis = {
  engine_id: string; cycle: number; n_cycles: number;
  anomaly_score: number; anomaly_threshold: number; is_anomalous: boolean;
  fault_class: string; fault_probs: Record<string, number>; rul: number; rul_sigma: number;
  urgency: { index: number; tier: 1 | 2 | 3; components: Record<string, number> };
  cost: { p_fail_within_horizon: number; horizon_cycles: number; expected_cost_defer: number; cost_act_now: number; suggestion: string };
  amm: { code: string; task: string }[];
  explain?: { base_value: number; top3: Bar[]; waterfall: Bar[] };
  latency_ms: number; explain_ms?: number;
};
export type FleetRow = { engine_id: string; cycle: number; fault_class: string; urgency: Diagnosis["urgency"]; rul: number; anomalous: boolean };

export async function getJSON<T>(path: string): Promise<T> {
  const r = await fetch(`${API}${path}`, { cache: "no-store" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
export async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${API}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
export const tierColor = (t: number) => (t === 1 ? "#EF4444" : t === 2 ? "#EAB308" : "#10B981");
export const tierLabel = (t: number) => (t === 1 ? "TIER 1 · CRITICAL" : t === 2 ? "TIER 2 · ELEVATED" : "TIER 3 · MONITOR");
```

### 8.2 `src/app/page.tsx` (fleet overview)
```tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { FleetRow, getJSON, tierColor, tierLabel } from "@/lib/api";

export default function Fleet() {
  const [rows, setRows] = useState<FleetRow[]>([]);
  const [frac, setFrac] = useState(0.75);
  const [err, setErr] = useState("");
  useEffect(() => { getJSON<FleetRow[]>(`/decision/triage-queue?frac=${frac}`).then(setRows).catch(e => setErr(String(e))); }, [frac]);
  return (
    <main className="min-h-screen bg-[#0B0F19] p-8 text-[#F8FAFC]">
      <h1 className="text-2xl font-semibold">VortexPHM-AI <span className="text-[#94A3B8] text-base">Fleet Health</span></h1>
      <div className="my-6 flex items-center gap-4 rounded-lg border border-[#28354D] bg-[#151C2C] p-4">
        <span className="text-sm text-[#94A3B8]">Fleet time (% of life)</span>
        <input type="range" min={0.05} max={1} step={0.05} value={frac} onChange={e => setFrac(+e.target.value)} className="w-64 accent-[#3B82F6]" />
        <span className="font-mono">{Math.round(frac * 100)}%</span>
      </div>
      {err && <p className="text-[#EF4444]">{err}</p>}
      <table className="w-full text-left text-sm">
        <thead className="text-[#94A3B8]"><tr><th className="p-2">Engine</th><th>Cycle</th><th>Diagnosis</th><th>RUL</th><th>Urgency</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.engine_id} className="border-t border-[#28354D] hover:bg-[#1E293B]">
              <td className="p-2"><Link className="text-[#60A5FA] hover:underline" href={`/engine/${encodeURIComponent(r.engine_id)}`}>{r.engine_id}</Link></td>
              <td className="font-mono">{r.cycle}</td><td>{r.fault_class.replace("FAULT_", "")}</td>
              <td className="font-mono">{r.rul.toFixed(0)}</td>
              <td className="font-mono text-lg">{r.urgency.index}</td>
              <td><span className="rounded px-2 py-0.5 text-xs" style={{ background: tierColor(r.urgency.tier) + "33", color: tierColor(r.urgency.tier) }}>{tierLabel(r.urgency.tier)}</span></td>
            </tr>))}
        </tbody>
      </table>
      <Link href="/audit" className="mt-8 inline-block text-[#60A5FA] hover:underline">Audit trail →</Link>
    </main>);
}
```

### 8.3 `src/components/DecisionPanel.tsx`
```tsx
"use client";
import { useState } from "react";
import { Diagnosis, postJSON } from "@/lib/api";

export default function DecisionPanel({ d }: { d: Diagnosis }) {
  const [lic, setLic] = useState(""); const [just, setJust] = useState(""); const [msg, setMsg] = useState("");
  async function submit(action: "ACCEPT" | "OVERRIDE" | "DEFER") {
    try {
      const r = await postJSON<{ id: number; entry_hash: string }>("/decision/action", { engine_id: d.engine_id, cycle: d.cycle, action, engineer_license: lic, justification: just });
      setMsg(`Logged #${r.id} · hash ${r.entry_hash.slice(0, 16)}…`); setJust("");
    } catch (e) { setMsg("Rejected: check license format (A–Z, 0–9, -, 6–20 chars) and justification ≥ 50 chars"); }
  }
  const ok = just.length >= 50 && lic.length >= 6;
  return (
    <div className="rounded-lg border border-[#28354D] bg-[#151C2C] p-4">
      <h3 className="mb-2 font-semibold">Engineer decision</h3>
      <input value={lic} onChange={e => setLic(e.target.value.toUpperCase())} placeholder="Licence ID (e.g. LME-204981)" className="mb-2 w-full rounded bg-[#0B0F19] p-2 font-mono text-sm outline-none focus:ring-1 focus:ring-[#60A5FA]" />
      <textarea value={just} onChange={e => setJust(e.target.value)} rows={4} placeholder="Technical justification (min 50 characters)" className="w-full rounded bg-[#0B0F19] p-2 text-sm outline-none focus:ring-1 focus:ring-[#60A5FA]" />
      <div className={`mb-3 text-xs ${just.length >= 50 ? "text-[#10B981]" : "text-[#94A3B8]"}`}>{just.length}/50</div>
      <div className="flex gap-2">
        {(["ACCEPT", "OVERRIDE", "DEFER"] as const).map(a => (
          <button key={a} disabled={!ok} onClick={() => submit(a)} className="rounded bg-[#2563EB] px-3 py-1.5 text-sm font-medium disabled:opacity-40 hover:bg-[#3B82F6]">{a}</button>))}
      </div>
      {msg && <p className="mt-3 font-mono text-xs text-[#94A3B8]">{msg}</p>}
    </div>);
}
```

### 8.4 `src/app/engine/[id]/page.tsx` (replay + explanation + decision)
```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Bar, BarChart, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import DecisionPanel from "@/components/DecisionPanel";
import { API, Diagnosis, postJSON, tierColor, tierLabel } from "@/lib/api";

export default function EnginePage() {
  const { id } = useParams<{ id: string }>();
  const engineId = decodeURIComponent(id);
  const [hist, setHist] = useState<Diagnosis[]>([]);
  const [full, setFull] = useState<Diagnosis | null>(null);
  const [running, setRunning] = useState(false);
  const es = useRef<EventSource | null>(null);

  const stop = () => { es.current?.close(); setRunning(false); };
  const start = () => {
    stop(); setHist([]); setFull(null); setRunning(true);
    const src = new EventSource(`${API}/engines/${encodeURIComponent(engineId)}/replay?speed=0.15`);
    src.onmessage = ev => { const d = JSON.parse(ev.data); if (d.done) { src.close(); setRunning(false); } else setHist(h => [...h, d]); };
    src.onerror = () => { src.close(); setRunning(false); };
    es.current = src;
  };
  useEffect(() => () => es.current?.close(), []);
  const last = hist[hist.length - 1];
  const explain = async () => { stop(); if (last) setFull(await postJSON<Diagnosis>("/diagnostics/evaluate", { engine_id: engineId, cycle: last.cycle })); };
  const d = full ?? last;

  return (
    <main className="min-h-screen bg-[#0B0F19] p-8 text-[#F8FAFC]">
      <a href="/" className="text-sm text-[#60A5FA]">← Fleet</a>
      <h1 className="mb-4 mt-2 text-2xl font-semibold">{engineId}</h1>
      <div className="mb-4 flex gap-2">
        <button onClick={running ? stop : start} className="rounded bg-[#2563EB] px-4 py-2 text-sm hover:bg-[#3B82F6]">{running ? "Pause" : "▶ Replay engine life"}</button>
        <button onClick={explain} disabled={!last} className="rounded border border-[#28354D] px-4 py-2 text-sm disabled:opacity-40 hover:bg-[#1E293B]">Explain this cycle</button>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border border-[#28354D] bg-[#151C2C] p-4 lg:col-span-2">
          <h3 className="mb-2 text-sm text-[#94A3B8]">Urgency index & anomaly score over flight cycles</h3>
          <div className="h-64"><ResponsiveContainer>
            <LineChart data={hist.map(h => ({ c: h.cycle, u: h.urgency.index, a: h.anomaly_score }))}>
              <XAxis dataKey="c" stroke="#94A3B8" /><YAxis yAxisId="u" domain={[0, 100]} stroke="#94A3B8" />
              <YAxis yAxisId="a" orientation="right" stroke="#94A3B8" hide />
              <Tooltip contentStyle={{ background: "#1E293B", border: "1px solid #28354D" }} />
              <ReferenceLine yAxisId="u" y={70} stroke="#EF4444" strokeDasharray="4 4" /><ReferenceLine yAxisId="u" y={40} stroke="#F59E0B" strokeDasharray="4 4" />
              <Line yAxisId="u" dataKey="u" stroke="#60A5FA" dot={false} isAnimationActive={false} />
              <Line yAxisId="a" dataKey="a" stroke="#94A3B8" dot={false} isAnimationActive={false} />
            </LineChart></ResponsiveContainer></div>
        </section>
        <section className="rounded-lg border border-[#28354D] bg-[#151C2C] p-4">
          {d ? (<>
            <div className="text-xs text-[#94A3B8]">Cycle {d.cycle}/{d.n_cycles}</div>
            <div className="font-mono text-5xl" style={{ color: tierColor(d.urgency.tier) }}>{d.urgency.index}</div>
            <div className="mb-3 text-xs" style={{ color: tierColor(d.urgency.tier) }}>{tierLabel(d.urgency.tier)}</div>
            <div className="text-sm">Diagnosis: <b>{d.fault_class.replace("FAULT_", "")}</b> ({(d.fault_probs[d.fault_class] * 100).toFixed(0)}%)</div>
            <div className="text-sm">RUL: <span className="font-mono">{d.rul.toFixed(0)} ± {d.rul_sigma.toFixed(0)} cycles</span></div>
            <div className="mt-3 rounded bg-[#0B0F19] p-2 text-xs text-[#94A3B8]">
              P(fail in {d.cost.horizon_cycles} cycles) = {(d.cost.p_fail_within_horizon * 100).toFixed(0)}% · defer ≈ ${d.cost.expected_cost_defer.toLocaleString()} vs inspect ${d.cost.cost_act_now.toLocaleString()} → <b className="text-[#F8FAFC]">{d.cost.suggestion}</b>
            </div>
            {d.amm.map(a => <div key={a.code + a.task} className="mt-2 text-xs"><span className="font-mono text-[#60A5FA]">{a.code}</span> {a.task}</div>)}
          </>) : <p className="text-sm text-[#94A3B8]">Start the replay.</p>}
        </section>
        {full?.explain && (
          <section className="rounded-lg border border-[#28354D] bg-[#151C2C] p-4 lg:col-span-2">
            <h3 className="mb-1 text-sm text-[#94A3B8]">Why? Top drivers (TreeSHAP, {full.explain_ms} ms)</h3>
            <p className="mb-2 font-mono text-sm">{full.explain.top3.map(b => `${b.feature} ${b.arrow}`).join("  ·  ")}</p>
            <div className="h-72"><ResponsiveContainer>
              <BarChart data={full.explain.waterfall} layout="vertical" margin={{ left: 120 }}>
                <XAxis type="number" stroke="#94A3B8" /><YAxis type="category" dataKey="feature" stroke="#94A3B8" width={140} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#1E293B", border: "1px solid #28354D" }} />
                <Bar dataKey="shap" isAnimationActive={false}>{full.explain.waterfall.map((b, i) => <Cell key={i} fill={b.shap >= 0 ? "#EF4444" : "#3B82F6"} />)}</Bar>
              </BarChart></ResponsiveContainer></div>
          </section>)}
        {full && <DecisionPanel d={full} />}
      </div>
    </main>);
}
```

### 8.5 `src/app/audit/page.tsx`
```tsx
"use client";
import { useEffect, useState } from "react";
import { getJSON } from "@/lib/api";

type Row = { id: number; ts: string; engine_id: string; cycle: number; action: string; engineer_license: string; justification: string; entry_hash: string };

export default function Audit() {
  const [rows, setRows] = useState<Row[]>([]); const [v, setV] = useState<{ valid: boolean; broken_at_id: number | null } | null>(null);
  useEffect(() => { getJSON<Row[]>("/audit").then(setRows); getJSON<typeof v>("/audit/verify").then(setV); }, []);
  return (
    <main className="min-h-screen bg-[#0B0F19] p-8 text-[#F8FAFC]">
      <a href="/" className="text-sm text-[#60A5FA]">← Fleet</a>
      <h1 className="my-3 text-2xl font-semibold">Immutable audit trail</h1>
      {v && <div className={`mb-4 inline-block rounded px-3 py-1 text-sm ${v.valid ? "bg-[#10B98122] text-[#10B981]" : "bg-[#EF444422] text-[#EF4444]"}`}>{v.valid ? "Hash chain verified ✓" : `Chain broken at #${v.broken_at_id}`}</div>}
      <table className="w-full text-left text-sm"><thead className="text-[#94A3B8]"><tr><th className="p-2">#</th><th>Time (UTC)</th><th>Engine</th><th>Action</th><th>Licence</th><th>Justification</th><th>Hash</th></tr></thead>
        <tbody>{rows.map(r => <tr key={r.id} className="border-t border-[#28354D] align-top"><td className="p-2 font-mono">{r.id}</td><td className="font-mono text-xs">{r.ts.slice(0, 19)}</td><td>{r.engine_id} · c{r.cycle}</td><td>{r.action}</td><td className="font-mono">{r.engineer_license}</td><td className="max-w-md text-xs">{r.justification}</td><td className="font-mono text-xs text-[#94A3B8]">{r.entry_hash.slice(0, 12)}…</td></tr>)}</tbody></table>
    </main>);
}
```

---

## 9. Testing (this is your DO-178C-flavoured evidence)

`backend/tests/test_core.py`
```python
import numpy as np, pandas as pd, pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from src.data_pipeline.quality_checker import PHYSICS_NC, physics_violations, find_stuck
from src.models.evaluation import evaluate_alarms, nasa_score


def test_physics_violation_detected():
    df = pd.DataFrame(dict(P2=[15, 15], P24=[30, 10], P30=[500, 500], T2=[500, 500], T24=[640, 640], T30=[1500, 1500]))
    v = physics_violations(df, PHYSICS_NC)
    assert v["P2<P24"] == 0.5 and v["P24<P30"] == 0.0          # second row has P24 < P2
    assert physics_violations(df.assign(P24=[10, 10]), PHYSICS_NC)["P2<P24"] == 1.0


def test_stuck_sensor_flagged_but_constant_ignored():
    n = 40
    df = pd.DataFrame(dict(uid="a", cycle=range(n), s=np.r_[np.random.randn(20), np.ones(20)], const=1.0))
    out = find_stuck(df, ["s", "const"], window=10)
    assert "s" in out and "const" not in out


def test_alarm_metrics_lead_and_false_alarm():
    cyc = np.arange(1, 101)
    score = np.where(cyc >= 50, 1.0, 0.0)            # perfect detector from onset=50
    df = pd.DataFrame(dict(uid="u", cycle=cyc, s=score, onset_cycle=50, fail_cycle=100.0, is_virtual=False))
    r = evaluate_alarms(df, "s", 0.5, k=3, n=5).iloc[0]
    assert not r.fa_engine and r.detected and r.lead >= 45


def test_nasa_score_penalises_late_more():
    assert nasa_score([20], [10]) > nasa_score([0], [10])


def test_audit_chain_and_tamper_detection(monkeypatch, tmp_path):
    monkeypatch.setenv("AUDIT_DB", str(tmp_path / "t.db"))
    import importlib, src.api.db as db
    importlib.reload(db); db.init_db()
    with db.SessionLocal() as s:
        for i in range(3):
            db.append_entry(s, "E1", i, "ACCEPT", "LME-123456", "x" * 60, {"u": i})
        assert db.verify_chain(s)["valid"]
        with pytest.raises(Exception):
            s.execute(text("UPDATE audit_log SET justification='hacked' WHERE id=1")); s.commit()
        s.rollback()
        s.execute(text("DROP TRIGGER audit_no_update")); s.execute(text("UPDATE audit_log SET justification='hacked' WHERE id=2")); s.commit()
        assert db.verify_chain(s) == dict(valid=False, broken_at_id=2)
```
`backend/tests/test_api.py` (needs trained artifacts + `data/serving/fleet.parquet`)
```python
import time, numpy as np, pytest
from fastapi.testclient import TestClient
from src.api.main import app
from src.core.config import ARTIFACTS, SERVING

pytestmark = pytest.mark.skipif(not (ARTIFACTS / "meta.json").exists() or not (SERVING / "fleet.parquet").exists(),
                                reason="train the models and run scripts.export_serving first")


def test_endpoints_and_latency():
    with TestClient(app) as c:
        uid = c.get("/api/v1/decision/triage-queue").json()[0]["engine_id"]
        cyc = c.get("/api/v1/decision/triage-queue?frac=0.5").json()[0]["cycle"]
        lat = []
        for _ in range(30):
            t = time.perf_counter(); r = c.post("/api/v1/diagnostics/evaluate", json=dict(engine_id=uid, cycle=cyc)); lat.append(r.json()["explain_ms"])
        assert r.status_code == 200 and len(r.json()["explain"]["top3"]) == 3
        assert np.percentile(lat, 95) < 120                      # Objective 3: SHAP <= 120 ms (p95)
        assert c.post("/api/v1/decision/action", json=dict(engine_id=uid, cycle=cyc, action="ACCEPT", engineer_license="LME-123456", justification="short")).status_code == 422
        ok = c.post("/api/v1/decision/action", json=dict(engine_id=uid, cycle=cyc, action="DEFER", engineer_license="LME-123456", justification="Borescope scheduled at next A-check; trend stable within limits per AMM." * 1))
        assert ok.status_code == 201 and c.get("/api/v1/audit/verify").json()["valid"]
```
Run: `pytest -q` from `backend/`.

CI — `.github/workflows/ci.yml`
```yaml
name: ci
on: [push, pull_request]
jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: pip install -r backend/requirements-serve.txt pytest
      - run: cd backend && pytest -q tests/test_core.py
```
(`test_api.py` needs artifacts, so CI runs only the core tests; run the API test locally before deployment.)

---

## 10. Deployment (so you can present a live link)

### 10.1 Files

`Dockerfile` (repo root; build context = repo root)
```dockerfile
FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 VORTEX_ROOT=/srv
WORKDIR /srv/backend
COPY backend/requirements-serve.txt .
RUN pip install --no-cache-dir -r requirements-serve.txt
COPY backend/src ./src
COPY backend/artifacts ./artifacts
COPY data/serving /srv/data/serving
CMD ["sh", "-c", "uvicorn src.api.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
```
`.dockerignore`
```
data/raw
data/processed
**/.venv
**/node_modules
frontend
results
notebooks
```
`docker-compose.yml` (local full-stack test)
```yaml
services:
  api:
    build: .
    ports: ["8000:8000"]
    environment:
      CORS_ORIGINS: "http://localhost:3000"
      AUDIT_DB: /data/audit.db
    volumes: ["auditdata:/data"]
  web:
    image: node:20-alpine
    working_dir: /app
    volumes: ["./frontend:/app"]
    command: sh -c "npm install && npm run dev"
    environment: { NEXT_PUBLIC_API_URL: "http://localhost:8000/api/v1" }
    ports: ["3000:3000"]
volumes: { auditdata: {} }
```
Test: `docker compose up --build`.

### 10.2 Steps
1. **Before anything**: run `pytest`, then `uvicorn` locally, click through the whole demo once.
2. Commit `backend/artifacts/` (XGBoost JSON + IsolationForest joblib are small; if `iforest.joblib` is large, reduce `n_estimators` or use Git LFS) and `data/serving/fleet.parquet`. Keep `data/raw` and `data/processed` out of git.
3. **Backend host** (Render, Railway, or Fly.io — check each one's *current* free-tier limits, memory and sleep behaviour before choosing): create a Docker web service from the repo, set env vars:
   - `CORS_ORIGINS=https://<your-vercel-domain>` (comma-separate if several)
   - Audit persistence — pick one: (a) `DATABASE_URL=postgresql+psycopg://...` from a free managed Postgres (the code installs the append-only trigger for Postgres automatically; use a `postgresql+psycopg://` URL), or (b) SQLite on a mounted persistent disk with `AUDIT_DB=/data/audit.db`. **Without one of these, the audit log is wiped on every redeploy/restart** on most free hosts.
4. **Frontend on Vercel**: import the repo, root directory `frontend`, env `NEXT_PUBLIC_API_URL=https://<backend-url>/api/v1`.
5. Open `https://<backend>/api/v1/health` and `/docs`; then open the Vercel URL and run one full replay + one decision + `/audit/verify`.
6. **Presentation-day safety**: free backends sleep — hit `/health` 5 minutes before you present. Also keep a screen recording of a full demo and `docker compose up` working offline on your laptop as fallbacks.

Memory note: the slim image deliberately excludes PyTorch. The LSTM-AE is an offline benchmark; the *served* anomaly model is Isolation Forest. Say this explicitly in your architecture slide.

---

## 11. Demo script, slides, viva

### 11.1 Live demo (7 minutes)
1. **Fleet** (30 s): slider at 30% → mostly green; drag to 75% → amber/red engines rise to the top. "Ranked by urgency, not by engine number."
2. **Open a red engine → ▶ Replay** (60 s): urgency line climbs, crosses the amber line, then the red line. Point at the lead time: "alarm fired N cycles before failure; the fixed-threshold baseline fired M cycles later / had X% false alarms."
3. **Explain this cycle** (60 s): top-3 drivers (`T30 ↑`, `Ps30 ↓`…), SHAP bars, ms latency, AMM task list, cost-benefit line.
4. **Decision** (60 s): try a too-short justification → button disabled; write a real one → OVERRIDE → hash shown.
5. **Audit page** (30 s): chain ✓. Optional flourish: show the pytest tamper test.
6. **Sensor-drift engine** (60 s): classifier says SENSOR_DRIFT, not engine fault → different AMM tasks. This shows why two models beat one.
7. **Results slide** (60 s): the three acceptance numbers with honest wording.

### 11.2 Slide outline (10 slides)
1. Problem & cost (UER/IFSD $150K–$1.2M) 2. Objectives + acceptance criteria 3. Data (C-MAPSS + N-CMAPSS, corrections, physics checks) 4. Pipeline & leakage controls (engine-level splits) 5. Models (baseline vs IF vs LSTM-AE vs XGBoost) 6. Results table (lead, FAR, F1, RUL) 7. XAI + urgency + cost engine 8. Human-in-the-loop & audit chain 9. Architecture + deployment 10. Limitations & future work (real airline data, conformal intervals, drift monitoring, certification).

### 11.3 Likely viva questions
- *Why N-CMAPSS as well as C-MAPSS?* Only N-CMAPSS has true fault-mode ground truth and flight conditions; C-MAPSS gives comparability with literature.
- *Isn't sensor-drift label circular?* It's synthetic by design; injected on clean nominal segments, held-out at engine level, with different random parameters in test.
- *How do you prevent leakage?* Engine-level splits, past-only rolling features, normalization fitted on train nominal only.
- *How is FAR defined?* Persistent-alarm (3 of 5) rate on pre-onset cycles; calibrated on held-out validation engines; reported per-cycle and per-engine.
- *Why XGBoost not deep learning?* Tabular continuous features, exact fast TreeSHAP, literature standard; LSTM-AE used where temporal reconstruction matters.
- *Is this certifiable?* No — it's an advisory decision-support prototype; discuss DO-178C DAL-D-style traceability (requirements → tests) and human-in-the-loop as the safeguard.
- *What are your cost numbers based on?* Stated assumptions in `cost_model.py`; the framework matters, not the constants.
- *What if it's wrong?* Uncertainty band on RUL, override path, mandatory justification, immutable log.

---

## 12. Evidence checklist (map every claim to a file)

| Acceptance criterion | Evidence artifact |
|---|---|
| Completeness ≥ 99.98%, physics, stuck sensors | `results/quality_report_*.json` |
| Drift +0.05%/cycle, SNR ≥ 32 dB | `injector.py` constants + unit test |
| Lead time ≥ 35 cycles (C-MAPSS headline, N-CMAPSS also % of life) | `results/benchmark_*.json` → `share_lead_ge_35`, `median_lead_*` |
| FAR ≤ 2% | `far_cycle`, `far_engine` in benchmark JSON |
| Macro-F1 ≥ 0.91, precision ≥ 0.90 | `classifier.test_macro_f1`, `test_macro_precision` + confusion matrix |
| Baseline vs ML | `baseline_fixed_3sigma` vs `isolation_forest` vs `lstm_ae_*.json` |
| SHAP ≤ 120 ms | `test_api.py` (p95) + `explain_ms` in UI |
| Urgency 0–100, weights 35/35/30 | `urgency.py` + UI |
| 100% engineer actions logged, ≥ 50-char justification | `schemas.py` (422 test) + `/audit` |
| Tamper-evident | `test_audit_chain_and_tamper_detection` + `/audit/verify` |

**Figures to put in the report** (matplotlib, save to `results/`): anomaly score over an engine's life with threshold + onset + detection markers (baseline vs IF vs AE); lead-time histogram; confusion matrix; SHAP global summary (`shap.summary_plot` on a sample); latency histogram; urgency distribution by class; RUL predicted vs true.

---

## 13. Risks & fallbacks

| Risk | Fallback |
|---|---|
| Too few engines per class in the chosen DS files | Add another DS file; merge classes (already Fan+LPC); or drop a class and disclose it |
| N-CMAPSS h5 too big for RAM | Increase `stride` (e.g., 30), process one DS file at a time (already the case), use `float32` |
| Column names differ from assumptions (`hs`, `_mod`) | Fix in `label_units` after running `inspect_ncmapss.py` |
| Targets not met | Report honestly + error analysis; tune persistence (k/n), rolling window, more virtual drift units |
| Free host too slow / asleep | Warm up before presenting; local Docker + recorded demo as backup |
| LSTM-AE out of GPU memory | Lower the batch size (256 -> 64) or `T` (20 -> 10) |
| Docs out of sync with code | Update `Project_Overview.md`, `Requirements.md`, `Evaluation_Framework.md`, `System_Architecture.md` with §1 corrections; copy to `docs/` |

## 14. Stretch (only if time remains)

- **PSI drift monitor**: compare live feature distributions to train nominal; show a "data drift" badge.
- **Conformal RUL intervals**: split-conformal on validation residuals → guaranteed coverage bands.
- **Per-sensor AE contributions** in the UI for the anomaly branch (`score(..., per_feature=True)`).
- **PDF work-order export** (engine, diagnosis, top-3 drivers, AMM tasks, engineer justification, hash).
