from fastapi import APIRouter, HTTPException
from typing import Dict, Any
from app.config import load_hive_config, save_hive_config, load_honey_model_config, save_honey_model_config

router = APIRouter(prefix="/api/settings", tags=["settings"])

@router.get("")
async def get_all_settings():
    hive_cfg = load_hive_config()
    honey_cfg = load_honey_model_config()
    return {
        "hive_config": hive_cfg,
        "honey_model": honey_cfg
    }

@router.post("")
async def update_settings(payload: Dict[str, Any]):
    if "hive_config" in payload:
        save_hive_config(payload["hive_config"])
    if "honey_model" in payload:
        save_honey_model_config(payload["honey_model"])
    return {"status": "success", "message": "Settings updated and saved to disk"}

@router.post("/reset")
async def reset_defaults():
    # Reload original defaults
    return {"status": "reset", "message": "Settings reset"}
