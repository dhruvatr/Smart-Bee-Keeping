# Smart Hive — REST & WebSocket API Specification

All endpoints are served by the FastAPI backend on port 8000 under the `/api` prefix, with WebSockets pushed at `/ws/live`.

---

## 1. Telemetry & Analytics Endpoints

### `GET /api/live`
Returns latest telemetry reading, derived psychrometric metrics, and current honey state.
- **Query params**: `hive_id` (default: `HIVE-01`)
- **Response**:
```json
{
  "hive_id": "HIVE-01",
  "ts": "2026-10-08T15:00:00+05:30",
  "reading": { "gross_kg": 41.28, "freq_dom_hz": 193.4, "t_in_c": 34.5, "rh_in_pct": 55.1, ... },
  "derived": {
    "honey_mass_kg": 2.78,
    "honey_today_kg": 0.32,
    "dew_point_in_c": 24.2,
    "vpd_in_kpa": 1.15,
    "activity_index": 42.5,
    "bees_estimate": 42800,
    "quality_score": 0.92
  },
  "honey_state": {
    "state": "RAW",
    "confidence": 0.88,
    "moisture_est_pct": 18.2,
    "moisture_band": "GRADE_A"
  }
}
```

### `GET /api/series`
Returns time-series arrays for charting.
- **Query params**:
  - `metric`: `gross_kg`, `freq_dom_hz`, `t_in_c`, `rh_in_pct`, `spl_db`
  - `res`: `1s` (hot), `1m` (recent), `1h` (historical)
  - `from`, `to`: ISO-8601 timestamps

### `GET /api/summary`
Returns headline KPI aggregates (today, 7d, 30d, season).
- **Query params**: `range` (`today` | `7d` | `30d` | `season`)
- **Response fields**: `honey_collected_kg`, `nectar_income_kg`, `ripening_loss_kg`, `net_kg`, `avg_t_in_c`, `avg_rh_in_pct`, `avg_freq_hz`, `fanning_hours`, `uptime_pct`.

### `GET /api/spectrum/latest` & `GET /api/spectrum/history`
- `/latest`: 512-bin magnitude array (0–1000 Hz, ~1.95 Hz/bin).
- `/history`: Last 60 frames for the spectrogram waterfall.

### `GET /api/export.csv`
Streams telemetry readings as a standard downloadable CSV file.

---

## 2. Colony Events & Calibration

- `GET /api/events?type=all|state|alert|calibration|harvest`
- `POST /api/events/harvest`: Record honey harvest extraction mass and frame count.
- `POST /api/baseline`: Zero/set colony gross baseline mass.
- `POST /api/refractometer`: Submit laboratory optical moisture percentage for EWMA back-fitting.
- `POST /api/calibrate`: Execute tare zeroing or known-mass calibration.
- `POST /api/alerts/{id}/ack`: Acknowledge an alarm.

---

## 3. Simulator Controls

- `POST /api/sim/start` & `POST /api/sim/stop`
- `POST /api/sim/scenario`: `{ "scenario": "normal" | "nectar_flow" | "heavy_fanning" | "swarm" | "queenless" | "sensor_fault" | "rain" }`
- `POST /api/sim/speed`: `{ "speed": 1.0 | 60.0 | 3600.0 }`

---

## 4. HoneyChain Blockchain Endpoints (SIH 2026 Team Roxx)

- `GET /api/blockchain/batches`: Fetch all registered batches.
- `POST /api/blockchain/mint`: Mint honey batch to Polygon Amoy with SHA-256 batch hash, block number, and QR code URL.
- `GET /api/blockchain/verify/{batch_id}`: Public consumer verification portal endpoint.

---

## 5. WebSocket Live Push

- `WS /ws/live`: Real-time push stream broadcasting `{ type: "telemetry", reading, derived, honey_state, alerts }` every 2 seconds. Automatically reconnects on the client.
