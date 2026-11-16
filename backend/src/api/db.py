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
