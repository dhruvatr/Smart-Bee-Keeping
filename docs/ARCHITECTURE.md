# Smart Hive — System Architecture & Data Engineering

This document outlines the full-stack architecture of the **Smart Hive IoT Monitoring and HoneyChain Traceability Platform**, designed for remote apiary health tracking, autonomous honey ripening inference, and decentralized blockchain certification.

---

## 1. High-Level System Architecture

```
+---------------------------------------------------------------------------------+
|                       EDGE SENSOR NODE (ESP32 DevKit v1)                        |
|                                                                                 |
|  [HX711 Primary Load Cell (50-100 kg)]      --> Median-of-7 + EMA α=0.05 Filter |
|  [HX711 Forager Bee Scale (200 g, optional)]--> 100 mg Resolution Scale         |
|  [Dual DHT22 In-Hive + Ambient T/RH]       --> Brood Nest Thermoregulation      |
|  [INMP441 I2S MEMS Microphone (8 kHz)]      --> 4096-Pt FFT Audio Analysis       |
|                                                                                 |
|  [Transmission Engine]:                                                         |
|    - Local Ring Buffer (150 records / 5 min RAM buffering)                      |
|    - Dual-Channel: MQTT 1 msg/2s (hive/HIVE-01/telemetry)                       |
|    - Local Fallback: Embedded HTTP GET /latest + Serial CLI                     |
+---------------------------------------------------------------------------------+
                                       |
              (WiFi / MQTT / Offline Serial Ingest / BLE Gateway)
                                       v
+---------------------------------------------------------------------------------+
|                       BACKEND ENGINE (FastAPI + Python 3.11)                   |
|                                                                                 |
|  [Ingestion & Bridge]       : paho-mqtt listener + HTTP fallback                |
|  [Physics Simulator Engine] : Diurnal Bangalore climate + realistic ripening    |
|  [Metrics & Psychrometrics] : Dew point (Magnus), VPD, Activity Index, AH       |
|  [Honey Formation Model]    : Fused Mass-Balance (wA) + Sorption Isotherm (wB)  |
|  [Alerts Engine]            : 12 Real-time rules with "Why?" threshold inspect  |
|  [Storage Engine]           : SQLite with WAL (hot readings + 1m/1h rollups)    |
|  [Web3 Provenance Bridge]   : Polygon Amoy testnet batch minting & QR generator |
|  [Realtime Server]          : WebSockets /ws/live (2-second live push)          |
+---------------------------------------------------------------------------------+
                                       |
                     (WebSocket /ws/live + REST JSON)
                                       v
+---------------------------------------------------------------------------------+
|                 FRONTEND DASHBOARD (React 18 + Vite + TypeScript)              |
|                                                                                 |
|  - Deep Charcoal & Honey-Gold Dark UI (#0B0E11 / #F2B705)                       |
|  - 6 Fused Vital KPI Cards with 60-min Sparklines & ⓘ Formula Tooltips          |
|  - Synchronized Real-time Strip Charts (Weight, Pitch, Temp, RH)                |
|  - Custom <canvas> FFT Spectrum (20–1000 Hz) + 60-Frame Waterfall Spectrogram   |
|  - 72-Hour Full-Width Honey Formation Timeline Chart                            |
|  - Interactive Honey Moisture Gauge & Harvest Readiness Planner                 |
|  - Web Audio API Live Colony Hum Synthesizer                                    |
|  - HoneyChain Printable QR Jar Label & Consumer Verification Portal             |
|  - Settings Management & Calibration Console                                    |
+---------------------------------------------------------------------------------+
```

---

## 2. Low-Latency Offline-First Architecture

In rural and remote agricultural environments (e.g., forest apiaries across India), cellular and internet connectivity are often intermittent or nonexistent. The system is engineered to function completely offline without internet, WiFi, or Bluetooth dependencies:

1. **Edge Node Autonomy**: The ESP32 maintains internal timekeeping and ring-buffers up to 150 records (5 minutes of telemetry) in RAM. It exposes a direct HTTP server (`/latest`) and bidirectional Serial CLI (`tare`, `cal <kg>`, `dump`, `sim`).
2. **Localhost & LAN Operation**: The entire backend, SQLite database, simulator, and React dashboard run locally on any laptop or field gateway with zero CDN calls and zero external font or script requests.
3. **HoneyChain Offline Batch Syncing**: Harvested honey metrics and FSSAI checks are recorded locally in the SQLite ledger. When internet connectivity is restored, cryptographic batch records are committed to the Polygon Amoy blockchain.

---

## 3. Storage Architecture & Hot Write Path

To ensure the database remains lightweight (<200 MB for a 30-day continuous run) while handling 0.5–1 Hz writes:
- **Write-Ahead Logging (WAL)**: Enabled via `PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;` for non-blocking concurrent reads and writes.
- **Rollup Hierarchy**:
  - `readings`: High-resolution raw sensor stream (kept for hot analysis and recent strip charts).
  - `readings_1m`: 1-minute rollups computing mean, min, max, standard deviation, and delta.
  - `readings_1h`: 1-hour rollups powering 72-hour timelines and 30-day trend charts.
