import math
import numpy as np
from datetime import datetime
from typing import List, Dict, Any, Tuple, Optional

def clamp(val: float, min_val: float = 0.0, max_val: float = 1.0) -> float:
    """Clamps a floating point number between min_val and max_val."""
    return max(min_val, min(max_val, val))

def calculate_dew_point(t_c: float, rh_pct: float) -> float:
    """
    Computes Dew Point in °C using the Magnus-Tetens formula.
    Reference: Alduchov & Eskridge (1996), a=17.27, b=237.7°C.
    Valid range: 0°C <= T <= 60°C, 1% <= RH <= 100%.
    """
    rh_clamped = max(0.1, min(100.0, rh_pct))
    a = 17.27
    b = 237.7
    gamma = (a * t_c) / (b + t_c) + math.log(rh_clamped / 100.0)
    denom = a - gamma
    if denom == 0:
        return t_c
    return (b * gamma) / denom

def calculate_absolute_humidity(t_c: float, rh_pct: float) -> float:
    """
    Computes Absolute Humidity (AH) in g/m³.
    Uses vapor pressure e (hPa) and ideal gas law:
    e = 6.112 * exp((17.67 * T) / (T + 243.5)) * (RH / 100)
    AH = 216.7 * (e / (T + 273.15))
    """
    rh_clamped = max(0.0, min(100.0, rh_pct))
    e_sat = 6.112 * math.exp((17.67 * t_c) / (t_c + 243.5))
    e = e_sat * (rh_clamped / 100.0)
    ah = 216.7 * (e / (t_c + 273.15))
    return max(0.0, ah)

def calculate_vpd(t_c: float, rh_pct: float) -> float:
    """
    Computes Vapor Pressure Deficit (VPD) in kPa.
    VPD = VP_sat * (1 - RH/100)
    VP_sat = 0.61078 * exp((17.27 * T) / (T + 237.3))
    Reference: Allen et al. (1998) FAO-56.
    """
    rh_clamped = max(0.0, min(100.0, rh_pct))
    vp_sat = 0.61078 * math.exp((17.27 * t_c) / (t_c + 237.3))
    vpd = vp_sat * (1.0 - (rh_clamped / 100.0))
    return max(0.0, vpd)

def classify_freq_band(freq_hz: float) -> Tuple[str, str]:
    """
    Classifies audio dominant frequency into ecological behavioral bands:
    < 100 Hz: Quiet / Sensor Noise
    100–150 Hz: Low Rumble / Disturbance
    150–250 Hz: Normal Hive Hum / Calm Colony
    250–400 Hz: Fanning & Active Work (Honey Ripening Signature)
    400–600 Hz: Worker Piping / Agitation / Swarm Alert
    > 600 Hz: High Noise / Acoustic Artifact
    """
    if freq_hz < 100.0:
        return "QUIET_NOISE", "Quiet / Sensor Noise (<100 Hz)"
    elif freq_hz < 150.0:
        return "LOW_RUMBLE", "Low Rumble / Disturbance (100–150 Hz)"
    elif freq_hz <= 250.0:
        return "NORMAL_HUM", "Normal Hive Hum / Calm Colony (150–250 Hz)"
    elif freq_hz <= 400.0:
        return "FANNING_ACTIVE", "Fanning & Active Work (250–400 Hz)"
    elif freq_hz <= 600.0:
        return "PIPING_AGITATION", "Worker Piping / Agitation (400–600 Hz)"
    else:
        return "HIGH_NOISE", "High Noise / Artifact (>600 Hz)"

def compute_activity_index(
    band_act: float,
    band_pip: float,
    spl_db: float,
    spl_p5: float = -60.0,
    spl_p95: float = -20.0
) -> float:
    """
    Computes colony Activity Index (0–100):
    Activity = 100 * clamp((band_act + band_pip + spl_db_norm) / 3)
    where spl_db_norm is min-max normalized against rolling p5–p95 of spl_db.
    """
    denom = max(1.0, spl_p95 - spl_p5)
    spl_norm = clamp((spl_db - spl_p5) / denom, 0.0, 1.0)
    raw_score = (band_act + band_pip + spl_norm) / 3.0
    return round(clamp(raw_score, 0.0, 1.0) * 100.0, 1)

def compute_quality_score(
    freq_quality: float,
    staleness_seconds: float,
    gross_kg: float,
    bme_t_diff: Optional[float] = None
) -> float:
    """
    Computes telemetry delivery / signal quality score (0.0 to 1.0).
    Combines spectral SNR, timestamp freshness, realistic load-cell range,
    and optional dual-sensor agreement.
    """
    # 1. Spectral quality (0..1)
    q_freq = clamp(freq_quality, 0.0, 1.0)

    # 2. Staleness: 1.0 if < 5s, drops to 0 at 300s
    if staleness_seconds <= 5.0:
        q_fresh = 1.0
    elif staleness_seconds >= 300.0:
        q_fresh = 0.0
    else:
        q_fresh = 1.0 - ((staleness_seconds - 5.0) / 295.0)

    # 3. Load cell realistic range check (10 to 120 kg)
    if 10.0 <= gross_kg <= 120.0:
        q_weight = 1.0
    elif 0.0 <= gross_kg <= 150.0:
        q_weight = 0.6
    else:
        q_weight = 0.1

    # 4. Sensor agreement check (if backup sensor exists)
    q_sensor = 1.0
    if bme_t_diff is not None:
        if abs(bme_t_diff) <= 1.0:
            q_sensor = 1.0
        elif abs(bme_t_diff) <= 3.0:
            q_sensor = 0.8
        else:
            q_sensor = 0.5

    total = 0.35 * q_freq + 0.35 * q_fresh + 0.20 * q_weight + 0.10 * q_sensor
    return round(clamp(total, 0.0, 1.0), 3)

def compute_income_loss_split(
    slopes: List[Dict[str, Any]],
    sunrise_hour: float = 6.0,
    sunset_hour: float = 18.5
) -> Dict[str, float]:
    """
    Classifies 15-minute weight slopes into:
    - nectar_income_kg: sum of positive slopes during daylight (foraging gain)
    - ripening_loss_kg: sum of negative slopes during night (water evaporated by fanning)
    - net_kg: nectar_income_kg - abs(ripening_loss_kg)
    """
    income = 0.0
    loss = 0.0

    for item in slopes:
        # item: {'hour': float (0..24), 'slope_kg': float}
        hour = item.get('hour', 12.0)
        slope = item.get('slope_kg', 0.0)
        is_daylight = (sunrise_hour <= hour < sunset_hour)

        if is_daylight:
            if slope > 0.0:
                income += slope
        else:
            if slope < 0.0:
                loss += abs(slope)

    net = income - loss
    return {
        "nectar_income_kg": round(income, 3),
        "ripening_loss_kg": round(loss, 3),
        "net_kg": round(net, 3)
    }

def estimate_bee_count(gross_kg: float, honey_mass_kg: float, hive_tare_kg: float = 28.0) -> int:
    """
    Biomass context estimate:
    bees_estimate = (W_gross - W_honey - hive_tare_kg) / 0.0001
    (average worker bee weight = 0.0001 kg = 100 mg).
    Clearly labelled an approximation.
    """
    biomass_kg = max(0.0, gross_kg - honey_mass_kg - hive_tare_kg)
    count = int(biomass_kg / 0.0001)
    return min(80000, max(5000, count))
