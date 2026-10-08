#pragma once

// ==========================================
// SMART HIVE NODE - PIN DEFINITIONS & CONFIG
// ESP32 DevKit v1 Pin Map
// ==========================================

// Hive Identity
#define HIVE_ID "HIVE-01"
#define FIRMWARE_VERSION 1

// Networking & Telemetry
#define WIFI_SSID "Apiary_Field_Mesh"
#define WIFI_PASS "HoneySafe2026"
#define MQTT_BROKER "192.168.1.100"
#define MQTT_PORT 1883
#define MQTT_TOPIC_TELEMETRY "hive/" HIVE_ID "/telemetry"
#define MQTT_TOPIC_STATUS    "hive/" HIVE_ID "/status"
#define MQTT_TOPIC_CMD_CAL   "hive/" HIVE_ID "/cmd/calibrate"

// Sensors & GPIO Pinout
// 1. Primary Load Cell (HX711 50-100 kg hive scale)
#define PIN_HX711_DT   16
#define PIN_HX711_SCK  17

// 2. Secondary Bee Scale (HX711 200 g forager scale, optional)
#define ENABLE_BEE_SCALE true
#define PIN_BEE_DT     18
#define PIN_BEE_SCK    19

// 3. Dual DHT22 Sensors
#define PIN_DHT_IN     4   // In-hive brood nest
#define PIN_DHT_OUT    5   // Ambient weather
#define DHTTYPE        DHT22

// 4. Backup BME280 (I2C)
#define PIN_I2C_SDA    21
#define PIN_I2C_SCL    22
#define BME280_I2C_ADDR 0x76

// 5. INMP441 I2S MEMS Microphone (Acoustic Hive Hum)
#define PIN_I2S_BCLK   26
#define PIN_I2S_WS     25
#define PIN_I2S_SD     32
#define I2S_SAMPLE_RATE 8000
#define FFT_SAMPLES     4096

// 6. Indicators & Alerts
#define PIN_STATUS_LED 2
#define PIN_BUZZER     15

// Calibration & Default Constants
#define DEFAULT_TARE_COUNTS    812000L
#define DEFAULT_COUNTS_PER_KG  21450.0f
#define DEFAULT_K_TEMP_KG_C    0.002f    // Thermal compensation kg/°C
#define DEFAULT_AUDIO_FLOOR_DB -65.0f

// Timing & Hysteresis Constants
#define SENSOR_SAMPLE_INTERVAL_MS 1000
#define TELEMETRY_PUBLISH_INTERVAL_MS 2000
#define BUFFER_CAPACITY_RECORDS   150    // 5 minutes buffered at 2s interval
#define WDT_TIMEOUT_SECONDS       10
