# Smart Hive — Calibration & Hardware Zeroing Guide

This manual guides apiarists and engineers through calibrating load cells, thermal drift compensation, audio noise floor zeroing, and refractometer optical back-fitting.

---

## 1. Primary Load Cell Calibration (2-Point Method)

The hive scale utilizes an **HX711 24-bit ADC** interfaced to a 4-wire strain-gauge beam load cell.

### 1.1 Step 1: Tare (Zero ADC Calibration)
1. Ensure the hive scale platform has the hive box, bottom board, and empty frames installed, but no extraneous external weights.
2. From the web dashboard, navigate to `/calibration`.
3. Observe the live raw ADC count (e.g., `812,000`).
4. Click **Tare Scale (Zero ADC)** or issue the serial command:
   ```bash
   tare
   ```
5. The current ADC counts are stored as `counts_tare` in `hive_config.json` and in the database `calibrations` table.

### 1.2 Step 2: Known Mass Span Calibration
1. Place a certified reference mass (e.g., $5.0\text{ kg}$ or $10.0\text{ kg}$) on top of the hive.
2. In the **/calibration** interface under "Known Mass Calibration", enter the known value (e.g., `5.0`).
3. Click **Compute counts_per_kg** or execute over serial:
   ```bash
   cal 5.0
   ```
4. The system calculates:
   $$\text{counts\_per\_kg} = \frac{\text{ADC}_{\text{current}} - \text{ADC}_{\text{tare}}}{\text{known\_mass\_kg}}$$
5. The scale is now calibrated to a $10\text{ g}$ ($0.01\text{ kg}$) display resolution.

---

## 2. Temperature Drift Compensation ($k_{temp}$)

Load cells and aluminum shear beams undergo physical thermal expansion, causing apparent weight drift under intense sunlight:
$$W(t) = W_{\text{raw}}(t) - k_{\text{temp}} \cdot (T_{\text{in}} - 20.0^\circ\text{C})$$
- Default value: $k_{\text{temp}} = 0.002\text{ kg}/^\circ\text{C}$ (i.e., $20\text{ g}$ drift per $10^\circ\text{C}$ shift).
- Tunable dynamically via `Settings` -> `Thresholds & Settings`.

---

## 3. Optical Refractometer Ground-Truth Loop

While the hybrid honey model continuously estimates moisture content from mass-balance and equilibrium relative humidity, beekeepers can enter optical lab refractometer readings:
1. Extract a drop of honey from capped frames and test with an optical brix/moisture refractometer (e.g., Atago MASTER-HONEY).
2. On `/calibration` or the Quick Actions rail, enter the measured moisture (e.g., `17.8%`).
3. Click **Back-Fit Honey Model**.
4. The backend computes an Exponentially Weighted Moving Average (EWMA, $\alpha = 0.3$) offset $\Delta$:
   $$\Delta_{\text{new}} = (1 - \alpha) \cdot \Delta_{\text{prev}} + \alpha \cdot (\text{moisture}_{\text{lab}} - m_{\text{model}})$$
   $$m_{\text{final}} = m_{\text{fused}} + \Delta_{\text{new}}$$
5. The updated offset is recorded in `calibrations` with operator identity and timestamp.
