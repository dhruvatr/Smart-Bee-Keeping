from fastapi import APIRouter
from typing import List, Dict, Any

router = APIRouter(prefix="/api/spectrum", tags=["spectrum"])

# Global spectrum buffer populated by simulator or MQTT audio FFT
CURRENT_SPECTRUM: List[float] = []
SPECTRUM_WATERFALL: List[List[float]] = []

def update_spectrum(spectrum_frame: List[float]):
    global CURRENT_SPECTRUM, SPECTRUM_WATERFALL
    CURRENT_SPECTRUM = spectrum_frame
    SPECTRUM_WATERFALL.append(spectrum_frame)
    if len(SPECTRUM_WATERFALL) > 60:
        SPECTRUM_WATERFALL.pop(0)

@router.get("/latest")
async def get_latest_spectrum():
    return {
        "num_bins": len(CURRENT_SPECTRUM),
        "freq_resolution_hz": 1000.0 / max(1, len(CURRENT_SPECTRUM)),
        "spectrum": CURRENT_SPECTRUM
    }

@router.get("/history")
async def get_spectrum_history():
    return {
        "frames_count": len(SPECTRUM_WATERFALL),
        "frames": SPECTRUM_WATERFALL
    }
