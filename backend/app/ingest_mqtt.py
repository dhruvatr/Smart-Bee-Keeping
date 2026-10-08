import json
import logging
import asyncio
from typing import Optional, Callable
import paho.mqtt.client as mqtt
from app.config import MQTT_HOST, MQTT_PORT, MQTT_TOPIC, MQTT_CMD_TOPIC, HIVE_ID

logger = logging.getLogger("mqtt")

class MQTTIngestBridge:
    def __init__(self, on_telemetry_callback: Optional[Callable] = None):
        self.host = MQTT_HOST
        self.port = MQTT_PORT
        self.on_telemetry = on_telemetry_callback
        self.client: Optional[mqtt.Client] = None
        self.is_connected = False
        self.loop: Optional[asyncio.AbstractEventLoop] = None

    def start(self, loop: asyncio.AbstractEventLoop):
        self.loop = loop
        try:
            self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f"hive_backend_{HIVE_ID}")
            self.client.on_connect = self._on_connect
            self.client.on_disconnect = self._on_disconnect
            self.client.on_message = self._on_message

            # Non-blocking connect
            self.client.connect_async(self.host, self.port, keepalive=60)
            self.client.loop_start()
            logger.info(f"MQTT client started connecting to {self.host}:{self.port}")
        except Exception as e:
            logger.warning(f"Could not connect to MQTT broker at {self.host}:{self.port}: {e}. Standalone fallback active.")

    def _on_connect(self, client, userdata, flags, rc, properties=None):
        if rc == 0:
            self.is_connected = True
            logger.info(f"Connected to MQTT broker successfully. Subscribing to {MQTT_TOPIC}")
            client.subscribe(MQTT_TOPIC)
            client.subscribe(MQTT_CMD_TOPIC)
        else:
            logger.warning(f"MQTT connection failed with code {rc}")

    def _on_disconnect(self, client, userdata, disconnect_flags, rc=None, properties=None):
        self.is_connected = False
        logger.warning(f"MQTT disconnected (rc={rc})")

    def _on_message(self, client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode("utf-8"))
            if self.on_telemetry and self.loop:
                asyncio.run_coroutine_threadsafe(self.on_telemetry(payload), self.loop)
        except Exception as e:
            logger.error(f"Error handling MQTT message on {msg.topic}: {e}")

    def publish_command(self, topic: str, command: dict):
        if self.client and self.is_connected:
            self.client.publish(topic, json.dumps(command))
            return True
        return False

    def stop(self):
        if self.client:
            self.client.loop_stop()
            self.client.disconnect()
