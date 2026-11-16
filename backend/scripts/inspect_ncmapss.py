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
