import pytest
from app.alerts import AlertsEngine

def test_all_12_alerts():
    engine = AlertsEngine()

    base_reading = {
        "hive_id": "HIVE-01",
        "ts": "2026-10-08T12:00:00+05:30",
        "t_in_c": 34.5,
        "rh_in_pct": 55.0,
        "gross_kg": 40.0,
        "freq_dom_hz": 193.0,
        "spl_db": -28.0,
        "band_act": 0.2,
        "band_pip": 0.05
    }
    base_honey = {"moisture_est_pct": 18.2, "state": "RAW"}
    base_stats = {
        "activity_index": 45.0,
        "weight_drop_6h_kg": 0.0,
        "weight_drop_24h_kg": 0.0,
        "spl_db_p95": -24.0,
        "median_night_loss_kg": 0.15,
        "current_night_loss_kg": 0.10,
        "last_seen_seconds": 2.0,
        "check_weight_dev_kg": 0.0,
        "is_daylight": True,
        "weight_slope_1h_kg": 0.05
    }

    # 1. SWARM_EVENT
    stats_swarm = dict(base_stats, weight_drop_6h_kg=1.8)
    reading_swarm = dict(base_reading, band_act=0.35)
    alerts = engine.evaluate(reading_swarm, base_honey, stats_swarm)
    assert any(a["rule_id"] == "SWARM_EVENT" and a["severity"] == "critical" for a in alerts)

    # 2. ABSCONDING
    stats_abscond = dict(base_stats, weight_drop_24h_kg=3.5, activity_index=10.0)
    alerts = engine.evaluate(base_reading, base_honey, stats_abscond)
    assert any(a["rule_id"] == "ABSCONDING" and a["severity"] == "critical" for a in alerts)

    # 3. QUEENLESS_SUSPECT
    reading_ql = dict(base_reading, spl_db=-18.0, freq_dom_hz=215.0)
    alerts = engine.evaluate(reading_ql, base_honey, base_stats)
    assert any(a["rule_id"] == "QUEENLESS_SUSPECT" and a["severity"] == "warning" for a in alerts)

    # 4. BROOD_OVERHEAT
    reading_hot = dict(base_reading, t_in_c=37.2)
    alerts = engine.evaluate(reading_hot, base_honey, base_stats)
    assert any(a["rule_id"] == "BROOD_OVERHEAT" and a["severity"] == "critical" for a in alerts)

    # 5. BROOD_TOO_COLD
    reading_cold = dict(base_reading, t_in_c=31.2)
    alerts = engine.evaluate(reading_cold, base_honey, base_stats)
    assert any(a["rule_id"] == "BROOD_TOO_COLD" and a["severity"] == "warning" for a in alerts)

    # 6. HUMIDITY_OUT
    reading_humid = dict(base_reading, rh_in_pct=76.0)
    alerts = engine.evaluate(reading_humid, base_honey, base_stats)
    assert any(a["rule_id"] == "HUMIDITY_OUT" and a["severity"] == "warning" for a in alerts)

    # 7. HONEY_UNRIPE
    honey_wet = {"moisture_est_pct": 21.8, "state": "RAW"}
    alerts = engine.evaluate(base_reading, honey_wet, base_stats)
    assert any(a["rule_id"] == "HONEY_UNRIPE" and a["severity"] == "warning" for a in alerts)

    # 8. HONEY_READY
    honey_ready = {"moisture_est_pct": 17.8, "state": "COMPLETED"}
    alerts = engine.evaluate(base_reading, honey_ready, base_stats)
    assert any(a["rule_id"] == "HONEY_READY" and a["severity"] == "info" for a in alerts)

    # 9. ROBBING_SUSPECT
    stats_robbing = dict(base_stats, is_daylight=True, weight_slope_1h_kg=-0.6)
    reading_robbing = dict(base_reading, spl_db=-22.0, band_act=0.45)
    alerts = engine.evaluate(reading_robbing, base_honey, stats_robbing)
    assert any(a["rule_id"] == "ROBBING_SUSPECT" and a["severity"] == "warning" for a in alerts)

    # 10. NODE_OFFLINE
    stats_offline = dict(base_stats, last_seen_seconds=360.0)
    alerts = engine.evaluate(base_reading, base_honey, stats_offline)
    assert any(a["rule_id"] == "NODE_OFFLINE" and a["severity"] == "critical" for a in alerts)

    # 11. LOADCELL_DRIFT
    stats_drift = dict(base_stats, check_weight_dev_kg=0.25)
    alerts = engine.evaluate(base_reading, base_honey, stats_drift)
    assert any(a["rule_id"] == "LOADCELL_DRIFT" and a["severity"] == "warning" for a in alerts)

    # 12. NIGHT_LOSS_SPIKE
    stats_spike = dict(base_stats, is_daylight=False, median_night_loss_kg=0.08, current_night_loss_kg=0.35)
    alerts = engine.evaluate(base_reading, base_honey, stats_spike)
    assert any(a["rule_id"] == "NIGHT_LOSS_SPIKE" and a["severity"] == "info" for a in alerts)
