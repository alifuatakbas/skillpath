import os
import httpx
from datetime import datetime
from typing import Optional, Dict, Any

APPLE_VERIFY_PROD = "https://buy.itunes.apple.com/verifyReceipt"
APPLE_VERIFY_SANDBOX = "https://sandbox.itunes.apple.com/verifyReceipt"
SHARED_SECRET = os.getenv("APPLE_SHARED_SECRET")

async def validate_apple_receipt(receipt_b64: str) -> Dict[str, Any]:
    """Validate Apple receipt with production-first then sandbox fallback"""
    print(f"Receipt validation started. Length: {len(receipt_b64) if receipt_b64 else 0}")
    print(f"Receipt preview: {receipt_b64[:50] if receipt_b64 else 'None'}...")
    print(f"Shared secret exists: {bool(SHARED_SECRET)}")
    
    if not receipt_b64 or receipt_b64 == 'dummy_receipt':
        print("ERROR: Invalid receipt data")
        return {"status": 21002, "message": "Invalid receipt data"}
    
    if not SHARED_SECRET:
        print("ERROR: Missing shared secret")
        return {"status": 21002, "message": "Missing shared secret"}
    
    payload = {
        "receipt-data": receipt_b64,
        "password": SHARED_SECRET,
        "exclude-old-transactions": True,
    }
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            print("Sending request to Apple production...")
            # Try production first
            r = await client.post(APPLE_VERIFY_PROD, json=payload)
            data = r.json()
            print(f"Production response status: {data.get('status')}")
            
            # If sandbox receipt sent to production (status 21007), try sandbox
            if data.get("status") == 21007:
                print("Sandbox receipt detected, retrying with sandbox URL...")
                r = await client.post(APPLE_VERIFY_SANDBOX, json=payload)
                data = r.json()
                print(f"Sandbox response status: {data.get('status')}")
        
        return data
    except Exception as e:
        print(f"Apple receipt validation error: {e}")
        return {"status": 21002, "message": f"Network error: {str(e)}"}

def extract_latest_expiry(data: Dict[str, Any]) -> Optional[datetime]:
    """Extract latest expiry date from Apple receipt response"""
    info = data.get("latest_receipt_info") or []
    if not info:
        return None
    
    # Get the latest transaction by expiry date
    latest = max(info, key=lambda i: int(i.get("expires_date_ms", "0")))
    ms = int(latest.get("expires_date_ms", "0"))
    
    return datetime.utcfromtimestamp(ms/1000) if ms else None

def is_trial(data: Dict[str, Any]) -> bool:
    """Check if the latest transaction is in trial period"""
    info = data.get("latest_receipt_info") or []
    if not info:
        return False
    
    # Get the latest transaction by expiry date
    latest = max(info, key=lambda i: int(i.get("expires_date_ms", "0")))
    return str(latest.get("is_trial_period", "false")).lower() == "true"

def get_product_id(data: Dict[str, Any]) -> Optional[str]:
    """Get product ID from latest transaction"""
    info = data.get("latest_receipt_info") or []
    if not info:
        return None
    
    latest = max(info, key=lambda i: int(i.get("expires_date_ms", "0")))
    return latest.get("product_id")

def get_original_transaction_id(data: Dict[str, Any]) -> Optional[str]:
    """Get original transaction ID from latest transaction"""
    info = data.get("latest_receipt_info") or []
    if not info:
        return None
    
    latest = max(info, key=lambda i: int(i.get("expires_date_ms", "0")))
    return latest.get("original_transaction_id")
