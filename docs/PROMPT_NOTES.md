# Smart Hive — Prompt Notes & Mathematical Reference

This document catalogs every scientific formula, sensor metric definition, decision threshold, and rationale implemented in the **Smart Hive Honey Monitoring & HoneyChain Platform**.

---

## 1. Metric Formulas & Engineering Equations

### 1.1 Gross Hive Weight & Honey Mass
- **Gross Colony Weight $W_{gross}(t)$**:
  $$W_{gross}(t) = \frac{\text{ADC}_{\text{filtered}} - \text{ADC}_{\text{tare}}}{\text{counts\_per\_kg}} - k_{temp} \cdot (T_{in} - 20.0^\circ\text{C})$$
  - Filter: Median-of-7 window followed by Exponential Moving Average (EMA) with $\alpha = 0.05$.
  - Resolution: Clamped to 10 g ($0.01\text{ kg}$) step resolution.
  - $k_{temp}$: Thermal expansion coefficient of strain gauge ($0.002\text{ kg}/^\circ\text{C}$, tunable).

- **Honey-Only Mass $W_{honey}(t)$**:
  $$W_{honey}(t) = \max(0, W_{gross}(t) - W_{baseline})$$
  - Where $W_{baseline}$ is the recorded gross weight at the last tare / baseline zeroing event (post-inspection or extraction).
  - Negative drift flag raised if $W_{gross} < W_{baseline}$ to alert the apiarist of comb removal or loss.

- **Headline Honey Production KPIs**:
  - $\text{honey\_today\_kg} = W_{gross}(t) - W_{gross}(00:00\text{ local Asia/Kolkata})$
  - $\text{honey\_24h\_kg} = W_{gross}(t) - W_{gross}(t - 24\text{h})$
  - $\text{honey\_7d\_kg} = W_{gross}(t) - W_{gross}(t - 7\text{d})$
  - $\text{honey\_total\_kg} = W_{gross}(t) - W_{baseline}$

### 1.2 Income vs. Ripening Loss Split
Slopes evaluated on 15-minute rolling deltas ($\Delta W$):
- **Nectar Income (Foraging Gain)**:
  $$\text{nectar\_income\_kg} = \sum_{\substack{\Delta W > 0 \\ t \in [\text{sunrise}, \text{sunset})}} \Delta W$$
- **Ripening Loss (Water Evaporation)**:
  $$\text{ripening\_loss\_kg} = \sum_{\substack{\Delta W < 0 \\ t \notin [\text{sunrise}, \text{sunset})}} |\Delta W|$$
- **Net Honey Yield**:
  $$\text{net\_kg} = \text{nectar\_income\_kg} - \text{ripening\_loss\_kg}$$

### 1.3 Biomass Context (Bee Population Estimate)
$$\text{bees\_estimate} = \frac{W_{gross} - W_{honey} - W_{tare\_hardware}}{0.0001\text{ kg}}$$
- Average worker honeybee (*Apis mellifera*) mass $\approx 100\text{ mg} = 0.0001\text{ kg}$.
- Labeled clearly as an approximation.

---

## 2. Acoustic Analysis & Behavioral Bands

### 2.1 Frequency Band Classification
Sampling: 8 kHz sample rate, 4096-sample Hann-windowed FFT ($0.512\text{ s}$ window, $50\%$ overlap). Dominant peak analyzed in the $100\text{--}600\text{ Hz}$ bio-acoustic range.

| Band Range | Classification | Ecological Behavioral Meaning |
| :--- | :--- | :--- |
| $< 100\text{ Hz}$ | `QUIET_NOISE` | Sensor noise floor / inactivity |
| $100\text{--}150\text{ Hz}$ | `LOW_RUMBLE` | Mechanical hive box vibration or disturbance |
| $150\text{--}250\text{ Hz}$ | `NORMAL_HUM` | Calm colony resting hum / brood incubation (fundamental ~190 Hz) |
| $250\text{--}400\text{ Hz}$ | `FANNING_ACTIVE` | Active fanning & honey ripening dewatering signature |
| $400\text{--}600\text{ Hz}$ | `PIPING_AGITATION` | Worker agitation, queen piping, or pre-swarm agitation |
| $> 600\text{ Hz}$ | `HIGH_NOISE` | Wind shear, rain on roof, or acoustic artifact |

### 2.2 Activity Index (0–100)
$$\text{Activity Index} = 100 \cdot \text{clamp}\left(\frac{\text{band\_act} + \text{band\_pip} + \text{spl\_db\_norm}}{3}, 0.0, 1.0\right)$$
where $\text{spl\_db\_norm}$ is min-max normalized against rolling 7-day percentiles ($p_{5}\text{--}p_{95}$) of $\text{spl\_db}$.

---

## 3. Environmental & Psychrometric Equations

### 3.1 Dew Point (°C) — Magnus-Tetens Formula
$$\gamma(T, RH) = \frac{17.27 \cdot T}{237.7 + T} + \ln\left(\frac{RH}{100}\right)$$
$$T_{dew} = \frac{237.7 \cdot \gamma}{17.27 - \gamma}$$

### 3.2 Absolute Humidity ($g/m^3$)
$$e = 6.112 \cdot \exp\left(\frac{17.67 \cdot T}{T + 243.5}\right) \cdot \left(\frac{RH}{100}\right)\text{ hPa}$$
$$AH = 216.7 \cdot \left(\frac{e}{T + 273.15}\right)$$

### 3.3 Vapor Pressure Deficit (VPD, kPa)
$$VP_{sat} = 0.61078 \cdot \exp\left(\frac{17.27 \cdot T}{T + 237.3}\right)\text{ kPa}$$
$$VPD = VP_{sat} \cdot \left(1.0 - \frac{RH}{100}\right)$$

---

## 4. Honey Formation & Moisture Estimation Model

### 4.1 Fused Moisture Estimator
- **Model A (Mass-Balance)**:
  $$S = (1 - m_0) \cdot M_0$$
  $$W_t = M_t - S$$
  $$m_{est,A} = \frac{W_t}{M_t} \cdot 100\%$$
- **Model B (Equilibrium-RH Sorption Isotherm)**:
  Interpolated piecewise linear table from `honey_model.json` at 20°C:
  $50\% \to 16.5\%$, $55\% \to 17.4\%$, $58\% \to 17.8\%$, $60\% \to 18.3\%$, $63\% \to 19.2\%$, $66\% \to 20.2\%$, $70\% \to 22.0\%$, $75\% \to 24.5\%$.
  Corrected for temperature: $+0.03\%/^\circ\text{C}$ above 20°C.
- **Sensor Fusion**:
  $$m_{fused} = w_A \cdot m_{est,A} + w_B \cdot m_{est,B}$$
  - Clean data ($q \ge 0.7$, baseline age $< 168\text{ h}$): $w_A = 0.6, w_B = 0.4$.
  - Degraded data: $w_A = 0.2, w_B = 0.8$.
- **Ground Truth Refractometer Loop**:
  $$m_{final} = m_{fused} + \Delta$$
  where $\Delta \leftarrow 0.7 \cdot \Delta + 0.3 \cdot (\text{lab\_reading} - m_{est})$.

### 4.2 Moisture Band Classifications
- $< 17.5\%$: **Excellent** (Grade A+, export grade)
- $17.5\% \text{--} 18.6\%$: **Grade A** (Ripe, capped honey ready for harvest)
- $18.6\% \text{--} 20.0\%$: **Risky** (Raw uncapped honey, will ferment if jarred)
- $> 20.0\%$: **Fermenting / Too Wet** (Violates legal FSSAI standards)

---

## 5. Alert Trigger Rules & Decision Logic

| Rule ID | Severity | Threshold Condition | Rationale & Impact |
| :--- | :--- | :--- | :--- |
| `SWARM_EVENT` | Critical | Weight drop $\ge 1.5\text{ kg}$ in $6\text{ h}$ + high acoustic activity | Prime swarm departing with the queen. Urgent action needed to catch swarm. |
| `ABSCONDING` | Critical | Weight drop $\ge 3.0\text{ kg}$ in $24\text{ h}$ + activity collapsed | Complete colony abandonment due to pests/stress. |
| `QUEENLESS_SUSPECT` | Warning | $\text{SPL} > p_{95}$ and $\text{Freq} \ge 190 + 20\text{ Hz}$ sustained | Characteristic "queenless roar" and queen piping sound. |
| `BROOD_OVERHEAT` | Critical | $T_{in} > 36.0^\circ\text{C}$ for $> 30\text{ min}$ | Lethal brood nest overheat; risks wax comb melt and brood death. |
| `BROOD_TOO_COLD` | Warning | $T_{in} < 32.0^\circ\text{C}$ for $> 60\text{ min}$ | Hypothermia risks brood chilling and colony contraction. |
| `HUMIDITY_OUT` | Warning | $RH_{in} < 40\%$ or $> 70\%$ for $> 2\text{ h}$ | Causes larval desiccation ($<40\%$) or chalkbrood mold ($>70\%$). |
| `HONEY_UNRIPE` | Warning | Moisture $> 20.0\%$ for $> 12\text{ h}$ | Honey is uncapped; harvesting risks spoilage from osmophilic yeasts. |
| `HONEY_READY` | Info | State transitions to `COMPLETED` | Honey reached $\le 18.6\%$ and comb is capped. Ready for extraction. |
| `ROBBING_SUSPECT` | Warning | Daytime $\Delta W < -0.4\text{ kg/h}$ + audio spike | Foreign bees or wasps attacking hive to steal honey stores. |
| `NODE_OFFLINE` | Critical | No telemetry packets for $> 300\text{ s}$ | Telemetry transmission failure or hardware battery dead. |
| `LOADCELL_DRIFT` | Warning | Check-mass deviation $> 0.1\text{ kg}$ | Scale zero or mechanical calibration drift detected. |
| `NIGHT_LOSS_SPIKE` | Info | Night loss rate $> 3\times$ 7-day median | Heavy nectar intake undergoing aggressive overnight fanning. |

---

## 6. Assumptions Replaced (✏️ Defaults Chosen)
- **Timezone**: Set to `Asia/Kolkata` (+05:30) as specified in contract.
- **Sun schedule**: Sunrise set to `06:00`, sunset set to `18:30`.
- **Baseline weight**: Initial hive structure tare set to `38.5 kg`.
- **Primary load cell**: HX711 10 SPS Gain 128, Tare: 812,000 counts, Calibration: 21,450 counts/kg.
- **Secondary bee scale**: HX711 200g load cell (average forager: ~104 mg).
- **Acoustic noise floor**: Ambient zero set to `-65.0 dBFS`.
- **Simulation time compression**: Default `60x` (1 real second = 1 sim minute) with switchable `1x` and `3600x`.
