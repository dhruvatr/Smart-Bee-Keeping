import pytest
import math
from app.metrics import (
    calculate_dew_point,
    calculate_absolute_humidity,
    calculate_vpd,
    classify_freq_band,
    compute_activity_index,
    compute_quality_score,
    compute_income_loss_split,
    estimate_bee_count
)

def test_dew_point_magnus():
    # At 25°C and 50% RH, dew point is approximately 13.9°C
    dp = calculate_dew_point(25.0, 50.0)
    assert 13.5 <= dp <= 14.5

    # At 35°C and 100% RH, dew point equals temperature
    dp_sat = calculate_dew_point(35.0, 100.0)
    assert pytest.approx(dp_sat, abs=0.2) == 35.0

    # At 34.2°C and 55.1% RH (spec example)
    dp_spec = calculate_dew_point(34.2, 55.1)
    assert 23.5 <= dp_spec <= 25.0

def test_absolute_humidity():
    # At 20°C and 100% RH, AH is ~ 17.3 g/m³
    ah = calculate_absolute_humidity(20.0, 100.0)
    assert 16.5 <= ah <= 18.0

    # Zero RH gives zero AH
    assert calculate_absolute_humidity(25.0, 0.0) == 0.0

def test_vpd():
    # At 30°C and 60% RH:
    # VP_sat = 0.61078 * exp((17.27*30)/(267.3)) ≈ 4.24 kPa
    # VPD = 4.24 * (1 - 0.6) ≈ 1.70 kPa
    vpd = calculate_vpd(30.0, 60.0)
    assert 1.6 <= vpd <= 1.8

    # At 100% RH, VPD is 0.0
    assert pytest.approx(calculate_vpd(25.0, 100.0), abs=0.01) == 0.0

def test_frequency_bands():
    assert classify_freq_band(60.0)[0] == "QUIET_NOISE"
    assert classify_freq_band(125.0)[0] == "LOW_RUMBLE"
    assert classify_freq_band(193.4)[0] == "NORMAL_HUM"
    assert classify_freq_band(310.0)[0] == "FANNING_ACTIVE"
    assert classify_freq_band(480.0)[0] == "PIPING_AGITATION"
    assert classify_freq_band(750.0)[0] == "HIGH_NOISE"

def test_activity_index():
    # Activity index formula: 100 * clamp((band_act + band_pip + spl_norm) / 3)
    # When all are mid-range
    act = compute_activity_index(band_act=0.5, band_pip=0.2, spl_db=-40.0, spl_p5=-60.0, spl_p95=-20.0)
    # spl_norm = (-40 - -60)/40 = 20/40 = 0.5
    # (0.5 + 0.2 + 0.5) / 3 = 1.2 / 3 = 0.4 -> 40.0
    assert pytest.approx(act, abs=1.0) == 40.0

def test_income_loss_split():
    # Daytime: 06:00 to 18:30
    slopes = [
        {"hour": 10.0, "slope_kg": 0.40},  # daylight gain
        {"hour": 14.0, "slope_kg": 0.35},  # daylight gain
        {"hour": 16.0, "slope_kg": -0.05}, # daylight decrease (ignored for income)
        {"hour": 22.0, "slope_kg": -0.15}, # night loss
        {"hour": 2.0, "slope_kg": -0.10},  # night loss
        {"hour": 4.0, "slope_kg": 0.02}    # night gain (ignored for loss)
    ]
    res = compute_income_loss_split(slopes, sunrise_hour=6.0, sunset_hour=18.5)
    assert res["nectar_income_kg"] == 0.75
    assert res["ripening_loss_kg"] == 0.25
    assert res["net_kg"] == 0.50

def test_quality_score():
    # Fresh, high spectral SNR, realistic gross kg
    q_good = compute_quality_score(freq_quality=0.9, staleness_seconds=2.0, gross_kg=42.0)
    assert q_good >= 0.85

    # Very stale signal (400 seconds)
    q_stale = compute_quality_score(freq_quality=0.9, staleness_seconds=400.0, gross_kg=42.0)
    assert q_stale < 0.65

def test_bee_count():
    # 42 kg gross, 2 kg honey, tare 28 kg -> 12 kg bees -> ~120,000 bees clamped to max 80,000
    count = estimate_bee_count(gross_kg=42.0, honey_mass_kg=2.0, hive_tare_kg=28.0)
    assert 5000 <= count <= 80000
