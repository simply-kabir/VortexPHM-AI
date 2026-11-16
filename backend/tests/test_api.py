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
