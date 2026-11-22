from __future__ import annotations
import asyncio, json, os
from contextlib import asynccontextmanager
from fastapi import APIRouter, Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session
from src.api import db
from src.api.schemas import AddEngineIn, DecisionIn, DiagnoseIn
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


@api.get("/fleet/available")
def available_engines():
    from src.core.config import PROC
    import pandas as pd
    proc_file = PROC / "ncmapss.parquet"
    if not proc_file.exists():
        return []
    df = pd.read_parquet(proc_file, columns=["uid", "split", "fault_class", "is_virtual"])
    active = set(svc.by_uid.keys())
    summary = df.groupby(["uid", "split", "fault_class", "is_virtual"]).size().reset_index(name="cycles")
    res = []
    for _, r in summary.iterrows():
        res.append(dict(uid=r["uid"], split=r["split"], fault_class=r["fault_class"],
                        is_virtual=bool(r["is_virtual"]), cycles=int(r["cycles"]),
                        active=r["uid"] in active))
    return res


@api.post("/fleet/add", status_code=201)
def add_engine(body: AddEngineIn):
    if body.tail_number:
        return svc.synthesize_engine(tail_number=body.tail_number.strip().upper(), fault_class=body.fault_class or "FAULT_HPT_THERMAL")
    elif body.uid:
        try:
            return svc.add_engine_from_dataset(body.uid.strip())
        except KeyError:
            raise HTTPException(404, f"Engine {body.uid} not found in dataset")
    raise HTTPException(400, "Must provide either 'uid' or 'tail_number'")


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

    series = svc.diagnose_series(uid)

    async def gen():
        for item in series:
            yield f"data: {json.dumps(item)}\n\n"
            if speed > 0:
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
                 justification=r.justification, entry_hash=r.entry_hash, prev_hash=r.prev_hash, snapshot=r.snapshot) for r in rows]


@api.get("/audit/verify")
def audit_verify(s: Session = Depends(get_db)): return db.verify_chain(s)


@api.get("/metrics/benchmark")
def benchmark():
    """Benchmark and quality JSON files written by the evaluation scripts (empty until they have been run)."""
    return {p.stem: json.loads(p.read_text()) for p in sorted(RESULTS.glob("*.json"))}


app.include_router(api, prefix="/api/v1")      # all routes live under /api/v1 (Swagger stays at /docs)
