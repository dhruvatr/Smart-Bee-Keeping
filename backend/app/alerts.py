from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from app.config import load_hive_config

class AlertsEngine:
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.cfg = config or load_hive_config()
        self.thresholds = self.cfg.get("thresholds", {})

    def evaluate(
        self,
        current_reading: Dict[str, Any],
        honey_state: Dict[str, Any],
        historical_stats: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Evaluates telemetry and history against all 12 alert rules (§7).
        Returns a list of triggered alert dictionaries with detailed 'why' explanations.
        """
        alerts: List[Dict[str, Any]] = []
        now_ts = current_reading.get("ts", datetime.now().isoformat())
        hive_id = current_reading.get("hive_id", "HIVE-01")

        t_in = current_reading.get("t_in_c", 34.5)
        rh_in = current_reading.get("rh_in_pct", 55.0)
        gross_kg = current_reading.get("gross_kg", 40.0)
        freq_hz = current_reading.get("freq_dom_hz", 193.0)
        spl_db = current_reading.get("spl_db", -28.0)
        band_act = current_reading.get("band_act", 0.2)
        band_pip = current_reading.get("band_pip", 0.05)
        act_index = historical_stats.get("activity_index", 40.0)

        weight_drop_6h = historical_stats.get("weight_drop_6h_kg", 0.0)
        weight_drop_24h = historical_stats.get("weight_drop_24h_kg", 0.0)
        p95_spl = historical_stats.get("spl_db_p95", -24.0)
        median_night_loss = historical_stats.get("median_night_loss_kg", 0.15)
        current_night_loss = historical_stats.get("current_night_loss_kg", 0.10)
        last_seen_seconds = historical_stats.get("last_seen_seconds", 2.0)
        check_weight_dev = historical_stats.get("check_weight_dev_kg", 0.0)
        is_daylight = historical_stats.get("is_daylight", True)

        moisture_pct = honey_state.get("moisture_est_pct", 18.0)
        current_stage = honey_state.get("state", "RAW")

        # 1. SWARM_EVENT: weight drop >= 1.5 kg in 6 h + acoustic hum/act signature
        swarm_threshold = self.thresholds.get("swarm_weight_drop_kg", 1.5)
        if weight_drop_6h >= swarm_threshold and (band_act > 0.25 or band_pip > 0.15 or freq_hz > 210.0):
            alerts.append({
                "rule_id": "SWARM_EVENT",
                "severity": "critical",
                "hive_id": hive_id,
                "ts": now_ts,
                "value": weight_drop_6h,
                "message": f"Potential swarm exit detected: colony mass dropped {weight_drop_6h:.2f} kg in 6 h with active flight frequency.",
                "why": f"Observed 6-hr weight loss of {weight_drop_6h:.2f} kg (threshold >= {swarm_threshold} kg) accompanied by acoustic agitation (band_act={band_act:.2f}, pip={band_pip:.2f})."
            })

        # 2. ABSCONDING: weight drop >= 3.0 kg in 24 h + activity collapse
        absconding_threshold = self.thresholds.get("absconding_weight_drop_kg", 3.0)
        if weight_drop_24h >= absconding_threshold and (act_index < 18.0 or spl_db < -50.0):
            alerts.append({
                "rule_id": "ABSCONDING",
                "severity": "critical",
                "hive_id": hive_id,
                "ts": now_ts,
                "value": weight_drop_24h,
                "message": f"Critical absconding warning: colony vacated {weight_drop_24h:.2f} kg with near-zero hive activity.",
                "why": f"24-hr gross weight dropped by {weight_drop_24h:.2f} kg (threshold >= {absconding_threshold} kg) and colony activity index collapsed to {act_index:.1f}/100."
            })

        # 3. QUEENLESS_SUSPECT: dB > 7-day p95 and freq shifted up >= 20 Hz
        queenless_shift = self.thresholds.get("queenless_freq_shift_hz", 20.0)
        if (spl_db > p95_spl) and (freq_hz >= 190.0 + queenless_shift):
            alerts.append({
                "rule_id": "QUEENLESS_SUSPECT",
                "severity": "warning",
                "hive_id": hive_id,
                "ts": now_ts,
                "value": freq_hz,
                "message": f"Queenless / queen-piping signature: hive roar at {freq_hz:.1f} Hz ({spl_db:.1f} dB).",
                "why": f"Colony acoustic level ({spl_db:.1f} dB) exceeded 7-day 95th percentile ({p95_spl:.1f} dB) with dominant pitch shifted +{freq_hz - 190.0:.1f} Hz above calm baseline."
            })

        # 4. BROOD_OVERHEAT: t_in > 36.0 °C
        crit_temp = self.thresholds.get("brood_temp_crit_high_c", 36.0)
        if t_in > crit_temp:
            alerts.append({
                "rule_id": "BROOD_OVERHEAT",
                "severity": "critical",
                "hive_id": hive_id,
                "ts": now_ts,
                "value": t_in,
                "message": f"Brood nest overheat danger: in-hive temperature reached {t_in:.1f} °C.",
                "why": f"Brood chamber temperature is {t_in:.1f} °C, exceeding lethal threshold of {crit_temp} °C. High risk of comb melt and larval mortality."
            })

        # 5. BROOD_TOO_COLD: t_in < 32.0 °C
        cold_temp = self.thresholds.get("brood_temp_warn_low_c", 32.0)
        if t_in < cold_temp:
            alerts.append({
                "rule_id": "BROOD_TOO_COLD",
                "severity": "warning",
                "hive_id": hive_id,
                "ts": now_ts,
                "value": t_in,
                "message": f"Brood nest hypothermia warning: in-hive temperature fell to {t_in:.1f} °C.",
                "why": f"Internal temperature is {t_in:.1f} °C (lower than minimum regulated brood baseline of {cold_temp} °C)."
            })

        # 6. HUMIDITY_OUT: rh_in < 40% or > 70%
        rh_low = self.thresholds.get("brood_rh_warn_low_pct", 40.0)
        rh_high = self.thresholds.get("brood_rh_warn_high_pct", 70.0)
        if rh_in < rh_low or rh_in > rh_high:
            alerts.append({
                "rule_id": "HUMIDITY_OUT",
                "severity": "warning",
                "hive_id": hive_id,
                "ts": now_ts,
                "value": rh_in,
                "message": f"Brood humidity out of safe bounds: {rh_in:.1f} %RH.",
                "why": f"Internal RH is {rh_in:.1f}% (safe brood incubation band is {rh_low}% to {rh_high}%)."
            })

        # 7. HONEY_UNRIPE: moisture > 20%
        unripe_limit = self.thresholds.get("moisture_unripe_pct", 20.0)
        if moisture_pct > unripe_limit and current_stage in ("RAW", "RIPENING"):
            alerts.append({
                "rule_id": "HONEY_UNRIPE",
                "severity": "warning",
                "hive_id": hive_id,
                "ts": now_ts,
                "value": moisture_pct,
                "message": f"Honey fermentation risk: moisture estimate is {moisture_pct:.1f} % (> 20%).",
                "why": f"Current moisture estimate of {moisture_pct:.1f}% exceeds legal FSSAI stability limit of {unripe_limit}%. Do not harvest uncapped honey."
            })

        # 8. HONEY_READY: state == COMPLETED
        if current_stage == "COMPLETED":
            alerts.append({
                "rule_id": "HONEY_READY",
                "severity": "info",
                "hive_id": hive_id,
                "ts": now_ts,
                "value": moisture_pct,
                "message": f"Honey ripened & ready for harvest! Moisture stable at {moisture_pct:.1f} %.",
                "why": f"Moisture is <= 18.6% with weight stabilized and fanning subsided. Capped comb signature verified."
            })

        # 9. ROBBING_SUSPECT: daytime weight fall + sound spike + activity spike
        if is_daylight and (historical_stats.get("weight_slope_1h_kg", 0.0) < -0.4) and (spl_db > -25.0) and (band_act > 0.35):
            alerts.append({
                "rule_id": "ROBBING_SUSPECT",
                "severity": "warning",
                "hive_id": hive_id,
                "ts": now_ts,
                "value": spl_db,
                "message": "Suspected apiary robbing in progress: rapid daylight honey loss with frantic buzzing.",
                "why": f"Weight falling during daylight (-{abs(historical_stats.get('weight_slope_1h_kg', 0)):.2f} kg/h) combined with acoustic battle spike ({spl_db:.1f} dB)."
            })

        # 10. NODE_OFFLINE: last seen > 300s
        offline_timeout = self.thresholds.get("node_offline_timeout_seconds", 300)
        if last_seen_seconds > offline_timeout:
            alerts.append({
                "rule_id": "NODE_OFFLINE",
                "severity": "critical",
                "hive_id": hive_id,
                "ts": now_ts,
                "value": last_seen_seconds,
                "message": f"Telemetry node offline: no sensor packets for {int(last_seen_seconds)} seconds.",
                "why": f"Heartbeat missed. Time since last payload ({last_seen_seconds:.0f} s) exceeds timeout limit of {offline_timeout} s."
            })

        # 11. LOADCELL_DRIFT: check-weight deviation > 0.1 kg
        drift_tol = self.thresholds.get("loadcell_drift_tolerance_kg", 0.1)
        if abs(check_weight_dev) > drift_tol:
            alerts.append({
                "rule_id": "LOADCELL_DRIFT",
                "severity": "warning",
                "hive_id": hive_id,
                "ts": now_ts,
                "value": check_weight_dev,
                "message": f"Load-cell calibration drift detected: {check_weight_dev:+.3f} kg.",
                "why": f"Known reference check weight drifted by {abs(check_weight_dev):.3f} kg (tolerance +/-{drift_tol} kg)."
            })

        # 12. NIGHT_LOSS_SPIKE: night loss > 3x median
        spike_factor = self.thresholds.get("night_loss_spike_factor", 3.0)
        if (not is_daylight) and (median_night_loss > 0.02) and (current_night_loss > median_night_loss * spike_factor):
            alerts.append({
                "rule_id": "NIGHT_LOSS_SPIKE",
                "severity": "info",
                "hive_id": hive_id,
                "ts": now_ts,
                "value": current_night_loss,
                "message": f"Intense night dewatering: moisture loss {current_night_loss:.2f} kg ({spike_factor:.1f}x median).",
                "why": f"Nighttime weight evaporation rate of {current_night_loss:.2f} kg is {current_night_loss / median_night_loss:.1f}x higher than 7-day median ({median_night_loss:.2f} kg)."
            })

        return alerts
