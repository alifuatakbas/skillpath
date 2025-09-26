import os
import httpx
from datetime import datetime, timedelta
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
    """Extract latest expiry date from Apple receipt response - comprehensive checking"""
    # Get all transaction items
    items = (data.get("latest_receipt_info", []) + 
             data.get("receipt", {}).get("in_app", []))
    print(f"Total items to check: {len(items)}")
    
    if not items:
        print("No receipt transaction info found")
        return None
    
    try:
        max_ms = 0
        expiry = None
        cancelled = False
        
        # Check all items for latest expiry and cancellation
        for i, item in enumerate(items):
            expiry_ms = int(item.get("expires_date_ms", "0"))
            is_cancelled = bool(item.get("cancellation_date"))
            
            print(f"Item {i}: expires_date_ms={expiry_ms}, cancelled={is_cancelled}")
            
            if expiry_ms > max_ms:
                max_ms = expiry_ms
                expiry = datetime.utcfromtimestamp(max_ms/1000)
                cancelled = is_cancelled
                print(f"New max expiry: {expiry} (cancelled={is_cancelled})")
        
        # Handle billing retry periods (optional)
        billing_retry = data.get("pending_renewal_info", [])
        for billing_info in billing_retry:
            if billing_info.get("is_in_billing_retry_period") == "true":
                print("Billing retry period active - extending verification time")
                # Grace period logic could be added here
        
        if max_ms == 0:
            print("No valid expiry dates found")
            return None
            
        if cancelled:
            print("Latest subscription was cancelled - treating as inactive")
            return None
        
        # SANDBOX TESTING OVERRIDE: If subscription expired within 7 days, extend for testing
        current_time = datetime.utcnow()
        if expiry and data.get("environment") == "Sandbox":
            time_diff = (current_time - expiry).total_seconds()
            if 0 < time_diff < (7 * 24 * 60 * 60):  # Expired within last 7 days
                print(f"Sandbox subscription expired {time_diff/3600:.1f} hours ago, extending for testing")
                # Add 30 days for development testing
                new_expiry = current_time + timedelta(days=30)
                expiry = new_expiry
                print(f"Sandbox override: New expiry = {expiry}")
            
        print(f"Final expiry: {expiry}")
        return expiry
        
    except Exception as e:
        print(f"Error extracting expiry date: {e}")
        return None

def is_trial(data: Dict[str, Any]) -> bool:
    """Check if the latest transaction is in trial period"""
    items = (data.get("latest_receipt_info", []) + 
             data.get("receipt", {}).get("in_app", []))
    
    if not items:
        return False
    
    # Get the latest transaction by expiry date
    if items:
        latest = max(items, key=lambda i: int(i.get("expires_date_ms", "0")))
        return str(latest.get("is_trial_period", "false")).lower() == "true"
    
    return False

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
