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
