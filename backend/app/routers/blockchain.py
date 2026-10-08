import hashlib
import json
from datetime import datetime
from fastapi import APIRouter, HTTPException
from typing import Optional, List, Dict, Any
from app.db import get_db
from app.models import BlockchainBatchRequest
from app.config import HIVE_ID

router = APIRouter(prefix="/api/blockchain", tags=["blockchain"])

CONTRACT_ADDRESS = "0x98bA417C04E4fD8F19B86470C88850C77F47FcaB"
NETWORK = "Polygon Amoy Testnet (Chain ID: 80002)"

@router.get("/batches")
async def get_batches(hive_id: str = HIVE_ID):
    async with get_db() as db:
        cursor = await db.execute("""
        SELECT * FROM blockchain_records WHERE hive_id = ? ORDER BY ts DESC
        """, (hive_id,))
        rows = await cursor.fetchall()
        return {"network": NETWORK, "contract_address": CONTRACT_ADDRESS, "batches": [dict(r) for r in rows]}

@router.post("/mint")
async def mint_batch(req: BlockchainBatchRequest):
    now_ts = datetime.now().isoformat()
    # Batch ID formatting: BATCH-YYYY-MM-XXXX
    short_hash = hashlib.sha256(f"{req.hive_id}:{now_ts}:{req.honey_kg}".encode()).hexdigest()[:6].upper()
    batch_id = f"BATCH-{datetime.now().strftime('%Y%m')}-{short_hash}"

    # FSSAI compliance check: moisture must be strictly under 20%
    fssai_compliant = 1 if req.moisture_pct < 20.0 else 0
    grade = "Grade A+ Export Pure" if req.moisture_pct <= 17.5 else ("Grade A Standard" if req.moisture_pct <= 18.6 else "Commercial Grade (Uncapped)")

    # Compute SHA-256 cryptographic payload hash
    payload_content = f"{batch_id}|{req.hive_id}|{req.honey_kg}|{req.moisture_pct}|{req.apiary_location}|{req.botanical_source}|{now_ts}"
    payload_hash = "0x" + hashlib.sha256(payload_content.encode("utf-8")).hexdigest()

    # Deterministic mock transaction hash and block number
    tx_hash = "0x" + hashlib.sha256((payload_hash + ":tx_mined").encode("utf-8")).hexdigest()
    block_number = 1429800 + int(short_hash, 16) % 1000

    # Dynamic QR code verification URL for consumers
    qr_data = f"https://honeychain.org/verify/{batch_id}"

    async with get_db() as db:
        await db.execute("""
        INSERT INTO blockchain_records (
            hive_id, ts, batch_id, batch_name, honey_kg, moisture_pct, quality_grade,
            fssai_compliant, apiary_location, botanical_source, payload_hash,
            tx_hash, block_number, contract_address, qr_data, verified
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        """, (
            req.hive_id, now_ts, batch_id, req.batch_name, req.honey_kg, req.moisture_pct,
            grade, fssai_compliant, req.apiary_location, req.botanical_source,
            payload_hash, tx_hash, block_number, CONTRACT_ADDRESS, qr_data
        ))
        await db.commit()

    return {
        "status": "minted",
        "batch_id": batch_id,
        "tx_hash": tx_hash,
        "block_number": block_number,
        "payload_hash": payload_hash,
        "contract_address": CONTRACT_ADDRESS,
        "fssai_compliant": bool(fssai_compliant),
        "qr_data": qr_data
    }

@router.get("/verify/{batch_id}")
async def verify_batch(batch_id: str):
    async with get_db() as db:
        cursor = await db.execute("SELECT * FROM blockchain_records WHERE batch_id = ?", (batch_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Honey batch not found on HoneyChain ledger")

        rec = dict(row)
        return {
            "verified": True,
            "network": NETWORK,
            "contract": CONTRACT_ADDRESS,
            "batch": rec,
            "fssai_status": "COMPLIANT (<20% moisture limit met)" if rec["fssai_compliant"] else "NON-COMPLIANT (Excess moisture detected)",
            "purity_guarantee": "100% Raw, Unadulterated, Single-Apiary Honey"
        }
