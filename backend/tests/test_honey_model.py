import pytest
from app.honey_model import HoneyFormationModel

def test_equilibrium_rh_table():
    model = HoneyFormationModel()
    # At 20°C and 55% RH -> should be ~17.4%
    m_20 = model.estimate_moisture_equilibrium_rh(rh_in_pct=55.0, t_in_c=20.0)
    assert pytest.approx(m_20, abs=0.1) == 17.4

    # At 30°C (+10°C above 20°C) -> +0.3% correction -> ~17.7%
    m_30 = model.estimate_moisture_equilibrium_rh(rh_in_pct=55.0, t_in_c=30.0)
    assert pytest.approx(m_30, abs=0.1) == 17.7

    # At 60% RH, 20°C -> 18.3%
    m_60 = model.estimate_moisture_equilibrium_rh(rh_in_pct=60.0, t_in_c=20.0)
    assert pytest.approx(m_60, abs=0.1) == 18.3

def test_mass_balance_dewatering():
    model = HoneyFormationModel()
    # Initial nectar 10 kg with 78% moisture (2.2 kg solids, 7.8 kg water)
    # Dewaters to 3.0 kg total (2.2 kg solids, 0.8 kg water) -> 0.8/3.0 = 26.67%
    m_est = model.estimate_moisture_mass_balance(
        current_honey_kg=3.0,
        initial_honey_kg=10.0,
        m0_pct=78.0
    )
    assert 26.0 <= m_est <= 27.5

def test_fusion_weights():
    model = HoneyFormationModel()
    # Clean data (quality 0.9, fresh baseline 12h) -> wA=0.6, wB=0.4
    m_clean, conf_clean = model.fuse_moisture_estimates(
        m_est_a=18.0,
        m_est_b=17.0,
        quality=0.9,
        baseline_age_hours=12.0
    )
    # 0.6*18.0 + 0.4*17.0 = 10.8 + 6.8 = 17.6
    assert pytest.approx(m_clean, abs=0.1) == 17.6
    assert conf_clean >= 0.75

    # Degraded data (quality 0.4) -> wA=0.2, wB=0.8
    m_deg, conf_deg = model.fuse_moisture_estimates(
        m_est_a=18.0,
        m_est_b=17.0,
        quality=0.4,
        baseline_age_hours=12.0
    )
    # 0.2*18.0 + 0.8*17.0 = 3.6 + 13.6 = 17.2
    assert pytest.approx(m_deg, abs=0.1) == 17.2
    assert conf_deg < conf_clean

def test_moisture_bands():
    model = HoneyFormationModel()
    assert model.classify_moisture_band(16.8)[0] == "EXCELLENT"
    assert model.classify_moisture_band(18.2)[0] == "GRADE_A"
    assert model.classify_moisture_band(19.4)[0] == "RISKY"
    assert model.classify_moisture_band(21.5)[0] == "FERMENTING"

def test_stage_state_transitions():
    model = HoneyFormationModel()

    # 1. Nectar intake (daylight, strong gain, high moisture)
    st, _ = model.infer_stage(
        current_state="UNKNOWN",
        moisture_pct=45.0,
        weight_slope_kg_h=0.08,
        is_daylight=True,
        band_act=0.2,
        weight_variance_kg=0.1,
        stable_hours=0.5
    )
    assert st == "NECTAR_INTAKE"

    # 2. Ripening (active fanning, falling weight, 25% moisture)
    st, _ = model.infer_stage(
        current_state="NECTAR_INTAKE",
        moisture_pct=26.0,
        weight_slope_kg_h=-0.03,
        is_daylight=False,
        band_act=0.45,
        weight_variance_kg=0.05,
        stable_hours=2.0
    )
    assert st == "RIPENING"

    # 3. Raw (stable 7h, moisture 19.2%)
    st, _ = model.infer_stage(
        current_state="RIPENING",
        moisture_pct=19.2,
        weight_slope_kg_h=0.0,
        is_daylight=True,
        band_act=0.2,
        weight_variance_kg=0.04,
        stable_hours=7.0
    )
    assert st == "RAW"

    # 4. Completed (stable 15h, moisture 17.9%, low fanning)
    st, _ = model.infer_stage(
        current_state="RAW",
        moisture_pct=17.9,
        weight_slope_kg_h=0.0,
        is_daylight=False,
        band_act=0.15,
        weight_variance_kg=0.02,
        stable_hours=15.0
    )
    assert st == "COMPLETED"

    # 5. Harvested remains harvested
    st, _ = model.infer_stage(
        current_state="HARVESTED",
        moisture_pct=17.5,
        weight_slope_kg_h=0.0,
        is_daylight=False,
        band_act=0.1,
        weight_variance_kg=0.01,
        stable_hours=20.0
    )
    assert st == "HARVESTED"
