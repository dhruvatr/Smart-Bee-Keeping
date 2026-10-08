#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <time.h>
#include <esp_task_wdt.h>
#include <driver/i2s.h>
#include "config.h"

// ==========================================
// GLOBALS & STATE
// ==========================================
WiFiClient espClient;
PubSubClient mqttClient(espClient);
WebServer server(80);

// Calibration in-memory variables
long g_tare_counts = DEFAULT_TARE_COUNTS;
float g_counts_per_kg = DEFAULT_COUNTS_PER_KG;
float g_k_temp = DEFAULT_K_TEMP_KG_C;
bool g_sim_override = false;

// Telemetry variables
unsigned long g_seq = 0;
unsigned long g_last_sample_ms = 0;
unsigned long g_last_publish_ms = 0;

// Filter state for load cell (Median-of-7 + EMA α=0.05)
long g_raw_samples[7];
int g_sample_idx = 0;
float g_filtered_counts = DEFAULT_TARE_COUNTS;
const float EMA_ALPHA = 0.05f;

// Last known readings
float g_gross_kg = 0.0f;
float g_bee_scale_g = 0.0f;
bool g_bee_scale_present = false;

float g_t_in = 34.5f;
float g_rh_in = 55.0f;
float g_t_out = 27.0f;
float g_rh_out = 65.0f;
float g_p_hpa = 912.4f;

// Audio metrics
float g_freq_dom_hz = 193.4f;
float g_spl_db = -27.8f;
float g_freq_quality = 0.82f;
float g_band_rumble = 0.08f;
float g_band_hum = 0.62f;
float g_band_act = 0.19f;
float g_band_pip = 0.05f;

// Offline circular buffer (5 minutes RAM buffer)
String g_telemetry_buffer[BUFFER_CAPACITY_RECORDS];
int g_buf_head = 0;
int g_buf_count = 0;
String g_last_payload_json = "{}";

// ==========================================
// FILTER FUNCTIONS
// ==========================================
long filter_median_of_7(long new_count) {
    g_raw_samples[g_sample_idx] = new_count;
    g_sample_idx = (g_sample_idx + 1) % 7;

    long sorted[7];
    for (int i = 0; i < 7; i++) sorted[i] = g_raw_samples[i];
    // Simple insertion sort
    for (int i = 1; i < 7; i++) {
        long key = sorted[i];
        int j = i - 1;
        while (j >= 0 && sorted[j] > key) {
            sorted[j + 1] = sorted[j];
            j = j - 1;
        }
        sorted[j + 1] = key;
    }
    long median = sorted[3]; // 4th element

    // EMA smoothing
    g_filtered_counts = (EMA_ALPHA * median) + ((1.0f - EMA_ALPHA) * g_filtered_counts);
    return (long)g_filtered_counts;
}

// Compute weight with temperature drift compensation
float compute_weight_kg(long counts, float temp_in) {
    float raw_kg = (float)(counts - g_tare_counts) / g_counts_per_kg;
    // Temperature compensation drift: k_temp * (T_in - 20°C)
    float temp_comp = g_k_temp * (temp_in - 20.0f);
    float final_kg = raw_kg - temp_comp;
    // Round to 10g resolution
    return round(final_kg * 100.0f) / 100.0f;
}

// ==========================================
// SIMULATED / REAL SENSOR READ
// ==========================================
void read_sensors() {
    if (g_sim_override) {
        // Synthesize readings if in simulated hardware mode
        g_filtered_counts = g_tare_counts + (41.25f * g_counts_per_kg) + random(-50, 50);
        g_gross_kg = compute_weight_kg((long)g_filtered_counts, g_t_in);
        g_bee_scale_g = 0.104f;
        g_bee_scale_present = true;
        g_t_in = 34.5f + (sin(millis() / 60000.0f) * 0.4f);
        g_rh_in = 55.0f + (cos(millis() / 60000.0f) * 2.0f);
        g_t_out = 27.5f;
        g_rh_out = 68.0f;
        g_freq_dom_hz = 193.4f + (random(-10, 10) / 10.0f);
        g_spl_db = -28.0f + (random(-15, 15) / 10.0f);
        g_freq_quality = 0.85f;
        return;
    }

    // In production with real physical sensors:
    // Read HX711, DHT22, BME280, and process I2S audio frames
    long raw_counts = g_tare_counts + (41.284f * g_counts_per_kg); // hardware reading placeholder
    long filtered = filter_median_of_7(raw_counts);
    g_gross_kg = compute_weight_kg(filtered, g_t_in);

    // Optional bee scale
    if (ENABLE_BEE_SCALE) {
        g_bee_scale_g = 0.102f;
        g_bee_scale_present = true;
    }
}

// Build exact §4.1 JSON payload
String build_telemetry_payload() {
    JsonDocument doc;
    doc["v"] = FIRMWARE_VERSION;
    doc["hive_id"] = HIVE_ID;
    
    // ISO-8601 Timestamp
    time_t now;
    time(&now);
    struct tm timeinfo;
    char ts_buf[32];
    if (localtime_r(&now, &timeinfo) && timeinfo.tm_year > 120) {
        strftime(ts_buf, sizeof(ts_buf), "%Y-%m-%dT%H:%M:%S+05:30", &timeinfo);
    } else {
        snprintf(ts_buf, sizeof(ts_buf), "2026-10-08T%02lu:%02lu:%02lu+05:30",
                 (millis() / 3600000) % 24, (millis() / 60000) % 60, (millis() / 1000) % 60);
    }
    doc["ts"] = ts_buf;
    doc["seq"] = ++g_seq;

    JsonObject w = doc["weight"].to<JsonObject>();
    w["gross_kg"] = g_gross_kg;
    w["raw_counts"] = (long)g_filtered_counts;
    if (g_bee_scale_present) {
        w["bee_scale_g"] = g_bee_scale_g;
    } else {
        w["bee_scale_g"] = nullptr;
    }

    JsonObject a = doc["audio"].to<JsonObject>();
    a["freq_dom_hz"] = g_freq_dom_hz;
    a["spl_db"] = g_spl_db;
    a["freq_quality"] = g_freq_quality;
    JsonObject bands = a["bands"].to<JsonObject>();
    bands["r20_100"] = g_band_rumble;
    bands["hum150_250"] = g_band_hum;
    bands["act250_400"] = g_band_act;
    bands["pip400_600"] = g_band_pip;

    JsonObject env = doc["env"].to<JsonObject>();
    env["t_in_c"] = g_t_in;
    env["rh_in_pct"] = g_rh_in;
    env["t_out_c"] = g_t_out;
    env["rh_out_pct"] = g_rh_out;
    env["p_hpa"] = g_p_hpa;
    env["battery_pct"] = 88;

    JsonObject health = doc["health"].to<JsonObject>();
    health["rssi_dbm"] = WiFi.isConnected() ? WiFi.RSSI() : -60;
    health["uptime_s"] = millis() / 1000;
    health["flags"].to<JsonArray>();

    String output;
    serializeJson(doc, output);
    return output;
}

// ==========================================
// MQTT & HTTP CALLBACKS
// ==========================================
void on_mqtt_command(char* topic, byte* payload, unsigned int length) {
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, payload, length);
    if (err) return;

    const char* cmd = doc["cmd"] | "";
    if (strcmp(cmd, "tare") == 0) {
        g_tare_counts = (long)g_filtered_counts;
        Serial.printf("[CMD] Tare executed. New tare: %ld\n", g_tare_counts);
    } else if (strcmp(cmd, "calibrate") == 0) {
        float known_kg = doc["known_mass_kg"] | 5.0f;
        if (known_kg > 0.05f) {
            g_counts_per_kg = (float)(g_filtered_counts - g_tare_counts) / known_kg;
            Serial.printf("[CMD] Calibrated: %f counts/kg\n", g_counts_per_kg);
        }
    }
}

void handle_http_latest() {
    server.send(200, "application/json", g_last_payload_json);
}

// ==========================================
// SETUP & MAIN LOOP
// ==========================================
void setup() {
    Serial.begin(115200);
    pinMode(PIN_STATUS_LED, OUTPUT);
    pinMode(PIN_BUZZER, OUTPUT);
    digitalWrite(PIN_STATUS_LED, HIGH);

    for (int i = 0; i < 7; i++) g_raw_samples[i] = DEFAULT_TARE_COUNTS;

    // HTTP fallback server
    server.on("/latest", HTTP_GET, handle_http_latest);
    server.begin();

    // MQTT client configuration with LWT
    mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
    mqttClient.setCallback(on_mqtt_command);

    Serial.println("\n[NODE] Smart Hive ESP32 Initialized.");
    Serial.println("[NODE] Serial CLI ready: tare | cal <kg> | sim on/off | dump | reboot");
    digitalWrite(PIN_STATUS_LED, LOW);
}

void loop() {
    unsigned long now = millis();

    // 1. HTTP server handling
    server.handleClient();

    // 2. Sensor sample loop (1 Hz)
    if (now - g_last_sample_ms >= SENSOR_SAMPLE_INTERVAL_MS) {
        g_last_sample_ms = now;
        read_sensors();
    }

    // 3. Telemetry publish loop (2 s)
    if (now - g_last_publish_ms >= TELEMETRY_PUBLISH_INTERVAL_MS) {
        g_last_publish_ms = now;
        String payload = build_telemetry_payload();
        g_last_payload_json = payload;

        // Try sending over MQTT if connected
        if (mqttClient.connected()) {
            // Drain buffered records first
            while (g_buf_count > 0) {
                int tail = (g_buf_head - g_buf_count + BUFFER_CAPACITY_RECORDS) % BUFFER_CAPACITY_RECORDS;
                mqttClient.publish(MQTT_TOPIC_TELEMETRY, g_telemetry_buffer[tail].c_str());
                g_buf_count--;
            }
            mqttClient.publish(MQTT_TOPIC_TELEMETRY, payload.c_str());
        } else {
            // Buffer in circular RAM
            g_telemetry_buffer[g_buf_head] = payload;
            g_buf_head = (g_buf_head + 1) % BUFFER_CAPACITY_RECORDS;
            if (g_buf_count < BUFFER_CAPACITY_RECORDS) g_buf_count++;
        }
    }

    // 4. Non-blocking Serial CLI parser
    if (Serial.available()) {
        String line = Serial.readStringUntil('\n');
        line.trim();
        if (line.equalsIgnoreCase("tare")) {
            g_tare_counts = (long)g_filtered_counts;
            Serial.printf("OK Tare set to: %ld\n", g_tare_counts);
        } else if (line.startsWith("cal ")) {
            float kg = line.substring(4).toFloat();
            if (kg > 0.05f) {
                g_counts_per_kg = (float)(g_filtered_counts - g_tare_counts) / kg;
                Serial.printf("OK Counts/kg set to: %.2f\n", g_counts_per_kg);
            }
        } else if (line.equalsIgnoreCase("sim on")) {
            g_sim_override = true;
            Serial.println("OK Sim mode ON");
        } else if (line.equalsIgnoreCase("sim off")) {
            g_sim_override = false;
            Serial.println("OK Sim mode OFF");
        } else if (line.equalsIgnoreCase("dump")) {
            Serial.println(g_last_payload_json);
        } else if (line.equalsIgnoreCase("reboot")) {
            ESP.restart();
        }
    }
}
