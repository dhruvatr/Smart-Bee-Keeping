import aiosqlite
import asyncio
from datetime import datetime
from typing import Optional, List, Dict, Any
from pathlib import Path
from app.config import DB_PATH, HIVE_ID, load_hive_config

from contextlib import asynccontextmanager

DB_LOCK = asyncio.Lock()

@asynccontextmanager
async def get_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = await aiosqlite.connect(str(DB_PATH))
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL;")
    await db.execute("PRAGMA synchronous=NORMAL;")
    try:
        yield db
    finally:
        await db.close()

async def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    async with get_db() as db:
        await db.execute("""
        CREATE TABLE IF NOT EXISTS hive_meta (
            hive_id TEXT PRIMARY KEY,
            name TEXT,
            location TEXT,
            installed_ts TEXT,
            baseline_kg REAL,
            baseline_set_ts TEXT,
            notes TEXT
        );
        """)

        await db.execute("""
        CREATE TABLE IF NOT EXISTS readings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hive_id TEXT NOT NULL,
            ts TEXT NOT NULL,
            gross_kg REAL,
            bee_scale_g REAL,
            freq_dom_hz REAL,
            spl_db REAL,
            freq_quality REAL,
            band_hum REAL,
            band_act REAL,
            band_pip REAL,
            band_rumble REAL,
            t_in_c REAL,
            rh_in_pct REAL,
            t_out_c REAL,
            rh_out_pct REAL,
            p_hpa REAL,
            rssi_dbm REAL,
            battery_pct REAL,
            quality REAL
        );
        """)
        await db.execute("CREATE INDEX IF NOT EXISTS idx_readings_hive_ts ON readings(hive_id, ts);")

        await db.execute("""
        CREATE TABLE IF NOT EXISTS readings_1m (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hive_id TEXT NOT NULL,
            ts TEXT NOT NULL,
            gross_kg_mean REAL,
            gross_kg_min REAL,
            gross_kg_max REAL,
            gross_kg_std REAL,
            gross_delta_kg REAL,
            freq_dom_hz_mean REAL,
            spl_db_mean REAL,
            band_hum_mean REAL,
            band_act_mean REAL,
            band_pip_mean REAL,
            t_in_c_mean REAL,
            rh_in_pct_mean REAL,
            t_out_c_mean REAL,
            rh_out_pct_mean REAL,
            quality_mean REAL,
            sample_count INTEGER
        );
        """)
        await db.execute("CREATE INDEX IF NOT EXISTS idx_readings_1m_hive_ts ON readings_1m(hive_id, ts);")

        await db.execute("""
        CREATE TABLE IF NOT EXISTS readings_1h (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hive_id TEXT NOT NULL,
            ts TEXT NOT NULL,
            gross_kg_mean REAL,
            gross_kg_min REAL,
            gross_kg_max REAL,
            gross_kg_std REAL,
            gross_delta_kg REAL,
            freq_dom_hz_mean REAL,
            spl_db_mean REAL,
            band_hum_mean REAL,
            band_act_mean REAL,
            band_pip_mean REAL,
            t_in_c_mean REAL,
            rh_in_pct_mean REAL,
            t_out_c_mean REAL,
            rh_out_pct_mean REAL,
            quality_mean REAL,
            sample_count INTEGER
        );
        """)
        await db.execute("CREATE INDEX IF NOT EXISTS idx_readings_1h_hive_ts ON readings_1h(hive_id, ts);")

        await db.execute("""
        CREATE TABLE IF NOT EXISTS honey_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hive_id TEXT NOT NULL,
            ts TEXT NOT NULL,
            state TEXT NOT NULL,
            moisture_est_pct REAL,
            confidence REAL,
            honey_mass_kg REAL,
            note TEXT
        );
        """)
        await db.execute("CREATE INDEX IF NOT EXISTS idx_honey_events_hive_ts ON honey_events(hive_id, ts);")

        await db.execute("""
        CREATE TABLE IF NOT EXISTS calibrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hive_id TEXT NOT NULL,
            ts TEXT NOT NULL,
            kind TEXT NOT NULL,
            before_json TEXT,
            after_json TEXT,
            operator TEXT
        );
        """)

        await db.execute("""
        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hive_id TEXT NOT NULL,
            ts TEXT NOT NULL,
            rule_id TEXT NOT NULL,
            severity TEXT NOT NULL,
            message TEXT NOT NULL,
            value REAL,
            acknowledged INTEGER DEFAULT 0
        );
        """)
        await db.execute("CREATE INDEX IF NOT EXISTS idx_alerts_hive_ts ON alerts(hive_id, ts);")

        await db.execute("""
        CREATE TABLE IF NOT EXISTS harvests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hive_id TEXT NOT NULL,
            ts TEXT NOT NULL,
            honey_kg REAL,
            frames INTEGER,
            moisture_pct_lab REAL,
            note TEXT,
            batch_hash TEXT,
            tx_hash TEXT
        );
        """)

        await db.execute("""
        CREATE TABLE IF NOT EXISTS inspections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hive_id TEXT NOT NULL,
            ts TEXT NOT NULL,
            note TEXT,
            photo_path TEXT
        );
        """)

        await db.execute("""
        CREATE TABLE IF NOT EXISTS blockchain_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hive_id TEXT NOT NULL,
            ts TEXT NOT NULL,
            batch_id TEXT UNIQUE NOT NULL,
            batch_name TEXT NOT NULL,
            honey_kg REAL NOT NULL,
            moisture_pct REAL NOT NULL,
            quality_grade TEXT NOT NULL,
            fssai_compliant INTEGER DEFAULT 1,
            apiary_location TEXT NOT NULL,
            botanical_source TEXT NOT NULL,
            payload_hash TEXT NOT NULL,
            tx_hash TEXT NOT NULL,
            block_number INTEGER NOT NULL,
            contract_address TEXT NOT NULL,
            qr_data TEXT NOT NULL,
            verified INTEGER DEFAULT 1
        );
        """)

        # Ensure default hive_meta exists
        cfg = load_hive_config()
        meta = cfg.get("hive_meta", {})
        h_id = meta.get("hive_id", HIVE_ID)
        cursor = await db.execute("SELECT hive_id FROM hive_meta WHERE hive_id = ?", (h_id,))
        existing = await cursor.fetchone()
        if not existing:
            await db.execute("""
            INSERT INTO hive_meta (hive_id, name, location, installed_ts, baseline_kg, baseline_set_ts, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                h_id,
                meta.get("name", "Apiary Alpha - Colony 1"),
                meta.get("location", "Bengaluru Rural, Karnataka, India"),
                meta.get("installed_ts", datetime.now().isoformat()),
                meta.get("baseline_kg", 38.5),
                meta.get("baseline_set_ts", datetime.now().isoformat()),
                meta.get("notes", "Langstroth 10-frame hive")
            ))
        await db.commit()

async def insert_reading(data: Dict[str, Any]):
    async with get_db() as db:
        await db.execute("""
        INSERT INTO readings (
            hive_id, ts, gross_kg, bee_scale_g, freq_dom_hz, spl_db, freq_quality,
            band_hum, band_act, band_pip, band_rumble, t_in_c, rh_in_pct,
            t_out_c, rh_out_pct, p_hpa, rssi_dbm, battery_pct, quality
        ) VALUES (
            :hive_id, :ts, :gross_kg, :bee_scale_g, :freq_dom_hz, :spl_db, :freq_quality,
            :band_hum, :band_act, :band_pip, :band_rumble, :t_in_c, :rh_in_pct,
            :t_out_c, :rh_out_pct, :p_hpa, :rssi_dbm, :battery_pct, :quality
        )
        """, data)
        await db.commit()

async def get_latest_reading(hive_id: str = HIVE_ID) -> Optional[Dict[str, Any]]:
    async with get_db() as db:
        cursor = await db.execute("""
        SELECT * FROM readings WHERE hive_id = ? ORDER BY ts DESC LIMIT 1
        """, (hive_id,))
        row = await cursor.fetchone()
        if row:
            return dict(row)
        return None

async def get_baseline(hive_id: str = HIVE_ID) -> float:
    async with get_db() as db:
        cursor = await db.execute("SELECT baseline_kg FROM hive_meta WHERE hive_id = ?", (hive_id,))
        row = await cursor.fetchone()
        if row and row["baseline_kg"] is not None:
            return float(row["baseline_kg"])
    return 38.5

async def set_baseline(hive_id: str, baseline_kg: float, ts: str, note: str = ""):
    async with get_db() as db:
        await db.execute("""
        UPDATE hive_meta SET baseline_kg = ?, baseline_set_ts = ? WHERE hive_id = ?
        """, (baseline_kg, ts, hive_id))
        await db.execute("""
        INSERT INTO honey_events (hive_id, ts, state, moisture_est_pct, confidence, honey_mass_kg, note)
        VALUES (?, ?, 'BASELINE_SET', 0, 1.0, 0.0, ?)
        """, (hive_id, ts, f"Baseline set to {baseline_kg:.3f} kg. {note}"))
        await db.commit()
