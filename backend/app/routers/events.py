import json
from datetime import datetime
from fastapi import APIRouter, Query, HTTPException
from typing import Optional, List, Dict, Any
from app.db import get_db, set_baseline, get_latest_reading
from app.config import HIVE_ID, load_hive_config, save_hive_config
from app.models import HarvestRequest, BaselineRequest, RefractometerRequest, CalibrateRequest, InspectionRequest

router = APIRouter(prefix="/api", tags=["events"])

@router.get("/events")
async def get_events(
    hive_id: str = HIVE_ID,
    event_type: str = Query("all", alias="type"),
    limit: int = 50
):
    async with get_db() as db:
        results = []

        if event_type in ["all", "state"]:
            c = await db.execute("SELECT id, hive_id, ts, 'state' as kind, state, moisture_est_pct, confidence, honey_mass_kg, note FROM honey_events WHERE hive_id = ? ORDER BY ts DESC LIMIT ?", (hive_id, limit))
            for r in await c.fetchall():
                results.append(dict(r))

        if event_type in ["all", "alert"]:
            c = await db.execute("SELECT id, hive_id, ts, 'alert' as kind, rule_id, severity, message, value, acknowledged FROM alerts WHERE hive_id = ? ORDER BY ts DESC LIMIT ?", (hive_id, limit))
            for r in await c.fetchall():
                results.append(dict(r))

        if event_type in ["all", "calibration"]:
            c = await db.execute("SELECT id, hive_id, ts, 'calibration' as kind, kind as cal_kind, before_json, after_json, operator FROM calibrations WHERE hive_id = ? ORDER BY ts DESC LIMIT ?", (hive_id, limit))
            for r in await c.fetchall():
                results.append(dict(r))

        if event_type in ["all", "harvest"]:
            c = await db.execute("SELECT id, hive_id, ts, 'harvest' as kind, honey_kg, frames, moisture_pct_lab, note, batch_hash, tx_hash FROM harvests WHERE hive_id = ? ORDER BY ts DESC LIMIT ?", (hive_id, limit))
            for r in await c.fetchall():
                results.append(dict(r))

        # Sort all by ts desc
        results.sort(key=lambda x: x.get("ts", ""), reverse=True)
        return {"events": results[:limit]}

@router.post("/events/harvest")
async def log_harvest(req: HarvestRequest):
    now_ts = datetime.now().isoformat()
    # Generate mock Polygon Amoy batch hash & tx hash
    import hashlib
    batch_raw = f"{req.hive_id}:{now_ts}:{req.honey_kg}:{req.moisture_pct_lab}"
    batch_hash = "0x" + hashlib.sha256(batch_raw.encode()).hexdigest()[:48]
    tx_hash = "0x" + hashlib.sha256((batch_raw + ":tx").encode()).hexdigest()[:48]

    async with get_db() as db:
        await db.execute("""
        INSERT INTO harvests (hive_id, ts, honey_kg, frames, moisture_pct_lab, note, batch_hash, tx_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (req.hive_id, now_ts, req.honey_kg, req.frames, req.moisture_pct_lab, req.note, batch_hash, tx_hash))

        # Record honey event HARVESTED
        await db.execute("""
        INSERT INTO honey_events (hive_id, ts, state, moisture_est_pct, confidence, honey_mass_kg, note)
        VALUES (?, ?, 'HARVESTED', ?, 1.0, ?, ?)
        """, (req.hive_id, now_ts, req.moisture_pct_lab or 18.0, req.honey_kg, f"Harvested {req.honey_kg} kg across {req.frames} frames. {req.note}"))

        await db.commit()

    return {"status": "success", "batch_hash": batch_hash, "tx_hash": tx_hash}

@router.post("/baseline")
async def update_baseline(req: BaselineRequest):
    now_ts = datetime.now().isoformat()
    if req.baseline_kg is not None:
        new_baseline = req.baseline_kg
    else:
        # Default to current gross weight
        latest = await get_latest_reading(req.hive_id)
        new_baseline = latest["gross_kg"] if latest else 38.5

    await set_baseline(req.hive_id, new_baseline, now_ts, req.note)
    return {"status": "success", "baseline_kg": new_baseline, "ts": now_ts}

@router.post("/refractometer")
async def log_refractometer(req: RefractometerRequest):
    now_ts = datetime.now().isoformat()
    # Back-fit EWMA offset in config
    cfg = load_hive_config()
    cal = cfg.get("calibration", {})
    curr_offset = cal.get("refractometer_offset_pct", 0.0)

    # Latest model estimated moisture
    latest = await get_latest_reading(req.hive_id)
    rh = latest.get("rh_in_pct", 55.0) if latest else 55.0
    t = latest.get("t_in_c", 34.5) if latest else 34.5
    raw_est = 17.4 + (t - 20) * 0.03  # approximate base

    measured = req.moisture_pct
    delta = measured - raw_est
    # EWMA update (alpha = 0.3)
    new_offset = round(0.7 * curr_offset + 0.3 * delta, 2)

    cal["refractometer_offset_pct"] = new_offset
    cfg["calibration"] = cal
    save_hive_config(cfg)

    async with get_db() as db:
        await db.execute("""
        INSERT INTO calibrations (hive_id, ts, kind, before_json, after_json, operator)
        VALUES (?, ?, 'refractometer', ?, ?, ?)
        """, (
            req.hive_id, now_ts,
            json.dumps({"offset_pct": curr_offset}),
            json.dumps({"offset_pct": new_offset, "lab_moisture": measured, "note": req.note}),
            req.operator
        ))
        await db.commit()

    return {
        "status": "success",
        "measured_pct": measured,
        "new_offset_pct": new_offset,
        "ts": now_ts
    }

@router.post("/calibrate")
async def calibrate_hardware(req: CalibrateRequest):
    now_ts = datetime.now().isoformat()
    cfg = load_hive_config()
    cal = cfg.get("calibration", {})
    before_json = json.dumps(cal)

    if req.kind == "tare":
        raw = req.raw_counts or 812000
        cal["counts_tare"] = raw
    elif req.kind == "known_mass" and req.known_mass_kg and req.raw_counts:
        tare = cal.get("counts_tare", 812000)
        counts_per_kg = round((req.raw_counts - tare) / req.known_mass_kg, 1)
        cal["counts_per_kg"] = counts_per_kg

    cfg["calibration"] = cal
    save_hive_config(cfg)

    async with get_db() as db:
        await db.execute("""
        INSERT INTO calibrations (hive_id, ts, kind, before_json, after_json, operator)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (req.hive_id, now_ts, req.kind, before_json, json.dumps(cal), req.operator))
        await db.commit()

    return {"status": "success", "calibration": cal, "ts": now_ts}

@router.get("/inspections")
async def get_inspections(hive_id: str = HIVE_ID):
    async with get_db() as db:
        cursor = await db.execute("SELECT * FROM inspections WHERE hive_id = ? ORDER BY ts DESC", (hive_id,))
        rows = await cursor.fetchall()
        return {"inspections": [dict(r) for r in rows]}

@router.post("/inspections")
async def add_inspection(req: InspectionRequest):
    now_ts = datetime.now().isoformat()
    async with get_db() as db:
        await db.execute("""
        INSERT INTO inspections (hive_id, ts, note, photo_path)
        VALUES (?, ?, ?, ?)
        """, (req.hive_id, now_ts, req.note, req.photo_path))
        await db.commit()
    return {"status": "success", "ts": now_ts}

@router.post("/alerts/{alert_id}/ack")
async def acknowledge_alert(alert_id: int):
    async with get_db() as db:
        await db.execute("UPDATE alerts SET acknowledged = 1 WHERE id = ?", (alert_id,))
        await db.commit()
    return {"status": "success", "alert_id": alert_id}
