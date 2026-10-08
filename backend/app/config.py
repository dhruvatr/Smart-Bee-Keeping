from pathlib import Path
import json
import os
from typing import Dict, Any

BASE_DIR = Path(__file__).resolve().parent.parent.parent
CONFIG_PATH = Path(os.getenv("CONFIG_PATH", str(BASE_DIR / "config" / "hive_config.json")))
HONEY_MODEL_PATH = Path(os.getenv("HONEY_MODEL_PATH", str(BASE_DIR / "config" / "honey_model.json")))
DB_PATH = Path(os.getenv("DB_PATH", str(BASE_DIR / "data" / "hive.db")))

HIVE_ID = os.getenv("HIVE_ID", "HIVE-01")
MQTT_HOST = os.getenv("MQTT_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
MQTT_TOPIC = os.getenv("MQTT_TOPIC", "hive/+/telemetry")
MQTT_CMD_TOPIC = os.getenv("MQTT_CMD_TOPIC", "hive/+/cmd/calibrate")

SIM_MODE = os.getenv("SIM_MODE", "true").lower() in ("true", "1", "yes")
SIM_SPEED = float(os.getenv("SIM_SPEED", 60.0))
TIMEZONE = "Asia/Kolkata"

def load_hive_config() -> Dict[str, Any]:
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

def save_hive_config(cfg: Dict[str, Any]) -> None:
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2)

def load_honey_model_config() -> Dict[str, Any]:
    if HONEY_MODEL_PATH.exists():
        with open(HONEY_MODEL_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

def save_honey_model_config(cfg: Dict[str, Any]) -> None:
    HONEY_MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(HONEY_MODEL_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2)
