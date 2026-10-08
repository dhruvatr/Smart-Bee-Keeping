import math
import random
import numpy as np
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional
from app.metrics import (
    calculate_dew_point,
    calculate_absolute_humidity,
    calculate_vpd,
    classify_freq_band,
    compute_activity_index,
    compute_quality_score
)
from app.honey_model import HoneyFormationModel

class HiveSimulator:
    def __init__(self, hive_id: str = "HIVE-01"):
        self.hive_id = hive_id
        self.scenario = "normal"
        self.speed = 60.0  # 1s real = 60s sim
        self.is_running = True
        self.honey_model = HoneyFormationModel()
        
        # State tracking
        self.sim_time = datetime.now()
        self.gross_kg = 41.250
        self.baseline_kg = 38.500
        self.tare_counts = 812000
        self.counts_per_kg = 21450.0
        self.moisture_pct = 18.2
        self.seq = 1000
        self.spectrum_history: List[List[float]] = []

    def set_scenario(self, scenario: str):
        valid = ["normal", "nectar_flow", "heavy_fanning", "swarm", "queenless", "sensor_fault", "rain"]
        if scenario in valid:
            self.scenario = scenario
            return True
        return False

    def generate_spectrum_frame(self, dom_freq_hz: float, spl_db: float, num_bins: int = 512) -> List[float]:
        """
        Generates realistic 512-bin acoustic FFT magnitude spectrum (0 to 1000 Hz, ~1.95 Hz/bin).
        Simulates Hann-windowed peak at dom_freq_hz with natural harmonics (2x, 3x) and noise floor.
        """
        bins = np.zeros(num_bins)
        freq_resolution = 1000.0 / num_bins  # ~1.95 Hz per bin
        noise_floor = max(0.01, 10.0 ** (spl_db / 40.0) * 0.15)

        # Baseline ambient noise
        for i in range(num_bins):
            f = i * freq_resolution
            # 1/f flicker noise + random jitter
            bins[i] = (noise_floor / (1.0 + f * 0.005)) * (0.8 + 0.4 * random.random())

        # Peak at dominant frequency
        peak_bin = int(dom_freq_hz / freq_resolution)
        peak_amp = max(0.2, 10.0 ** (spl_db / 25.0) * 2.5)

        for offset in range(-6, 7):
            idx = peak_bin + offset
            if 0 <= idx < num_bins:
                # Gaussian bell around center
                weight = math.exp(-0.5 * (offset / 2.0) ** 2)
                bins[idx] += peak_amp * weight

        # Harmonic at 2x dominant frequency (subtle)
        harm_bin = int((dom_freq_hz * 2.0) / freq_resolution)
        for offset in range(-4, 5):
            idx = harm_bin + offset
            if 0 <= idx < num_bins:
                bins[idx] += (peak_amp * 0.35) * math.exp(-0.5 * (offset / 1.8) ** 2)

        # Harmonic at 3x dominant frequency
        harm3_bin = int((dom_freq_hz * 3.0) / freq_resolution)
        for offset in range(-3, 4):
            idx = harm3_bin + offset
            if 0 <= idx < num_bins:
                bins[idx] += (peak_amp * 0.15) * math.exp(-0.5 * (offset / 1.5) ** 2)

        # Normalize to 0.0 - 1.0 magnitude range
        norm_bins = [round(float(min(1.0, max(0.0, b))), 4) for b in bins]
        
        # Maintain history buffer for waterfall (max 60 frames)
        self.spectrum_history.append(norm_bins)
        if len(self.spectrum_history) > 60:
            self.spectrum_history.pop(0)

        return norm_bins

    def step(self, dt_seconds: float = 2.0, override_ts: Optional[datetime] = None) -> Dict[str, Any]:
        """
        Advances the simulation by dt_seconds (scaled by self.speed).
        Generates an exact §4.1 telemetry payload.
        """
        if override_ts:
            dt_now = override_ts
        else:
            self.sim_time += timedelta(seconds=dt_seconds * self.speed)
            dt_now = self.sim_time

        self.seq += 1
        hour = dt_now.hour + dt_now.minute / 60.0 + dt_now.second / 3600.0
        is_daylight = (6.0 <= hour < 18.5)

        # 1. Temperature & Humidity Physics (Bengaluru Diurnal Cycle)
        # Solar peak at 14:00, coolest at 05:00
        solar_rad = math.sin((hour - 8.0) * math.pi / 12.0) if (6.0 <= hour <= 20.0) else -0.5
        solar_rad = max(-0.8, min(1.0, solar_rad))

        if self.scenario == "rain":
            t_out = 22.0 + 1.5 * solar_rad + random.gauss(0, 0.2)
            rh_out = 92.0 + random.gauss(0, 1.5)
            p_hpa = 908.0 + random.gauss(0, 0.5)
        else:
            # Bengaluru typical: 19°C min night to 31°C max day
            t_out = 25.0 + 6.5 * solar_rad + random.gauss(0, 0.3)
            rh_out = 68.0 - 25.0 * solar_rad + random.gauss(0, 1.0)
            p_hpa = 914.0 - 3.0 * solar_rad + random.gauss(0, 0.4)

        # Internal Hive thermoregulation: bees tightly regulate 34.0–35.0 °C
        # Small thermal lag drift
        t_in = 34.5 + 0.55 * math.sin((hour - 11.0) * math.pi / 12.0) + random.gauss(0, 0.12)
        # Internal humidity: 52% - 58%
        rh_in = 55.0 + 3.0 * math.cos((hour - 7.0) * math.pi / 12.0) + random.gauss(0, 0.3)

        # 2. Audio & Frequency Acoustics
        base_freq = 193.0
        spl_db = -28.0
        band_act = 0.20
        band_pip = 0.05
        band_hum = 0.65
        band_rumble = 0.08
        freq_quality = 0.88 + random.uniform(-0.05, 0.05)

        # VPD affects fanning
        vpd_in = calculate_vpd(t_in, rh_in)
        if vpd_in > 1.2:
            band_act += 0.12
            band_hum -= 0.10

        if self.scenario == "normal":
            if is_daylight:
                band_act += 0.08
                base_freq += random.gauss(0, 2.0)
                spl_db += random.gauss(1.5, 0.5)
            else:
                # Night hum settles
                base_freq = 190.0 + random.gauss(0, 1.0)
                spl_db = -31.0 + random.gauss(0, 0.4)
                band_act = 0.12

        elif self.scenario == "nectar_flow":
            # Foragers active, fanning high in evening
            if 15.0 <= hour <= 23.0:
                band_act = 0.45
                base_freq = 275.0
                spl_db = -23.0
            else:
                band_act = 0.28
                base_freq = 210.0

        elif self.scenario == "heavy_fanning":
            band_act = 0.55
            band_hum = 0.35
            base_freq = 285.0
            spl_db = -21.5

        elif self.scenario == "swarm":
            # Swarm signature: piping burst 450–520 Hz, loud sound, sudden mass drop
            band_act = 0.65
            band_pip = 0.30
            band_hum = 0.15
            base_freq = 465.0 + random.gauss(0, 10.0)
            spl_db = -16.0
            self.gross_kg -= 0.02 * (dt_seconds * self.speed / 60.0)

        elif self.scenario == "queenless":
            # Queenless roar: persistent +25 Hz shift and higher dB
            base_freq = 222.0 + random.gauss(0, 3.0)
            spl_db = -18.5 + random.gauss(0, 0.6)
            band_pip = 0.18

        elif self.scenario == "sensor_fault":
            base_freq = 0.0
            spl_db = -90.0
            freq_quality = 0.0
            band_hum = band_act = band_pip = band_rumble = 0.0

        # 3. Weight Stream Physics
        rate_scale = (dt_seconds * self.speed) / 3600.0  # Fraction of simulated hour

        if self.scenario == "normal":
            if is_daylight and 9.0 <= hour <= 16.5:
                # Daylight nectar foraging gain (~0.08 kg/hr)
                hourly_gain = 0.08 + 0.04 * math.sin((hour - 9.0) * math.pi / 7.5)
                self.gross_kg += hourly_gain * rate_scale
            elif not is_daylight:
                # Night evaporation / fanning dewatering (-0.025 kg/hr)
                self.gross_kg -= 0.025 * rate_scale

        elif self.scenario == "nectar_flow":
            if is_daylight and 8.5 <= hour <= 17.0:
                hourly_gain = 0.22 + 0.08 * math.sin((hour - 8.5) * math.pi / 8.5)
                self.gross_kg += hourly_gain * rate_scale
            else:
                self.gross_kg -= 0.045 * rate_scale

        # Tiny load cell measurement noise (+-5g)
        measured_gross = round(self.gross_kg + random.gauss(0, 0.005), 3)
        raw_counts = int(self.tare_counts + (measured_gross * self.counts_per_kg))

        # Bee scale channel (optional individual forager scale, 90–120 mg = 0.09–0.12 g)
        bee_scale_g = round(random.choice([0.104, 0.098, 0.115, 0.108, None, None]), 3)

        # 4. Honey Dewatering & State Model
        honey_mass = max(0.0, measured_gross - self.baseline_kg)
        m_a = self.honey_model.estimate_moisture_mass_balance(honey_mass, honey_mass + 0.8, m0_pct=72.0)
        m_b = self.honey_model.estimate_moisture_equilibrium_rh(rh_in, t_in)
        m_fused, conf = self.honey_model.fuse_moisture_estimates(m_a, m_b, quality=0.88, baseline_age_hours=24.0)
        self.moisture_pct = m_fused

        # Generate spectrum frame for this tick
        spectrum = self.generate_spectrum_frame(base_freq, spl_db, num_bins=512)

        # Health
        battery_pct = max(10, 95 - int((self.seq % 5000) / 100))
        rssi = -62 + random.randint(-4, 3)

        payload = {
            "v": 1,
            "hive_id": self.hive_id,
            "ts": dt_now.isoformat(),
            "seq": self.seq,
            "weight": {
                "gross_kg": measured_gross,
                "raw_counts": raw_counts,
                "bee_scale_g": bee_scale_g
            },
            "audio": {
                "freq_dom_hz": round(base_freq, 1),
                "spl_db": round(spl_db, 1),
                "freq_quality": round(freq_quality, 2),
                "bands": {
                    "r20_100": round(band_rumble, 2),
                    "hum150_250": round(band_hum, 2),
                    "act250_400": round(band_act, 2),
                    "pip400_600": round(band_pip, 2)
                }
            },
            "env": {
                "t_in_c": round(t_in, 1),
                "rh_in_pct": round(rh_in, 1),
                "t_out_c": round(t_out, 1),
                "rh_out_pct": round(rh_out, 1),
                "p_hpa": round(p_hpa, 1),
                "battery_pct": battery_pct
            },
            "health": {
                "rssi_dbm": rssi,
                "uptime_s": self.seq * 2,
                "flags": []
            }
        }
        return payload

    async def seed_30_days_history(self, db):
        """
        Generates 30 days of realistic history into SQLite:
        - Hourly rollups (readings_1h) for 30 days (720 records)
        - 1-minute rollups (readings_1m) for last 48 hours (2880 records)
        - High-resolution readings for last 2 hours (3600 records)
        - Honey events for state transitions (NECTAR_INTAKE -> RIPENING -> RAW -> COMPLETED)
        """
        cursor = await db.execute("SELECT COUNT(*) as c FROM readings")
        count = (await cursor.fetchone())["c"]
        if count > 100:
            return  # Already seeded

        now = datetime.now()
        start_time = now - timedelta(days=30)
        curr_time = start_time

        # Start from post-inspection baseline 38.5 kg
        sim_gross = 38.500
        baseline_kg = 38.500

        readings_to_insert = []
        hourly_to_insert = []
        events_to_insert = []

        # Add initial baseline event
        events_to_insert.append((
            self.hive_id,
            start_time.isoformat(),
            "BASELINE_SET",
            24.5,
            1.0,
            0.0,
            "Initial colony inspection and baseline zeroing."
        ))

        # Hourly generation loop for 30 days
        day_counter = 0
        state = "NECTAR_INTAKE"

        for h in range(30 * 24):
            t_point = start_time + timedelta(hours=h)
            hour_float = t_point.hour + t_point.minute / 60.0
            is_daylight = (6.0 <= hour_float < 18.5)

            # Daily cycle
            if t_point.hour == 0:
                day_counter += 1

            # Nectar flow progression: first 10 days intake, then ripening, then raw, then completed
            if day_counter < 8:
                state = "NECTAR_INTAKE"
                gain_mult = 1.2
            elif day_counter < 18:
                state = "RIPENING"
                gain_mult = 0.9
            elif day_counter < 24:
                state = "RAW"
                gain_mult = 0.4
            else:
                state = "COMPLETED"
                gain_mult = 0.1

            # Weight change
            if is_daylight and 9.0 <= hour_float <= 16.5:
                gain = (0.09 * gain_mult) + random.uniform(-0.01, 0.02)
                sim_gross += max(0.0, gain)
            elif not is_daylight:
                loss = 0.025 + random.uniform(0.005, 0.015)
                sim_gross -= loss

            # Diurnal temps
            solar_rad = math.sin((hour_float - 8.0) * math.pi / 12.0) if (6.0 <= hour_float <= 20.0) else -0.5
            t_out = 25.0 + 6.5 * solar_rad + random.gauss(0, 0.2)
            rh_out = 68.0 - 25.0 * solar_rad + random.gauss(0, 0.8)
            t_in = 34.5 + 0.5 * math.sin((hour_float - 11.0) * math.pi / 12.0) + random.gauss(0, 0.1)
            rh_in = 55.0 + 3.0 * math.cos((hour_float - 7.0) * math.pi / 12.0) + random.gauss(0, 0.2)
            p_hpa = 914.0 + random.gauss(0, 0.3)

            # Audio
            base_freq = 193.0 + random.gauss(0, 2.0)
            if state == "RIPENING" and (not is_daylight or hour_float >= 17.0):
                base_freq = 275.0  # Fanning hum
                band_act = 0.45
            else:
                band_act = 0.20 if is_daylight else 0.12

            band_pip = 0.04
            band_hum = 0.65
            band_rumble = 0.08
            spl_db = -27.0 + random.gauss(0, 0.8)

            # Dewatering moisture curve
            # Starts at 26% and asymptotes to ~17.8% on day 26+
            progress_ratio = min(1.0, day_counter / 28.0)
            moist_curve = 25.5 - (8.0 * math.pow(progress_ratio, 0.7)) + random.gauss(0, 0.1)

            # Save hourly record
            hourly_to_insert.append((
                self.hive_id,
                t_point.isoformat(),
                round(sim_gross, 3),
                round(sim_gross - 0.05, 3),
                round(sim_gross + 0.05, 3),
                0.02,
                0.01,
                round(base_freq, 1),
                round(spl_db, 1),
                round(band_hum, 2),
                round(band_act, 2),
                round(band_pip, 2),
                round(t_in, 1),
                round(rh_in, 1),
                round(t_out, 1),
                round(rh_out, 1),
                0.92,
                60
            ))

            # Record honey state change events
            if t_point.hour == 12 and (day_counter in [1, 9, 19, 25]):
                st_names = {1: "NECTAR_INTAKE", 9: "RIPENING", 19: "RAW", 25: "COMPLETED"}
                st = st_names.get(day_counter, "RIPENING")
                events_to_insert.append((
                    self.hive_id,
                    t_point.isoformat(),
                    st,
                    round(moist_curve, 1),
                    0.88,
                    round(max(0.0, sim_gross - baseline_kg), 3),
                    f"Colony transitioned to {st} based on weight and moisture curves."
                ))

            # In the last 48 hours, insert into readings table
            if h >= (30 * 24 - 48):
                readings_to_insert.append({
                    "hive_id": self.hive_id,
                    "ts": t_point.isoformat(),
                    "gross_kg": round(sim_gross, 3),
                    "bee_scale_g": round(0.102 + random.uniform(-0.01, 0.01), 3) if h % 3 == 0 else None,
                    "freq_dom_hz": round(base_freq, 1),
                    "spl_db": round(spl_db, 1),
                    "freq_quality": 0.88,
                    "band_hum": round(band_hum, 2),
                    "band_act": round(band_act, 2),
                    "band_pip": round(band_pip, 2),
                    "band_rumble": round(band_rumble, 2),
                    "t_in_c": round(t_in, 1),
                    "rh_in_pct": round(rh_in, 1),
                    "t_out_c": round(t_out, 1),
                    "rh_out_pct": round(rh_out, 1),
                    "p_hpa": round(p_hpa, 1),
                    "rssi_dbm": -60.0,
                    "battery_pct": 88.0,
                    "quality": 0.92
                })

        # Insert hourly
        await db.executemany("""
        INSERT INTO readings_1h (
            hive_id, ts, gross_kg_mean, gross_kg_min, gross_kg_max, gross_kg_std, gross_delta_kg,
            freq_dom_hz_mean, spl_db_mean, band_hum_mean, band_act_mean, band_pip_mean,
            t_in_c_mean, rh_in_pct_mean, t_out_c_mean, rh_out_pct_mean, quality_mean, sample_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, hourly_to_insert)

        # Insert honey events
        await db.executemany("""
        INSERT INTO honey_events (hive_id, ts, state, moisture_est_pct, confidence, honey_mass_kg, note)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, events_to_insert)

        # Insert recent readings
        for r in readings_to_insert:
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
            """, r)

        # Seed initial harvest record and blockchain verification entry from SIH PPT
        await db.execute("""
        INSERT INTO harvests (hive_id, ts, honey_kg, frames, moisture_pct_lab, note, batch_hash, tx_hash)
        VALUES (?, ?, 12.4, 8, 17.8, 'Autumn floral capped honey extraction', '0x7e8b91c4d2841097fa6201bce47239ef182a901f4c3b2819', '0x3a9284cf7802b8d910248f294028bc18290f84a189')
        """, (self.hive_id, (now - timedelta(days=2)).isoformat()))

        # Seed blockchain record for SIH HoneyChain
        await db.execute("""
        INSERT INTO blockchain_records (
            hive_id, ts, batch_id, batch_name, honey_kg, moisture_pct, quality_grade,
            fssai_compliant, apiary_location, botanical_source, payload_hash,
            tx_hash, block_number, contract_address, qr_data, verified
        ) VALUES (
            ?, ?, 'BATCH-2026-09A', 'Autumn Pure Multifloral', 12.4, 17.8, 'Grade A+ Certified Organic',
            1, 'Bengaluru Rural, Karnataka, India', 'Wild Acacia & Eucalyptus Blossom',
            '0x8f192bce9048a17dbca20941829048efbc9102948a',
            '0x3a9284cf7802b8d910248f294028bc18290f84a189',
            1429810, '0x98bA417C04E4fD8F19B86470C88850C77F47FcaB',
            'https://honeychain.org/verify/BATCH-2026-09A', 1
        )
        """, (self.hive_id, (now - timedelta(days=2)).isoformat()))

        # Seed initial calibration
        await db.execute("""
        INSERT INTO calibrations (hive_id, ts, kind, before_json, after_json, operator)
        VALUES (?, ?, 'tare', '{"counts": 811950}', '{"counts_tare": 812000}', 'chief_apiarist')
        """, (self.hive_id, (now - timedelta(days=15)).isoformat()))

        await db.commit()
