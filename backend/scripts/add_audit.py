"""Utility to inspect, verify, or add airworthiness decisions to the cryptographic audit trail.

Usage:
  python -m scripts.add_audit --list
  python -m scripts.add_audit --verify
  python -m scripts.add_audit --seed
  python -m scripts.add_audit --action ACCEPT --engine DS01-005-t-u7 --cycle 72 --license FAA-A&P-389104 --justification "Confirmed HPT thermal distress. Borescope inspection scheduled."
"""
import argparse
from sqlalchemy import select
from src.api.db import SessionLocal, AuditLog, append_entry, verify_chain, DEFAULT_SEEDS


def list_audits():
    with SessionLocal() as s:
        rows = s.scalars(select(AuditLog).order_by(AuditLog.id)).all()
        print(f"\n{'='*85}")
        print(f"CRYPTOGRAPHIC AIRWORTHINESS AUDIT TRAIL ({len(rows)} entries):")
        print(f"{'='*85}")
        print(f"{'ID':<4} {'Date (UTC)':<12} {'Engine & Cycle':<20} {'Action':<10} {'License':<18} {'Hash (SHA-256)':<16}")
        print(f"{'-'*85}")
        for r in rows:
            print(f"#{r.id:<3} {r.ts[:10]:<12} {r.engine_id + ' c' + str(r.cycle):<20} {r.action:<10} {r.engineer_license:<18} {r.entry_hash[:12]}…")
        print(f"{'='*85}")
        res = verify_chain(s)
        status = "✅ 100% VALID & TAMPER-PROOF" if res["valid"] else f"❌ BROKEN AT #{res['broken_at_id']}"
        print(f"Chain Integrity Status: {status}\n")


def check_verification():
    with SessionLocal() as s:
        res = verify_chain(s)
        if res["valid"]:
            print("✅ Cryptographic Audit Chain is 100% VALID. All SHA-256 parent links verified.")
        else:
            print(f"❌ Cryptographic Audit Chain BROKEN at entry #{res['broken_at_id']}.")


def seed_extra_audits():
    with SessionLocal() as s:
        print("Seeding realistic FAA / EASA airworthiness audit decisions...")
        for e in DEFAULT_SEEDS:
            row = append_entry(s, e[0], e[1], e[2], e[3], e[4], e[5])
            print(f"  + Added Entry #{row.id}: {row.action} on {row.engine_id} by {row.engineer_license}")
        print("Verification:", verify_chain(s))


def add_single_audit(engine: str, cycle: int, action: str, license_id: str, justification: str):
    if len(justification.strip()) < 50:
        print("⚠️ Warning: Aviation regulations require technical justification to be at least 50 characters.")
    with SessionLocal() as s:
        snap = {
            "fault_class": "FAULT_HPT_THERMAL" if "HPT" in justification.upper() else "FAULT_LPT" if "LPT" in justification.upper() else "NOMINAL",
            "urgency": {"tier": 1 if action == "ACCEPT" else 2, "index": 0.85},
            "rul": 15.0,
            "anomaly_score": 0.89,
        }
        row = append_entry(s, engine, cycle, action.upper(), license_id, justification.strip(), snap)
        print(f"✅ Successfully committed Entry #{row.id}!")
        print(f"   Action: {row.action} | Engine: {row.engine_id} (Cycle {row.cycle})")
        print(f"   License: {row.engineer_license}")
        print(f"   Previous Hash: {row.prev_hash}")
        print(f"   Entry Hash:    {row.entry_hash}")
        print("   Integrity Check:", verify_chain(s))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="VortexPHM-AI Audit Trail Manager")
    parser.add_argument("--list", action="store_true", help="List all audit entries")
    parser.add_argument("--verify", action="store_true", help="Verify cryptographic chain")
    parser.add_argument("--seed", action="store_true", help="Seed realistic airworthiness audits")
    parser.add_argument("--action", choices=["ACCEPT", "OVERRIDE", "DEFER"], help="Action taken")
    parser.add_argument("--engine", type=str, help="Engine UID")
    parser.add_argument("--cycle", type=int, default=70, help="Flight cycle")
    parser.add_argument("--license", type=str, help="Engineer license (e.g. FAA-A&P-389104)")
    parser.add_argument("--justification", type=str, help="Technical rationale (min 50 chars)")
    args = parser.parse_args()

    if args.list:
        list_audits()
    elif args.verify:
        check_verification()
    elif args.seed:
        seed_extra_audits()
    elif args.action and args.engine and args.license and args.justification:
        add_single_audit(args.engine, args.cycle, args.action, args.license, args.justification)
    else:
        parser.print_help()
