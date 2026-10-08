from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class WeightPayload(BaseModel):
    gross_kg: float
    raw_counts: Optional[int] = None
    bee_scale_g: Optional[float] = None

class AudioBandsPayload(BaseModel):
    r20_100: float = 0.0
    hum150_250: float = 0.0
    act250_400: float = 0.0
    pip400_600: float = 0.0

class AudioPayload(BaseModel):
    freq_dom_hz: float
    spl_db: float
    freq_quality: float = 1.0
    bands: AudioBandsPayload

class EnvPayload(BaseModel):
    t_in_c: float
    rh_in_pct: float
    t_out_c: float
    rh_out_pct: float
    p_hpa: float = 1013.25
    battery_pct: float = 100.0

class HealthPayload(BaseModel):
    rssi_dbm: float = -60.0
    uptime_s: int = 0
    flags: List[str] = Field(default_factory=list)

class TelemetryPayload(BaseModel):
    v: int = 1
    hive_id: str
    ts: str
    seq: int = 0
    weight: WeightPayload
    audio: AudioPayload
    env: EnvPayload
    health: HealthPayload

class HarvestRequest(BaseModel):
    hive_id: str = "HIVE-01"
    honey_kg: float
    frames: int = 10
    moisture_pct_lab: Optional[float] = None
    note: str = ""

class BaselineRequest(BaseModel):
    hive_id: str = "HIVE-01"
    baseline_kg: Optional[float] = None
    note: str = ""

class RefractometerRequest(BaseModel):
    hive_id: str = "HIVE-01"
    moisture_pct: float
    operator: str = "beekeeper"
    note: str = ""

class CalibrateRequest(BaseModel):
    hive_id: str = "HIVE-01"
    kind: str  # "tare", "known_mass", "temp_comp", "audio_floor"
    known_mass_kg: Optional[float] = None
    raw_counts: Optional[int] = None
    operator: str = "beekeeper"

class InspectionRequest(BaseModel):
    hive_id: str = "HIVE-01"
    note: str
    photo_path: Optional[str] = None

class BlockchainBatchRequest(BaseModel):
    hive_id: str = "HIVE-01"
    harvest_id: Optional[int] = None
    batch_name: str
    honey_kg: float
    moisture_pct: float
    apiary_location: str = "Bengaluru Rural, Karnataka, India"
    botanical_source: str = "Multifloral Forest"
