"""python -m scripts.export_serving   -> data/serving/fleet.parquet (8-12 test engines with full fault diversity)"""
import argparse, numpy as np, pandas as pd
from src.core.config import PROC, SERVING
from src.data_pipeline.features import add_temporal_features


def main(all_engines: bool = False, limit: int = 10):
    df = pd.read_parquet(PROC / "ncmapss.parquet")
    z = [c for c in df.columns if c.endswith("_z")]
    df = add_temporal_features(df, z)
    test = df[df.split == "test"]

    if all_engines:
        keep = test
    else:
        pick = []
        # Pick diverse fault classes from test split
        for cls in ["FAULT_HPT_THERMAL", "FAULT_LPT", "FAULT_SENSOR_DRIFT"]:
            ids = test[test.fault_class == cls].uid.drop_duplicates().tolist()
            pick += ids[:3]
        # Also pick real uncontained/unmodified engines
        real_ids = test[test.is_virtual == False].uid.drop_duplicates().tolist()
        pick += real_ids[:4]
        # Keep unique list up to limit
        unique_pick = list(dict.fromkeys(pick))[:limit]
        keep = test[test.uid.isin(set(unique_pick))]

    SERVING.mkdir(parents=True, exist_ok=True)
    keep.to_parquet(SERVING / "fleet.parquet")
    print(f"Exported {keep.uid.nunique()} engines to {SERVING / 'fleet.parquet'}:")
    for uid, count in keep.groupby("uid").size().items():
        fc = keep[keep.uid == uid].fault_class.dropna().unique().tolist()
        print(f"  - {uid}: {count} cycles, classes: {fc}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--all", action="store_true", help="Export all available test engines")
    parser.add_argument("--limit", type=int, default=10, help="Max engines to include")
    args = parser.parse_args()
    main(all_engines=args.all, limit=args.limit)
