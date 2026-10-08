import numpy as np
from datetime import datetime
from typing import Dict, Any, Tuple, Optional, List
from app.config import load_honey_model_config

class HoneyFormationModel:
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.cfg = config or load_honey_model_config()
        self.rh_table = self.cfg.get("rh_equilibrium_table_20c", [
            {"rh": 50.0, "moisture": 16.5},
            {"rh": 55.0, "moisture": 17.4},
            {"rh": 58.0, "moisture": 17.8},
            {"rh": 60.0, "moisture": 18.3},
            {"rh": 63.0, "moisture": 19.2},
            {"rh": 66.0, "moisture": 20.2},
            {"rh": 70.0, "moisture": 22.0},
            {"rh": 75.0, "moisture": 24.5}
        ])
        self.temp_corr_per_c = self.cfg.get("temp_correction_per_c_above_20", 0.03)
        self.default_m0 = self.cfg.get("default_initial_nectar_moisture", 0.78)

    def estimate_moisture_equilibrium_rh(self, rh_in_pct: float, t_in_c: float) -> float:
        """
        Estimate B: Equilibrium-RH (hygroscopic equilibration with in-hive air).
        Uses piecewise linear interpolation on 20°C moisture-RH sorption isotherm,
        plus a temperature correction of +0.03% / °C above 20°C.
        """
        rhs = [pt["rh"] for pt in self.rh_table]
        moists = [pt["moisture"] for pt in self.rh_table]

        # Clamp RH within bounds of table
        rh_clamped = max(rhs[0], min(rhs[-1], rh_in_pct))
        base_moist = float(np.interp(rh_clamped, rhs, moists))

        # Temperature correction
        t_diff = t_in_c - 20.0
        m_est_b = base_moist + (t_diff * self.temp_corr_per_c)
        return max(10.0, min(35.0, m_est_b))

    def estimate_moisture_mass_balance(
        self,
        current_honey_kg: float,
        initial_honey_kg: float,
        m0_pct: Optional[float] = None
    ) -> float:
        """
        Estimate A: Mass-balance dewatering calculation.
        Assumes non-water sugars/solids S are conserved during ripening:
        S = (1 - m0) * M0
        W_t = M_t - S
        m_est_a = (W_t / M_t) * 100
        """
        m0 = (m0_pct / 100.0) if m0_pct is not None else self.default_m0
        m0 = max(0.40, min(0.95, m0))

        if initial_honey_kg <= 0.05 or current_honey_kg <= 0.05:
            # Fallback when mass is too tiny
            return 21.0

        solids_kg = (1.0 - m0) * initial_honey_kg

        if current_honey_kg <= solids_kg:
            # Extremely dehydrated
            return 14.0

        water_kg = current_honey_kg - solids_kg
        moist_fraction = water_kg / current_honey_kg
        return round(moist_fraction * 100.0, 2)

    def fuse_moisture_estimates(
        self,
        m_est_a: float,
        m_est_b: float,
        quality: float,
        baseline_age_hours: float,
        refractometer_offset_pct: float = 0.0
    ) -> Tuple[float, float]:
        """
        Fused moisture content (%) and confidence score (0.0 to 1.0).
        Fuses mass-balance (wA) and sorption equilibrium (wB).
        Applies EWMA refractometer calibration offset Delta:
        m_final = m_fused + Delta.
        """
        clean_cfg = self.cfg.get("fusion_weights", {}).get("clean_data", {})
        min_q = clean_cfg.get("min_quality", 0.7)
        max_age = clean_cfg.get("max_baseline_age_hours", 168.0)

        is_clean = (quality >= min_q) and (baseline_age_hours <= max_age)

        if is_clean:
            wA = clean_cfg.get("weight_mass_balance_wA", 0.6)
            wB = clean_cfg.get("weight_equilibrium_wB", 0.4)
            conf_base = 0.85
        else:
            deg_cfg = self.cfg.get("fusion_weights", {}).get("degraded_data", {})
            wA = deg_cfg.get("weight_mass_balance_wA", 0.2)
            wB = deg_cfg.get("weight_equilibrium_wB", 0.8)
            conf_base = 0.60

        m_fused = (wA * m_est_a) + (wB * m_est_b)
        m_final = round(m_fused + refractometer_offset_pct, 2)

        # Confidence decays with sensor quality and baseline age
        quality_factor = max(0.5, min(1.0, quality))
        age_decay = max(0.6, 1.0 - (baseline_age_hours / (max_age * 2.0)))
        confidence = round(min(0.98, max(0.3, conf_base * (0.5 + 0.5 * quality_factor) * age_decay)), 2)

        return m_final, confidence

    def classify_moisture_band(self, moisture_pct: float) -> Tuple[str, str]:
        """
        Returns moisture band category and descriptive label:
        < 17.5%: Excellent (Grade A+, export grade)
        17.5% - 18.6%: Grade A (Standard capped honey)
        18.6% - 20.0%: Risky (Borderline uncapped)
        > 20.0%: Fermenting / Too Wet (Unripe, high water content)
        """
        if moisture_pct < 17.5:
            return "EXCELLENT", "Excellent (<17.5%)"
        elif moisture_pct <= 18.6:
            return "GRADE_A", "Grade A (<18.6%)"
        elif moisture_pct <= 20.0:
            return "RISKY", "Risky (18.6–20%)"
        else:
            return "FERMENTING", "Fermenting / Too Wet (>20%)"

    def infer_stage(
        self,
        current_state: str,
        moisture_pct: float,
        weight_slope_kg_h: float,
        is_daylight: bool,
        band_act: float,
        weight_variance_kg: float,
        stable_hours: float
    ) -> Tuple[str, str]:
        """
        Stage state machine (§6.1):
        - NECTAR_INTAKE: daylight, weight slope > +0.05 kg/h, moisture est > 40%
        - RIPENING: weight falling while band_act elevated (fanning) and/or VPD rising, moisture est 20–40%
        - RAW: stable weight >= 6 h, moisture est 18.6–20%, not yet capped
        - COMPLETED: stable plateau >= 12 h, moisture est < 18.6%, fanning decayed, low variance
        - HARVESTED: manually confirmed or sudden massive drop
        """
        if current_state == "HARVESTED":
            return "HARVESTED", "Harvested colony state"

        # Check completed condition
        if moisture_pct <= 18.6 and stable_hours >= 12.0 and band_act < 0.35 and weight_variance_kg < 0.08:
            return "COMPLETED", "Ripened, ready / Capped honey detected"

        # Check raw condition
        if 18.6 <= moisture_pct <= 20.0 and stable_hours >= 6.0:
            return "RAW", "Raw / uncapped honey (18.6–20% moisture)"

        # Check ripening condition
        if (20.0 < moisture_pct <= 40.0) or (weight_slope_kg_h < -0.01 and band_act >= 0.25):
            return "RIPENING", "Active fanning & dewatering by colony"

        # Check nectar intake
        if is_daylight and weight_slope_kg_h > 0.05 and moisture_pct > 30.0:
            return "NECTAR_INTAKE", "Nectar foraging intake in progress"

        # Fallback to current or closest state based on moisture
        if moisture_pct < 18.6:
            return "COMPLETED", "Ripened honey ready for harvest"
        elif moisture_pct <= 20.0:
            return "RAW", "Raw uncapped honey"
        elif moisture_pct <= 35.0:
            return "RIPENING", "Colony actively dewatering nectar"
        else:
            return "NECTAR_INTAKE", "Fresh nectar stores accumulating"
