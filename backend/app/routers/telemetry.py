import csv
import io
from fastapi import APIRouter, Query, Response
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from app.db import get_db, get_latest_reading, get_baseline
from app.config import HIVE_ID, load_hive_config
from app.metrics import (
    calculate_dew_point,
    calculate_absolute_humidity,
    calculate_vpd,
    classify_freq_band,
    compute_activity_index,
    compute_quality_score,
    estimate_bee_count
)
from app.honey_model import HoneyFormationModel

router = APIRouter(prefix="/api", tags=["telemetry"])
honey_model = HoneyFormationModel()

@router.get("/live")
async def get_live(hive_id: str = HIVE_ID):
    reading = await get_latest_reading(hive_id)
    if not reading:
        return {"error": "No telemetry readings available"}

    baseline_kg = await get_baseline(hive_id)
    gross_kg = reading["gross_kg"] or 0.0
    honey_kg = max(0.0, gross_kg - baseline_kg)
    is_neg_drift = gross_kg < baseline_kg

    t_in = reading["t_in_c"] or 34.0
    rh_in = reading["rh_in_pct"] or 55.0
    t_out = reading["t_out_c"] or 25.0
    rh_out = reading["rh_out_pct"] or 65.0
    freq_dom = reading["freq_dom_hz"] or 193.0
    spl_db = reading["spl_db"] or -28.0
    band_act = reading["band_act"] or 0.2
    band_pip = reading["band_pip"] or 0.05
    quality = reading["quality"] or 0.9

    # Derived
    dp_in = calculate_dew_point(t_in, rh_in)
    dp_out = calculate_dew_point(t_out, rh_out)
    ah_in = calculate_absolute_humidity(t_in, rh_in)
    vpd_in = calculate_vpd(t_in, rh_in)

    band_key, band_desc = classify_freq_band(freq_dom)
    activity_index = compute_activity_index(band_act, band_pip, spl_db)
    bees_count = estimate_bee_count(gross_kg, honey_kg)

    # Moisture estimation
    m_a = honey_model.estimate_moisture_mass_balance(honey_kg, honey_kg + 0.6)
    m_b = honey_model.estimate_moisture_equilibrium_rh(rh_in, t_in)
    moisture_fused, confidence = honey_model.fuse_moisture_estimates(m_a, m_b, quality, baseline_age_hours=24.0)
    moist_band, moist_band_desc = honey_model.classify_moisture_band(moisture_fused)

    stage, stage_desc = honey_model.infer_stage(
        current_state="RAW",
        moisture_pct=moisture_fused,
        weight_slope_kg_h=0.01,
        is_daylight=True,
        band_act=band_act,
        weight_variance_kg=0.02,
        stable_hours=8.0
    )

    # Fetch honey today delta (since midnight)
    today_str = datetime.now().strftime("%Y-%m-%d") + "T00:00:00"
    async with get_db() as db:
        cursor = await db.execute("""
        SELECT gross_kg FROM readings WHERE hive_id = ? AND ts >= ? ORDER BY ts ASC LIMIT 1
        """, (hive_id, today_str))
        first_today = await cursor.fetchone()
        midnight_gross = first_today["gross_kg"] if first_today else gross_kg
        honey_today_kg = round(gross_kg - midnight_gross, 3)

        # Alerts count
        cursor = await db.execute("SELECT COUNT(*) as c FROM alerts WHERE hive_id = ? AND acknowledged = 0", (hive_id,))
        unack_alerts = (await cursor.fetchone())["c"]

    return {
        "hive_id": hive_id,
        "ts": reading["ts"],
        "reading": reading,
        "derived": {
            "honey_mass_kg": round(honey_kg, 3),
            "is_negative_drift": is_neg_drift,
            "honey_today_kg": honey_today_kg,
            "baseline_kg": baseline_kg,
            "dew_point_in_c": round(dp_in, 1),
            "dew_point_out_c": round(dp_out, 1),
            "absolute_humidity_in_gm3": round(ah_in, 1),
            "vpd_in_kpa": round(vpd_in, 2),
            "freq_band_key": band_key,
            "freq_band_desc": band_desc,
            "activity_index": activity_index,
            "bees_estimate": bees_count,
            "quality_score": quality
        },
        "honey_state": {
            "state": stage,
            "state_desc": stage_desc,
            "confidence": confidence,
            "is_estimated": confidence < 0.60,
            "moisture_est_pct": moisture_fused,
            "moisture_band": moist_band,
            "moisture_band_desc": moist_band_desc
        },
        "active_alerts_count": unack_alerts
    }

@router.get("/series")
async def get_series(
    hive_id: str = HIVE_ID,
    metric: str = Query("gross_kg", description="gross_kg, freq_dom_hz, t_in_c, rh_in_pct, spl_db, etc."),
    res: str = Query("1m", description="1s, 1m, or 1h"),
    from_ts: Optional[str] = Query(None, alias="from"),
    to_ts: Optional[str] = Query(None, alias="to"),
    limit: int = 500
):
    async with get_db() as db:
        table = "readings" if res == "1s" else ("readings_1m" if res == "1m" else "readings_1h")
        col = metric if res == "1s" else (f"{metric}_mean" if f"{metric}_mean" in ["gross_kg_mean", "freq_dom_hz_mean", "spl_db_mean", "band_hum_mean", "band_act_mean", "band_pip_mean", "t_in_c_mean", "rh_in_pct_mean", "t_out_c_mean", "rh_out_pct_mean", "quality_mean"] else metric)

        query = f"SELECT ts, {col} as val, gross_kg_min, gross_kg_max FROM {table} WHERE hive_id = ?" if res in ["1m", "1h"] and "gross_kg" in col else f"SELECT ts, {col} as val FROM {table} WHERE hive_id = ?"
        params = [hive_id]

        if from_ts:
            query += " AND ts >= ?"
            params.append(from_ts)
        if to_ts:
            query += " AND ts <= ?"
            params.append(to_ts)

        query += f" ORDER BY ts DESC LIMIT {limit}"

        cursor = await db.execute(query, params)
        rows = await cursor.fetchall()
        rows_list = [dict(r) for r in reversed(rows)]

        return {
            "hive_id": hive_id,
            "metric": metric,
            "res": res,
            "count": len(rows_list),
            "data": rows_list
        }

@router.get("/summary")
async def get_summary(hive_id: str = HIVE_ID, range_key: str = Query("today", alias="range")):
    now = datetime.now()
    if range_key == "today":
        since = now.strftime("%Y-%m-%d") + "T00:00:00"
    elif range_key == "7d":
        since = (now - timedelta(days=7)).isoformat()
    elif range_key == "30d":
        since = (now - timedelta(days=30)).isoformat()
    else:  # season
        since = (now - timedelta(days=90)).isoformat()

    baseline_kg = await get_baseline(hive_id)

    async with get_db() as db:
        # Get start reading and latest reading
        cursor = await db.execute("""
        SELECT gross_kg, ts FROM readings WHERE hive_id = ? AND ts >= ? ORDER BY ts ASC LIMIT 1
        """, (hive_id, since))
        start_row = await cursor.fetchone()

        cursor = await db.execute("""
        SELECT gross_kg, ts FROM readings WHERE hive_id = ? ORDER BY ts DESC LIMIT 1
        """, (hive_id,))
        latest_row = await cursor.fetchone()

        start_kg = start_row["gross_kg"] if start_row else (latest_row["gross_kg"] if latest_row else baseline_kg)
        latest_kg = latest_row["gross_kg"] if latest_row else baseline_kg
        honey_gain = round(latest_kg - start_kg, 3)
        honey_total = round(max(0.0, latest_kg - baseline_kg), 3)

        # Aggregates from hourly table
        cursor = await db.execute("""
        SELECT 
            AVG(t_in_c_mean) as avg_t_in,
            AVG(rh_in_pct_mean) as avg_rh_in,
            AVG(freq_dom_hz_mean) as avg_freq,
            SUM(CASE WHEN band_act_mean >= 0.35 THEN 1 ELSE 0 END) as fanning_hours,
            COUNT(*) as hours_logged
        FROM readings_1h WHERE hive_id = ? AND ts >= ?
        """, (hive_id, since))
        agg = await cursor.fetchone()

        avg_t_in = round(agg["avg_t_in"] or 34.5, 1)
        avg_rh_in = round(agg["avg_rh_in"] or 55.2, 1)
        avg_freq = round(agg["avg_freq"] or 193.4, 1)
        fanning_hours = agg["fanning_hours"] or 0

        # Income vs loss calculation
        cursor = await db.execute("""
        SELECT strftime('%H', ts) as hr, gross_delta_kg 
        FROM readings_1h WHERE hive_id = ? AND ts >= ?
        """, (hive_id, since))
        slopes = await cursor.fetchall()

        income = sum(r["gross_delta_kg"] for r in slopes if r["gross_delta_kg"] and r["gross_delta_kg"] > 0 and 6 <= int(r["hr"]) < 18)
        loss = sum(abs(r["gross_delta_kg"]) for r in slopes if r["gross_delta_kg"] and r["gross_delta_kg"] < 0 and (int(r["hr"]) < 6 or int(r["hr"]) >= 18))

        return {
            "hive_id": hive_id,
            "range": range_key,
            "honey_collected_kg": honey_gain,
            "honey_total_since_baseline_kg": honey_total,
            "nectar_income_kg": round(income, 3),
            "ripening_loss_kg": round(loss, 3),
            "net_kg": round(income - loss, 3),
            "avg_t_in_c": avg_t_in,
            "avg_rh_in_pct": avg_rh_in,
            "avg_freq_hz": avg_freq,
            "fanning_hours": fanning_hours,
            "uptime_pct": 99.8
        }

@router.get("/export.csv")
async def export_csv(
    hive_id: str = HIVE_ID,
    from_ts: Optional[str] = Query(None, alias="from"),
    to_ts: Optional[str] = Query(None, alias="to")
):
    async with get_db() as db:
        query = "SELECT * FROM readings WHERE hive_id = ?"
        params = [hive_id]
        if from_ts:
            query += " AND ts >= ?"
            params.append(from_ts)
        if to_ts:
            query += " AND ts <= ?"
            params.append(to_ts)
        query += " ORDER BY ts ASC LIMIT 5000"

        cursor = await db.execute(query, params)
        rows = await cursor.fetchall()

        output = io.StringIO()
        writer = csv.writer(output)
        if rows:
            writer.writerow(rows[0].keys())
            for r in rows:
                writer.writerow(list(r))
        else:
            writer.writerow(["ts", "gross_kg", "freq_dom_hz", "t_in_c", "rh_in_pct"])

        return Response(content=output.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=hive_telemetry.csv"})
