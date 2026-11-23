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


DEFAULT_SEEDS = [
    ("DS01-005-t-u7", 72, "ACCEPT", "FAA-A&P-389104", "Confirmed HPT thermal distress signature. Thermocouple T48 shows +38K delta above normal regime. Scheduled boroscope inspection under AMM 72-00-00.",
     {"fault_class": "FAULT_HPT_THERMAL", "urgency": {"tier": 1, "index": 0.88}, "rul": 14.2, "anomaly_score": 0.912}),
    ("DS02-006-t-u2", 45, "OVERRIDE", "EASA-66-B1-94812", "Overrode urgent ground order to defer. Sensor drift isolated to transducer P25 harness grounding after pre-flight continuity test. Recalibrated harness; released under ETOPS MEL.",
     {"fault_class": "FAULT_SENSOR_DRIFT", "urgency": {"tier": 2, "index": 0.64}, "rul": 58.0, "anomaly_score": 0.684}),
    ("DS01-005-t-u3", 89, "ACCEPT", "DGCA-AME-50219", "Endorsed AI decision to ground engine immediately. High vibrational frequency and low RUL indicate severe LPT blade tip rubbing. Aircraft pulled from rotation.",
     {"fault_class": "FAULT_LPT", "urgency": {"tier": 1, "index": 0.95}, "rul": 6.8, "anomaly_score": 0.978}),
    ("DS02-006-t-u5", 28, "DEFER", "FAA-A&P-441209", "Minor core pressure divergence within allowable standard deviation. Cleared for scheduled 3-leg daily domestic operation with automated telemetry watch.",
     {"fault_class": "NOMINAL", "urgency": {"tier": 3, "index": 0.22}, "rul": 134.5, "anomaly_score": 0.281}),
    ("DS01-005-t-u1", 62, "ACCEPT", "EASA-66-B1-88123", "HPT thermal degradation confirmed by borescope port 3 analysis. Accelerated shop visit dispatched to overhaul facility.",
     {"fault_class": "FAULT_HPT_THERMAL", "urgency": {"tier": 1, "index": 0.81}, "rul": 22.1, "anomaly_score": 0.845}),
    ("DS02-006-t-u14", 52, "ACCEPT", "FAA-A&P-591024", "Low pressure turbine shroud seal degradation confirmed by exhaust gas temperature trend. Maintenance action initiated per AMM 72-51-00.",
     {"fault_class": "FAULT_LPT", "urgency": {"tier": 2, "index": 0.72}, "rul": 28.5, "anomaly_score": 0.765}),
    ("DS01-005-t-u8", 65, "OVERRIDE", "EASA-66-B1-71049", "Overrode Tier 1 ground recommendation. Transient EGT spike occurred during maximum takeoff thrust in hot-and-high conditions. Subsequent cruise telemetry stabilized at nominal levels.",
     {"fault_class": "FAULT_HPT_THERMAL", "urgency": {"tier": 1, "index": 0.84}, "rul": 18.0, "anomaly_score": 0.862}),
    ("DS02-006-t-u11", 35, "DEFER", "DGCA-AME-61092", "Slight core spool oscillation within acceptable threshold limits. Cleared for 25 additional flight cycles under automated health monitoring.",
     {"fault_class": "NOMINAL", "urgency": {"tier": 3, "index": 0.29}, "rul": 112.0, "anomaly_score": 0.310})
]


def seed_if_empty():
    with SessionLocal() as s:
        count = s.scalar(select(AuditLog).limit(1))
        if count is None:
            for e in DEFAULT_SEEDS:
                append_entry(s, e[0], e[1], e[2], e[3], e[4], e[5])


def init_db():
    Base.metadata.create_all(engine)
    seed_if_empty()
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
