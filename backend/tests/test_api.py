import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.db import init_db

@pytest.mark.asyncio
async def test_api_full_endpoints():
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Health
        res = await client.get("/api/health")
        assert res.status_code == 200
        assert res.json()["status"] == "healthy"

        # 2. Live
        res = await client.get("/api/live")
        assert res.status_code == 200
        # If DB was just initialized, returns reading or error message
        assert "hive_id" in res.json() or "error" in res.json()

        # 3. Spectrum
        res = await client.get("/api/spectrum/latest")
        assert res.status_code == 200
        assert "spectrum" in res.json()

        res = await client.get("/api/spectrum/history")
        assert res.status_code == 200
        assert "frames" in res.json()

        # 4. Series
        res = await client.get("/api/series?metric=gross_kg&res=1h")
        assert res.status_code == 200
        assert "data" in res.json()

        # 5. Summary
        res = await client.get("/api/summary?range=today")
        assert res.status_code == 200
        assert "honey_collected_kg" in res.json()

        # 6. Events
        res = await client.get("/api/events?type=all")
        assert res.status_code == 200
        assert "events" in res.json()

        # 7. Baseline set
        res = await client.post("/api/baseline", json={"hive_id": "HIVE-01", "baseline_kg": 39.2, "note": "Test calibration"})
        assert res.status_code == 200
        assert res.json()["baseline_kg"] == 39.2

        # 8. Refractometer
        res = await client.post("/api/refractometer", json={"hive_id": "HIVE-01", "moisture_pct": 17.6, "operator": "tester", "note": "Atago lab refractometer"})
        assert res.status_code == 200
        assert "new_offset_pct" in res.json()

        # 9. Hardware calibrate
        res = await client.post("/api/calibrate", json={"hive_id": "HIVE-01", "kind": "tare", "raw_counts": 812100, "operator": "tester"})
        assert res.status_code == 200

        # 10. Simulator scenario & speed
        res = await client.post("/api/sim/scenario", json={"scenario": "nectar_flow"})
        assert res.status_code == 200
        assert res.json()["scenario"] == "nectar_flow"

        res = await client.post("/api/sim/speed", json={"speed": 60.0})
        assert res.status_code == 200
        assert res.json()["speed"] == 60.0

        # 11. Blockchain batch mint & verify
        mint_res = await client.post("/api/blockchain/mint", json={
            "hive_id": "HIVE-01",
            "batch_name": "Autumn Blossom Reserve",
            "honey_kg": 8.5,
            "moisture_pct": 17.2,
            "apiary_location": "Bengaluru Rural, Karnataka",
            "botanical_source": "Eucalyptus Blossom"
        })
        assert mint_res.status_code == 200
        batch_id = mint_res.json()["batch_id"]
        assert "0x" in mint_res.json()["tx_hash"]
        assert mint_res.json()["fssai_compliant"] is True

        verify_res = await client.get(f"/api/blockchain/verify/{batch_id}")
        assert verify_res.status_code == 200
        assert verify_res.json()["verified"] is True

        # 12. Settings
        settings_res = await client.get("/api/settings")
        assert settings_res.status_code == 200
        assert "hive_config" in settings_res.json()
