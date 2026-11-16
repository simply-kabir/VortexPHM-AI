import numpy as np, pandas as pd, pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from src.data_pipeline.quality_checker import PHYSICS_NC, physics_violations, find_stuck
from src.models.evaluation import evaluate_alarms, nasa_score


def test_physics_violation_detected():
    df = pd.DataFrame(dict(P2=[15, 15], P24=[30, 10], P30=[500, 500], T2=[500, 500], T24=[640, 640], T30=[1500, 1500]))
    v = physics_violations(df, PHYSICS_NC)
    assert v["P2<P24"] == 0.5 and v["P24<P30"] == 0.0          # second row has P24 < P2
    assert physics_violations(df.assign(P24=[10, 10]), PHYSICS_NC)["P2<P24"] == 1.0


def test_stuck_sensor_flagged_but_constant_ignored():
    n = 40
    df = pd.DataFrame(dict(uid="a", cycle=range(n), s=np.r_[np.random.randn(20), np.ones(20)], const=1.0))
    out = find_stuck(df, ["s", "const"], window=10)
    assert "s" in out and "const" not in out


def test_alarm_metrics_lead_and_false_alarm():
    cyc = np.arange(1, 101)
    score = np.where(cyc >= 50, 1.0, 0.0)            # perfect detector from onset=50
    df = pd.DataFrame(dict(uid="u", cycle=cyc, s=score, onset_cycle=50, fail_cycle=100.0, is_virtual=False))
    r = evaluate_alarms(df, "s", 0.5, k=3, n=5).iloc[0]
    assert not r.fa_engine and r.detected and r.lead >= 45


def test_nasa_score_penalises_late_more():
    assert nasa_score([20], [10]) > nasa_score([0], [10])


def test_audit_chain_and_tamper_detection(monkeypatch, tmp_path):
    monkeypatch.setenv("AUDIT_DB", str(tmp_path / "t.db"))
    import importlib, src.api.db as db
    importlib.reload(db); db.init_db()
    with db.SessionLocal() as s:
        for i in range(3):
            db.append_entry(s, "E1", i, "ACCEPT", "LME-123456", "x" * 60, {"u": i})
        assert db.verify_chain(s)["valid"]
        with pytest.raises(Exception):
            s.execute(text("UPDATE audit_log SET justification='hacked' WHERE id=1")); s.commit()
        s.rollback()
        s.execute(text("DROP TRIGGER audit_no_update")); s.execute(text("UPDATE audit_log SET justification='hacked' WHERE id=2")); s.commit()
        assert db.verify_chain(s) == dict(valid=False, broken_at_id=2)
