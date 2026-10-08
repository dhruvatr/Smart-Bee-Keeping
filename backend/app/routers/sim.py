from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/sim", tags=["simulator"])

# The simulator instance will be injected from main.py
GLOBAL_SIMULATOR = None

def set_global_simulator(sim):
    global GLOBAL_SIMULATOR
    GLOBAL_SIMULATOR = sim

class ScenarioRequest(BaseModel):
    scenario: str

class SpeedRequest(BaseModel):
    speed: float

@router.get("/status")
async def get_sim_status():
    if not GLOBAL_SIMULATOR:
        return {"running": False, "scenario": "normal", "speed": 1.0}
    return {
        "running": GLOBAL_SIMULATOR.is_running,
        "scenario": GLOBAL_SIMULATOR.scenario,
        "speed": GLOBAL_SIMULATOR.speed,
        "sim_time": GLOBAL_SIMULATOR.sim_time.isoformat()
    }

@router.post("/start")
async def start_sim():
    if GLOBAL_SIMULATOR:
        GLOBAL_SIMULATOR.is_running = True
    return {"status": "started", "running": True}

@router.post("/stop")
async def stop_sim():
    if GLOBAL_SIMULATOR:
        GLOBAL_SIMULATOR.is_running = False
    return {"status": "stopped", "running": False}

@router.post("/scenario")
async def change_scenario(req: ScenarioRequest):
    if not GLOBAL_SIMULATOR:
        raise HTTPException(status_code=500, detail="Simulator not initialized")
    ok = GLOBAL_SIMULATOR.set_scenario(req.scenario)
    if not ok:
        raise HTTPException(status_code=400, detail="Invalid scenario")
    return {"status": "success", "scenario": req.scenario}

@router.post("/speed")
async def change_speed(req: SpeedRequest):
    if not GLOBAL_SIMULATOR:
        raise HTTPException(status_code=500, detail="Simulator not initialized")
    GLOBAL_SIMULATOR.speed = max(0.1, min(10000.0, req.speed))
    return {"status": "success", "speed": GLOBAL_SIMULATOR.speed}
