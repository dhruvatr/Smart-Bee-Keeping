import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.config import HIVE_ID, SIM_MODE, SIM_SPEED, DB_PATH
from app.db import init_db, get_db, insert_reading, get_latest_reading, get_baseline
from app.simulator import HiveSimulator
from app.ws import ws_manager
from app.alerts import AlertsEngine
from app.honey_model import HoneyFormationModel
from app.metrics import (
    calculate_dew_point,
    calculate_absolute_humidity,
    calculate_vpd,
    classify_freq_band,
    compute_activity_index,
    compute_quality_score,
    estimate_bee_count
)
from app.routers import telemetry, spectrum, events, sim, blockchain, settings
from app.ingest_mqtt import MQTTIngestBridge

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("main")

simulator = HiveSimulator(hive_id=HIVE_ID)
sim.set_global_simulator(simulator)
alerts_engine = AlertsEngine()
honey_model = HoneyFormationModel()
mqtt_bridge = MQTTIngestBridge()

async def process_telemetry_packet(payload: dict):
    """Processes a telemetry payload (§4.1) from either simulator or MQTT."""
    try:
        hive_id = payload.get("hive_id", HIVE_ID)
        ts = payload.get("ts", datetime.now().isoformat())
        w = payload.get("weight", {})
        a = payload.get("audio", {})
        e = payload.get("env", {})
        h = payload.get("health", {})
        bands = a.get("bands", {})

        gross_kg = w.get("gross_kg", 40.0)
        freq_dom = a.get("freq_dom_hz", 193.0)
        spl_db = a.get("spl_db", -28.0)
        freq_q = a.get("freq_quality", 0.9)
        band_hum = bands.get("hum150_250", 0.6)
        band_act = bands.get("act250_400", 0.2)
        band_pip = bands.get("pip400_600", 0.05)
        band_rumble = bands.get("r20_100", 0.08)

        t_in = e.get("t_in_c", 34.5)
        rh_in = e.get("rh_in_pct", 55.0)
        t_out = e.get("t_out_c", 26.0)
        rh_out = e.get("rh_out_pct", 65.0)
        p_hpa = e.get("p_hpa", 912.0)
        battery = e.get("battery_pct", 90.0)
        rssi = h.get("rssi_dbm", -60.0)

        quality = compute_quality_score(freq_q, staleness_seconds=1.0, gross_kg=gross_kg)

        # Insert reading
        reading_dict = {
            "hive_id": hive_id,
            "ts": ts,
            "gross_kg": gross_kg,
            "bee_scale_g": w.get("bee_scale_g"),
            "freq_dom_hz": freq_dom,
            "spl_db": spl_db,
            "freq_quality": freq_q,
            "band_hum": band_hum,
            "band_act": band_act,
            "band_pip": band_pip,
            "band_rumble": band_rumble,
            "t_in_c": t_in,
            "rh_in_pct": rh_in,
            "t_out_c": t_out,
            "rh_out_pct": rh_out,
            "p_hpa": p_hpa,
            "rssi_dbm": rssi,
            "battery_pct": battery,
            "quality": quality
        }
        await insert_reading(reading_dict)

        # Derived calculations
        baseline_kg = await get_baseline(hive_id)
        honey_kg = max(0.0, gross_kg - baseline_kg)
        is_neg_drift = gross_kg < baseline_kg

        dp_in = calculate_dew_point(t_in, rh_in)
        dp_out = calculate_dew_point(t_out, rh_out)
        ah_in = calculate_absolute_humidity(t_in, rh_in)
        vpd_in = calculate_vpd(t_in, rh_in)
        band_key, band_desc = classify_freq_band(freq_dom)
        act_index = compute_activity_index(band_act, band_pip, spl_db)
        bees_count = estimate_bee_count(gross_kg, honey_kg)

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

        honey_state = {
            "state": stage,
            "state_desc": stage_desc,
            "confidence": confidence,
            "is_estimated": confidence < 0.60,
            "moisture_est_pct": moisture_fused,
            "moisture_band": moist_band,
            "moisture_band_desc": moist_band_desc
        }

        # Check alerts
        historical_stats = {
            "activity_index": act_index,
            "weight_drop_6h_kg": 0.0,
            "weight_drop_24h_kg": 0.0,
            "spl_db_p95": -22.0,
            "median_night_loss_kg": 0.12,
            "current_night_loss_kg": 0.08,
            "last_seen_seconds": 1.0,
            "check_weight_dev_kg": 0.0,
            "is_daylight": True,
            "weight_slope_1h_kg": 0.02
        }
        fired_alerts = alerts_engine.evaluate(reading_dict, honey_state, historical_stats)

        # Broadcast over WebSocket
        ws_msg = {
            "type": "telemetry",
            "hive_id": hive_id,
            "ts": ts,
            "reading": reading_dict,
            "derived": {
                "honey_mass_kg": round(honey_kg, 3),
                "is_negative_drift": is_neg_drift,
                "baseline_kg": baseline_kg,
                "dew_point_in_c": round(dp_in, 1),
                "dew_point_out_c": round(dp_out, 1),
                "absolute_humidity_in_gm3": round(ah_in, 1),
                "vpd_in_kpa": round(vpd_in, 2),
                "freq_band_key": band_key,
                "freq_band_desc": band_desc,
                "activity_index": act_index,
                "bees_estimate": bees_count,
                "quality_score": quality
            },
            "honey_state": honey_state,
            "alerts": fired_alerts
        }
        await ws_manager.broadcast(ws_msg)

    except Exception as e:
        logger.error(f"Error processing telemetry packet: {e}")

async def run_simulator_loop():
    """Background task generating periodic 2-second simulation packets."""
    logger.info("Simulator loop started (interval: 2s)")
    while True:
        try:
            if simulator.is_running:
                payload = simulator.step(dt_seconds=2.0)
                spectrum.update_spectrum(simulator.spectrum_history[-1] if simulator.spectrum_history else [])
                await process_telemetry_packet(payload)
        except Exception as e:
            logger.error(f"Error in simulator loop: {e}")
        await asyncio.sleep(2.0)

async def run_rollup_task():
    """Periodic rollup task computing 1-minute and 1-hour rollups."""
    while True:
        try:
            await asyncio.sleep(60.0)
            async with get_db() as db:
                # Compute 1-minute rollup for last 2 minutes
                now_minus_2m = (datetime.now() - asyncio.get_event_loop().time()).isoformat() if False else datetime.now().isoformat()
                # Aggregate hot readings
                await db.execute("""
                INSERT INTO readings_1m (
                    hive_id, ts, gross_kg_mean, gross_kg_min, gross_kg_max, gross_kg_std, gross_delta_kg,
                    freq_dom_hz_mean, spl_db_mean, band_hum_mean, band_act_mean, band_pip_mean,
                    t_in_c_mean, rh_in_pct_mean, t_out_c_mean, rh_out_pct_mean, quality_mean, sample_count
                )
                SELECT 
                    hive_id, datetime('now') as ts,
                    AVG(gross_kg), MIN(gross_kg), MAX(gross_kg), 0.01,
                    (MAX(gross_kg) - MIN(gross_kg)),
                    AVG(freq_dom_hz), AVG(spl_db), AVG(band_hum), AVG(band_act), AVG(band_pip),
                    AVG(t_in_c), AVG(rh_in_pct), AVG(t_out_c), AVG(rh_out_pct), AVG(quality), COUNT(*)
                FROM readings
                WHERE ts >= datetime('now', '-2 minutes')
                GROUP BY hive_id
                """)
                await db.commit()
        except Exception as e:
            logger.warning(f"Rollup worker tick notice: {e}")
            await asyncio.sleep(60.0)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing Smart Hive backend...")
    await init_db()

    # Seed 30-day realistic historical data if database is new
    async with get_db() as db:
        await simulator.seed_30_days_history(db)

    # Start MQTT bridge
    loop = asyncio.get_running_loop()
    mqtt_bridge.on_telemetry = process_telemetry_packet
    mqtt_bridge.start(loop)

    # Start background simulator loop
    sim_task = asyncio.create_task(run_simulator_loop())
    rollup_task = asyncio.create_task(run_rollup_task())

    logger.info("Smart Hive backend successfully initialized!")
    yield

    sim_task.cancel()
    rollup_task.cancel()
    mqtt_bridge.stop()
    logger.info("Smart Hive backend stopped.")

app = FastAPI(
    title="Smart Hive Honey Monitoring API",
    description="IoT telemetry backend with acoustic FFT, dual load-cell honey mass computation, and HoneyChain traceability.",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

app.include_router(telemetry.router)
app.include_router(spectrum.router)
app.include_router(events.router)
app.include_router(sim.router)
app.include_router(blockchain.router)
app.include_router(settings.router)

@app.get("/api/health")
async def health():
    return {
        "status": "healthy",
        "hive_id": HIVE_ID,
        "sim_mode": SIM_MODE,
        "sim_running": simulator.is_running,
        "sim_speed": simulator.speed,
        "mqtt_connected": mqtt_bridge.is_connected,
        "timestamp": datetime.now().isoformat()
    }

@app.websocket("/ws/live")
async def websocket_live_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        # Immediately send current state upon connect
        latest = await get_latest_reading(HIVE_ID)
        if latest:
            await websocket.send_json({
                "type": "welcome",
                "hive_id": HIVE_ID,
                "latest": latest
            })
        while True:
            # Keep socket open and listen for client commands
            data = await websocket.receive_text()
            logger.debug(f"Received from client: {data}")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.warning(f"WebSocket connection error: {e}")
        ws_manager.disconnect(websocket)
