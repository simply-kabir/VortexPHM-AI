"""Utility to add or manage engines in the active serving fleet: data/serving/fleet.parquet

Usage:
  python -m scripts.add_engine --list
  python -m scripts.add_engine --uid DS02-006-t-u11
  python -m scripts.add_engine --all
"""
import argparse
import pandas as pd
from src.core.config import PROC, SERVING
from src.data_pipeline.features import add_temporal_features


def get_current_fleet_uids() -> set[str]:
    fleet_file = SERVING / "fleet.parquet"
    if not fleet_file.exists():
        return set()
    df = pd.read_parquet(fleet_file, columns=["uid"])
    return set(df.uid.unique())


def list_available_engines():
    df = pd.read_parquet(PROC / "ncmapss.parquet", columns=["uid", "cycle", "split", "fault_class", "is_virtual"])
    current_uids = get_current_fleet_uids()

    summary = (
        df.groupby(["uid", "split", "fault_class", "is_virtual"])
        .size()
        .reset_index(name="cycle_count")
    )
    print(f"\n{'='*75}")
    print(f"AVAILABLE ENGINES IN DATASET ({len(summary)} entries, {df.uid.nunique()} unique engines):")
    print(f"{'='*75}")
    print(f"{'UID':<26} {'Split':<6} {'Fault Class':<22} {'Cycles':<8} {'In Fleet?'}")
    print(f"{'-'*75}")

    for _, row in summary.iterrows():
        in_fleet = "✅ ACTIVE" if row.uid in current_uids else "  No"
        print(f"{row.uid:<26} {row.split:<6} {row.fault_class:<22} {row.cycle_count:<8} {in_fleet}")
    print(f"{'='*75}\n")


def add_engine_by_uid(uid: str):
    df = pd.read_parquet(PROC / "ncmapss.parquet")
    engine_rows = df[df.uid == uid]
    if engine_rows.empty:
        print(f"❌ Error: Engine UID '{uid}' not found in {PROC / 'ncmapss.parquet'}")
        print("Run 'python -m scripts.add_engine --list' to see valid engine IDs.")
        return

    # Add temporal rolling & trend features
    z = [c for c in df.columns if c.endswith("_z")]
    engine_features = add_temporal_features(engine_rows, z)

    fleet_file = SERVING / "fleet.parquet"
    if fleet_file.exists():
        fleet = pd.read_parquet(fleet_file)
        if uid in set(fleet.uid):
            print(f"⚠️ Engine '{uid}' is already in the fleet ({len(engine_rows)} cycles). Updating...")
            fleet = fleet[fleet.uid != uid]
        updated = pd.concat([fleet, engine_features], ignore_index=True)
    else:
        updated = engine_features

    SERVING.mkdir(parents=True, exist_ok=True)
    updated.sort_values(["uid", "cycle"]).to_parquet(fleet_file)
    print(f"✅ Successfully added '{uid}' ({len(engine_rows)} cycles) to fleet. Total fleet size: {updated.uid.nunique()} engines.")


def add_all_test_engines():
    df = pd.read_parquet(PROC / "ncmapss.parquet")
    test = df[df.split == "test"]
    z = [c for c in df.columns if c.endswith("_z")]
    test_features = add_temporal_features(test, z)

    fleet_file = SERVING / "fleet.parquet"
    SERVING.mkdir(parents=True, exist_ok=True)
    test_features.sort_values(["uid", "cycle"]).to_parquet(fleet_file)
    print(f"✅ Exported ALL test engines ({test_features.uid.nunique()} engines, {len(test_features)} total cycles) to fleet.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Add or list engines in the VortexPHM fleet.")
    parser.add_argument("--list", action="store_true", help="List all available engines in the NASA dataset")
    parser.add_argument("--uid", type=str, help="Specific Engine UID to add into the fleet")
    parser.add_argument("--all", action="store_true", help="Add all test engines from NASA N-CMAPSS into the fleet")
    args = parser.parse_args()

    if args.list:
        list_available_engines()
    elif args.uid:
        add_engine_by_uid(args.uid)
    elif args.all:
        add_all_test_engines()
    else:
        parser.print_help()
