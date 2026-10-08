# Smart Hive — Honey Monitoring Dashboard & HoneyChain Web3 Traceability

An end-to-end, production-grade IoT monitoring platform for honey bee hives (*Apis mellifera*), featuring 6 live fused sensor channels, acoustic FFT spectral analysis, autonomous honey ripening state inference, and tamper-proof **HoneyChain** blockchain provenance with dynamic consumer QR verification (Smart India Hackathon 2026, Problem Statement SIH26021, Team Roxx).

---

## 🐝 Key Capabilities

1. **6 Fused IoT Sensor Channels**:
   - **Gross Hive Weight**: Load-cell stream with median-of-7 + EMA filter and thermal compensation ($k_{temp}$).
   - **Acoustic Frequency**: Wingbeat audio hum ($100\text{--}600\text{ Hz}$), FFT spectrum, and Activity Index ($0\text{--}100$).
   - **Net Honey Collected**: Baseline-subtracted honey yield with scientific Nectar-Income vs. Ripening-Loss split.
   - **Microclimate & Psychrometrics**: In-hive vs. ambient temperature, relative humidity, Magnus dew point, and VPD.
   - **Honey Formation State Machine**: Real-time biophysical inference: `NECTAR_INTAKE` → `RIPENING` → `RAW` → `COMPLETED` → `HARVESTED`.
   - **Forager Bee Scale**: Individual bee scale channel ($100\text{ mg}$ resolution) rendered dynamically when hardware data is present.
2. **Realistic Physics Simulator**:
   - Generates 30 days of seeded historical data on first run with diurnal Bangalore microclimate cycles.
   - Time compression ($1\times$, $60\times$, $3600\times$) and scenarios (`normal`, `nectar_flow`, `heavy_fanning`, `swarm`, `queenless`, `sensor_fault`, `rain`).
3. **HoneyChain Web3 Traceability (SIH 2026 Team Roxx)**:
   - Polygon Amoy testnet batch minting with SHA-256 cryptographic verification.
   - Dynamic printable QR code jar labels with legal FSSAI $<20\%$ moisture limit validation.
4. **Offline & Rural-Ready**:
   - Operates with **zero internet, zero WiFi, and zero Bluetooth required**. Runs completely locally on LAN or single machine.
   - No external CDNs, no remote fonts, no telemetry trackers.

---

## 🚀 Quickstart Guide

### Option A: Local Development (Fastest)

#### 1. Start Python Backend
```bash
cd smart-hive
python -m pip install -r backend/requirements.txt
python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
```
*The backend initializes the SQLite database with WAL, seeds 30 days of realistic history, and launches the live 2-second telemetry loop.*

#### 2. Start React Dashboard
```bash
cd smart-hive/frontend
npm install
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

### Option B: Docker Compose (All-in-One)

```bash
cd smart-hive
docker compose up --build
```
- Web Dashboard: `http://localhost:3000`
- REST & WebSocket API: `http://localhost:8000`
- Mosquitto MQTT Broker: `localhost:1883`

---

## 🧪 Running Unit Tests

The backend test suite includes 15 automated pytest cases validating psychrometric formulas, moisture fusion, state machine hysteresis, and all 12 alert trigger rules:

```bash
cd smart-hive
python -m pytest backend/tests/ -v
```

Expected output:
```
backend/tests/test_alerts.py::test_all_12_alerts PASSED                  [  6%]
backend/tests/test_api.py::test_api_full_endpoints PASSED                [ 13%]
backend/tests/test_honey_model.py::test_equilibrium_rh_table PASSED      [ 20%]
backend/tests/test_honey_model.py::test_mass_balance_dewatering PASSED   [ 26%]
backend/tests/test_honey_model.py::test_fusion_weights PASSED            [ 33%]
backend/tests/test_honey_model.py::test_moisture_bands PASSED            [ 40%]
backend/tests/test_honey_model.py::test_stage_state_transitions PASSED   [ 46%]
backend/tests/test_metrics.py::test_dew_point_magnus PASSED              [ 53%]
backend/tests/test_metrics.py::test_absolute_humidity PASSED             [ 60%]
backend/tests/test_metrics.py::test_vpd PASSED                           [ 66%]
backend/tests/test_metrics.py::test_frequency_bands PASSED               [ 73%]
backend/tests/test_metrics.py::test_activity_index PASSED                [ 80%]
backend/tests/test_metrics.py::test_income_loss_split PASSED             [ 86%]
backend/tests/test_metrics.py::test_quality_score PASSED                 [ 93%]
backend/tests/test_metrics.py::test_bee_count PASSED                     [100%]
============================= 15 passed in 1.84s ==============================
```

---

## 🔌 5-Line Guide: How to Plug In Real Hardware

To switch from the built-in simulator to physical ESP32 hardware:
1. In `firmware/esp32-hive-node/include/config.h`, set your local WiFi SSID and MQTT broker IP.
2. Connect your sensors to the specified GPIO pins (HX711 to GPIO 16/17, DHT22 to GPIO 4/5, INMP441 to GPIO 25/26/32).
3. Flash the firmware to your ESP32 board using `pio run -t upload` inside `firmware/esp32-hive-node`.
4. In `.env`, set `SIM_MODE=false`.
5. Open `/calibration` in the dashboard and click **Tare Scale**, then calibrate with a known 5 kg check mass.

---

## 📁 Repository Structure

```
smart-hive/
  firmware/esp32-hive-node/        platformio.ini, src/main.cpp, include/config.h
  backend/app/                     main.py, config.py, db.py, models.py,
                                   ingest_mqtt.py, simulator.py, metrics.py,
                                   honey_model.py, alerts.py, ws.py, routers/
  backend/tests/                   test_metrics.py, test_honey_model.py, test_alerts.py, test_api.py
  frontend/src/                    components/, pages/, lib/, store/, styles/
  config/hive_config.json          sensors, pins, thresholds, hive meta
  config/honey_model.json          moisture/RH lookup table + fusion weights
  data/                            hive.db (git-ignored), seed CSVs
  docs/                            ARCHITECTURE.md, CALIBRATION.md, API.md, PROMPT_NOTES.md
  docker-compose.yml, README.md, .env.example
```
