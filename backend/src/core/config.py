import os
from pathlib import Path

ROOT = Path(os.getenv("VORTEX_ROOT", Path(__file__).resolve().parents[3]))
DATA = ROOT / "data"
RAW, PROC, SERVING = DATA / "raw", DATA / "processed", DATA / "serving"
ARTIFACTS = ROOT / "backend" / "artifacts"
RESULTS = ROOT / "results"

T_REF_R, P_REF_PSIA = 518.67, 14.696      # sea-level standard, Rankine / psia (NASA sets use these units)

NOMINAL = "NOMINAL"
CLASSES = ["NOMINAL", "FAULT_HPC_EFFICIENCY", "FAULT_FAN_LPC", "FAULT_HPT_THERMAL", "FAULT_LPT", "FAULT_SENSOR_DRIFT"]
MODULE_TO_CLASS = {
    "fan": "FAULT_FAN_LPC", "LPC": "FAULT_FAN_LPC",
    "HPC": "FAULT_HPC_EFFICIENCY", "HPT": "FAULT_HPT_THERMAL",
    "LPT": "FAULT_LPT",              # the N-CMAPSS files DS01/DS02 contain HPT and LPT faults (no Fan/LPC/HPC)
}
RUL_CAP = 125
PERSIST_K, PERSIST_N = 3, 5           # alarm = >=3 flags in the last 5 cycles
SEED = 42
BASELINE_K = 6          # cycles used as each engine's own commissioning baseline
