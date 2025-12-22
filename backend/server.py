from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
from jose import jwt, JWTError
import secrets
import base64
import hashlib
import requests
import re
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
# Initialized on startup (env overrides DB) to avoid random secret on each restart.
SECRET_KEY: Optional[str] = os.environ.get("JWT_SECRET")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Background tasks
_plisio_poll_task: Optional[asyncio.Task] = None
_cleanup_task: Optional[asyncio.Task] = None

# ==================== PLISIO HELPERS ====================

# As per Plisio docs: https://api.plisio.net/api/v1/...
PLISIO_API_BASE = "https://api.plisio.net/api/v1"


def _as_float(val, default: float = 0.0) -> float:
    try:
        return float(val)
    except Exception:
        return default


def _is_truthy(v) -> bool:
    return v is True or (isinstance(v, str) and v.lower() in {"1", "true", "yes", "on"})


def _normalize_plisio_status(status: Optional[str]) -> str:
    if not status:
        return "unknown"
    s = str(status).lower()
    if s in {"completed", "confirmed", "success", "paid"}:
        return "completed"
    if s in {"pending", "processing", "new", "unconfirmed", "pending internal"}:
        return "pending"
    if s in {"expired", "error", "canceled", "cancelled", "failed", "cancelled duplicate"}:
        return "failed"
    return s


async def _plisio_get_settings():
    settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0}) or {}
    enabled = bool(settings.get("plisio_enabled", False))
    api_key = settings.get("plisio_api_key") or ""
    secret_key = settings.get("plisio_secret_key") or ""
    return enabled, api_key.strip(), secret_key.strip(), settings


async def _plisio_request(path: str, params: dict) -> dict:
    """Plisio uses GET endpoints. Run in thread to avoid blocking."""
    url = f"{PLISIO_API_BASE}{path}"

    def _do():
        r = requests.get(url, params=params, timeout=20)
        r.raise_for_status()
        return r.json()

    return await asyncio.to_thread(_do)


async def plisio_create_invoice(
    *,
    api_key: str,
    amount: float,
    source_currency: str,
    crypto_currency: str,
    order_number: str,
    order_name: str,
    callback_url: Optional[str] = None,
    success_url: Optional[str] = None,
    cancel_url: Optional[str] = None,
):
    params = {
        "api_key": api_key,
        "source_amount": amount,
        "source_currency": source_currency,
        "currency": crypto_currency,
        "order_number": order_number,
        "order_name": order_name,
    }
    if callback_url:
        # Plisio recommends json=true for non-PHP
        if "json=true" not in callback_url:
            joiner = "&" if "?" in callback_url else "?"
            callback_url = f"{callback_url}{joiner}json=true"
        params["callback_url"] = callback_url
    if success_url:
        params["success_invoice_url"] = success_url
    if cancel_url:
        params["fail_invoice_url"] = cancel_url

    data = await _plisio_request("/invoices/new", params)
    if data.get("status") != "success":
        raise HTTPException(status_code=400, detail=data.get("data", {}).get("message") or "Plisio invoice creation failed")
    return data.get("data") or {}


async def plisio_get_operation(api_key: str, txn_id: str) -> Optional[dict]:
    """Fetch operation/invoice info from Plisio for a given txn_id."""
    # Plisio docs aren't exposed here; we try common filters and fall back to list search.
    for params in (
        {"api_key": api_key, "txn_id": txn_id},
        {"api_key": api_key, "search": txn_id},
        {"api_key": api_key},
    ):
        try:
            resp = await _plisio_request("/operations", params)
        except Exception:
            continue
        if resp.get("status") != "success":
            continue
        payload = resp.get("data")
        if not payload:
            continue
        # Payload may be list, dict with items, or single dict.
        if isinstance(payload, dict) and "items" in payload and isinstance(payload["items"], list):
            items = payload["items"]
        elif isinstance(payload, list):
            items = payload
        elif isinstance(payload, dict):
            items = [payload]
        else:
            items = []
        for item in items:
            if str(item.get("txn_id") or item.get("id") or "") == str(txn_id):
                return item
        # If Plisio returned a single object without txn_id match but we filtered by txn_id, return it.
        if params.get("txn_id") and items:
            return items[0]
    return None


def _extract_plisio_currency_items(payload) -> List[dict]:
    """
    Plisio currencies endpoint format can vary. Normalize to a list of dict items.
    Accepts:
    - {"status":"success","data":[...]}
    - {"status":"success","data":{"items":[...]}}
    - {"status":"success","data":{"USDT.TRC20": {...}, ...}}
    """
    if not isinstance(payload, dict):
        return []
    if payload.get("status") != "success":
        return []
    data = payload.get("data")
    if isinstance(data, list):
        return [x for x in data if isinstance(x, dict)]
    if isinstance(data, dict):
        if isinstance(data.get("items"), list):
            return [x for x in data.get("items") if isinstance(x, dict)]
        # dict keyed by currency code
        items = []
        for k, v in data.items():
            if isinstance(v, dict):
                vv = dict(v)
                vv.setdefault("currency", k)
                items.append(vv)
        return items
    return []


async def plisio_get_usdt_networks(api_key: str) -> List[dict]:
    """
    Return a list of USDT network options based on Plisio supported currencies.
    Each option: { "code": "USDT.TRC20", "label": "USDT (TRC20)" }
    """
    def _label_from_code(code: str) -> str:
        c = code.upper()
        # Plisio uses IDs like USDT (ERC-20), USDT_TRX (TRC-20), USDT_BSC (BEP-20), USDT_TON, USDT_SOL...
        if c == "USDT":
            return "USDT (ERC-20)"
        suffix = c.replace("USDT_", "", 1) if c.startswith("USDT_") else c
        mapping = {
            "TRX": "TRC-20",
            "BSC": "BEP-20",
            "TON": "TON",
            "SOL": "Solana",
            "POLYGON": "Polygon",
            "BASE": "Base",
        }
        return f"USDT ({mapping.get(suffix, suffix)})"

    options: List[dict] = []

    # Try Plisio API first (undocumented but commonly available)
    try:
        payload = await _plisio_request("/currencies", {"api_key": api_key})
        items = _extract_plisio_currency_items(payload)
        for it in items:
            code = (it.get("currency") or it.get("code") or it.get("name") or "").strip()
            if not code:
                continue
            upper = code.upper()
            if not upper.startswith("USDT"):
                continue
            options.append({"code": upper, "label": _label_from_code(upper)})
    except Exception:
        options = []

    # Fallback: scrape supported-cryptocurrencies docs (no API key needed)
    if not options:
        try:
            html = await asyncio.to_thread(
                lambda: requests.get(
                    "https://plisio.net/documentation/appendices/supported-cryptocurrencies",
                    timeout=20,
                    headers={"User-Agent": "Mozilla/5.0"},
                ).text
            )
            # The "ID" column contains values like USDT, USDT_TRX, USDT_BSC, USDT_TON, USDT_SOL...
            ids = set(re.findall(r"<td>(USDT(?:_[A-Z0-9]+)?)</td>", html))
            for code in ids:
                options.append({"code": code.upper(), "label": _label_from_code(code)})
        except Exception:
            options = []
    # Unique + stable sort
    seen = set()
    uniq = []
    for opt in options:
        if opt["code"] in seen:
            continue
        seen.add(opt["code"])
        uniq.append(opt)
    uniq.sort(key=lambda x: x["label"])
    return uniq


async def _finalize_deposit_as_completed(deposit: dict, *, provider_status: Optional[str] = None):
    """Idempotently mark a deposit as completed and credit wallet."""
    deposit_id = deposit["deposit_id"]
    user_id = deposit["user_id"]
    currency = (deposit.get("currency") or "").upper()
    amount = _as_float(deposit.get("amount"), 0.0)
    if amount <= 0:
        return

    # Only finalize if still pending_payment
    res = await db.deposits.update_one(
        {"deposit_id": deposit_id, "status": {"$in": ["pending_payment", "pending"]}},
        {"$set": {"status": "completed", "processed_at": datetime.now(timezone.utc).isoformat(), "provider_status": provider_status}},
    )
    if res.modified_count == 0:
        return

    currency_key = f"wallet_{currency.lower()}"
    await db.users.update_one({"user_id": user_id}, {"$inc": {currency_key: amount}})
    await db.transactions.insert_one({
        "transaction_id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": "deposit",
        "amount": amount,
        "currency": currency,
        "reference_id": deposit_id,
        "status": "completed",
        "description": f"Deposit via {deposit.get('method')}",
        "created_at": datetime.now(timezone.utc).isoformat()
    })


async def _plisio_poll_loop():
    """Poll Plisio for pending_payment deposits and auto-credit when paid."""
    while True:
        try:
            enabled, api_key, _secret, _settings = await _plisio_get_settings()
            if enabled and api_key:
                pending = await db.deposits.find(
                    {"status": "pending_payment", "plisio_txn_id": {"$exists": True, "$ne": None}},
                    {"_id": 0}
                ).limit(200).to_list(200)
                for dep in pending:
                    txn_id = dep.get("plisio_txn_id")
                    if not txn_id:
                        continue
                    op = await plisio_get_operation(api_key, str(txn_id))
                    if not op:
                        continue
                    st = _normalize_plisio_status(op.get("status") or op.get("invoice_status") or op.get("state"))
                    # Update provider status
                    await db.deposits.update_one(
                        {"deposit_id": dep["deposit_id"]},
                        {"$set": {"provider_status": st, "provider_raw": op, "provider_checked_at": datetime.now(timezone.utc).isoformat()}}
                    )
                    if st == "completed":
                        await _finalize_deposit_as_completed(dep, provider_status=st)
        except asyncio.CancelledError:
            return
        except Exception as e:
            logger.error("Plisio poll loop error: %s", e)
        await asyncio.sleep(60)


async def _purge_old_records(days: int = 7) -> dict:
    """Delete deposits/withdrawals older than N days (excluding pending)."""
    if days <= 0:
        days = 7
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    deposit_res = await db.deposits.delete_many({
        "created_at": {"$lt": cutoff},
        "status": {"$in": ["completed", "rejected", "failed"]}
    })
    withdrawal_res = await db.withdrawals.delete_many({
        "created_at": {"$lt": cutoff},
        "status": {"$in": ["completed", "rejected"]}
    })
    return {
        "days": days,
        "cutoff": cutoff,
        "deleted_deposits": deposit_res.deleted_count,
        "deleted_withdrawals": withdrawal_res.deleted_count
    }


async def _cleanup_loop():
    """Daily cleanup task."""
    while True:
        try:
            result = await _purge_old_records(days=7)
            if result["deleted_deposits"] or result["deleted_withdrawals"]:
                logger.info("Cleanup: %s", result)
        except asyncio.CancelledError:
            return
        except Exception as e:
            logger.error("Cleanup loop error: %s", e)
        await asyncio.sleep(24 * 3600)


def _plisio_verify_hash(payload: dict, secret_key: str) -> bool:
    """
    Verify Plisio callback payload using HMAC-SHA1 (per Plisio docs).
    For non-PHP languages Plisio recommends callback_url?json=true and Node example uses:
      hash = hmac_sha1(secret, JSON.stringify(payload_without_verify_hash))
    We'll mimic that with JSON dumps preserving key order and compact separators.
    """
    if not isinstance(payload, dict):
        return False
    verify_hash = payload.get("verify_hash")
    if not verify_hash or not secret_key:
        return False
    ordered = dict(payload)
    ordered.pop("verify_hash", None)
    # Plisio PHP example casts expire_utc to string and decodes tx_urls
    if "expire_utc" in ordered and ordered["expire_utc"] is not None:
        ordered["expire_utc"] = str(ordered["expire_utc"])
    if "tx_urls" in ordered and ordered["tx_urls"] is not None and isinstance(ordered["tx_urls"], str):
        ordered["tx_urls"] = ordered["tx_urls"].replace("&amp;", "&")
    msg = json.dumps(ordered, separators=(",", ":"), ensure_ascii=False)
    # hashlib doesn't support hmac directly; use hmac module? We'll use hashlib+key via hmac library:
    import hmac as _hmac
    digest = _hmac.new(secret_key.encode("utf-8"), msg.encode("utf-8"), hashlib.sha1).hexdigest()
    return digest == str(verify_hash)


@api_router.post("/public/plisio/callback")
async def plisio_callback(payload: dict):
    """
    Plisio invoice status callback (expects json=true so the body is JSON).
    Updates matching deposit and auto-credits when status=completed.
    """
    enabled, api_key, secret_key, _settings = await _plisio_get_settings()
    if not (enabled and api_key and secret_key):
        # Still accept to avoid retries storm, but record for troubleshooting
        return {"ok": False, "message": "Plisio not configured"}

    if not _plisio_verify_hash(payload, secret_key):
        raise HTTPException(status_code=400, detail="Invalid verify_hash")

    txn_id = str(payload.get("txn_id") or "")
    order_number = str(payload.get("order_number") or "")
    status = _normalize_plisio_status(payload.get("status"))

    # Find deposit by order_number (we used deposit_id as order_number), fallback by txn_id
    query = {"deposit_id": order_number} if order_number else {"plisio_txn_id": txn_id}
    dep = await db.deposits.find_one({**query, "provider": "plisio"}, {"_id": 0})
    if not dep:
        return {"ok": True, "message": "No matching deposit"}

    await db.deposits.update_one(
        {"deposit_id": dep["deposit_id"]},
        {"$set": {
            "provider_status": status,
            "provider_callback_at": datetime.now(timezone.utc).isoformat(),
            "provider_callback": payload,
        }}
    )

    if status == "completed":
        await _finalize_deposit_as_completed(dep, provider_status=status)
    elif status in {"failed", "expired", "cancelled", "error"}:
        # keep as pending_payment but mark failed for visibility
        await db.deposits.update_one(
            {"deposit_id": dep["deposit_id"], "status": {"$in": ["pending_payment", "pending"]}},
            {"$set": {"status": "failed"}}
        )

    return {"ok": True}

# ==================== MODELS ====================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: str
    language: str = "fr"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    user_id: str
    client_id: str
    email: str
    full_name: str
    phone: str
    language: str
    kyc_status: str
    wallet_htg: float
    wallet_usd: float
    affiliate_code: str
    affiliate_earnings: float
    is_active: bool
    is_admin: bool
    created_at: str

class PasswordReset(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str

class DepositRequest(BaseModel):
    amount: float
    currency: str
    method: str
    proof_image: Optional[str] = None
    wallet_address: Optional[str] = None
    network: Optional[str] = None

class WithdrawalRequest(BaseModel):
    amount: float
    currency: str
    method: str
    destination: str
    source_currency: Optional[str] = None  # For cross-currency withdrawal

class TransferRequest(BaseModel):
    recipient_client_id: str
    amount: float
    currency: str

class SwapRequest(BaseModel):
    from_currency: str
    to_currency: str
    amount: float

class KYCSubmit(BaseModel):
    full_name: str
    date_of_birth: str
    full_address: str
    city: Optional[str] = None
    country: Optional[str] = "Haiti"
    nationality: str
    phone_number: str
    whatsapp_number: Optional[str] = None
    id_type: str
    id_number: Optional[str] = None
    id_front_image: str
    id_back_image: Optional[str] = None
    selfie_with_id: str

class ExchangeRateUpdate(BaseModel):
    htg_to_usd: float
    usd_to_htg: float
    swap_htg_to_usd: Optional[float] = None
    swap_usd_to_htg: Optional[float] = None

class FeeConfigUpdate(BaseModel):
    method: str
    fee_type: str
    fee_value: float
    min_amount: float
    max_amount: float

class WithdrawalLimitUpdate(BaseModel):
    method: str
    min_amount: float
    max_amount: float
    waiting_hours: int

class AdminSettingsUpdate(BaseModel):
    # Email (Resend)
    resend_enabled: Optional[bool] = None
    resend_api_key: Optional[str] = None
    sender_email: Optional[str] = None

    # Live chat (Crisp)
    crisp_enabled: Optional[bool] = None
    crisp_website_id: Optional[str] = None

    # WhatsApp
    whatsapp_enabled: Optional[bool] = None
    whatsapp_number: Optional[str] = None

    # USDT (Plisio)
    plisio_enabled: Optional[bool] = None
    plisio_api_key: Optional[str] = None
    plisio_secret_key: Optional[str] = None

    # Fees & Affiliate (card-based)
    card_order_fee_htg: Optional[int] = None
    affiliate_reward_htg: Optional[int] = None
    affiliate_cards_required: Optional[int] = None

class BulkEmailRequest(BaseModel):
    subject: str
    html_content: str
    recipient_filter: str = "all"

class UserStatusUpdate(BaseModel):
    is_active: bool
    ban_reason: Optional[str] = None
    ban_until: Optional[str] = None

class BalanceAdjustment(BaseModel):
    user_id: str
    currency: str
    amount: float
    reason: str

class VirtualCardOrder(BaseModel):
    card_email: str

class TopUpOrder(BaseModel):
    country: str
    country_name: str
    minutes: int
    price: float
    phone_number: str

# ==================== HELPERS ====================

def generate_client_id():
    return f"KC{secrets.token_hex(4).upper()}"

def generate_affiliate_code():
    return secrets.token_urlsafe(8)

def generate_card_number():
    """Generate a virtual card number (Visa-like)"""
    prefix = "4532"  # Visa prefix
    remaining = ''.join([str(secrets.randbelow(10)) for _ in range(12)])
    return prefix + remaining

def generate_cvv():
    """Generate 3-digit CVV"""
    return ''.join([str(secrets.randbelow(10)) for _ in range(3)])

def generate_expiry():
    """Generate expiry date (3 years from now)"""
    future = datetime.now() + timedelta(days=365*3)
    return future.strftime("%m/%y")

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    if not SECRET_KEY:
        raise HTTPException(status_code=500, detail="JWT secret not initialized")
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not SECRET_KEY:
        raise HTTPException(status_code=500, detail="JWT secret not initialized")
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        if not user.get("is_active", True):
            raise HTTPException(status_code=403, detail="Account is suspended")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_admin_user(current_user: dict = Depends(get_current_user)):
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

async def log_action(user_id: str, action: str, details: dict):
    log_entry = {
        "log_id": str(uuid.uuid4()),
        "user_id": user_id,
        "action": action,
        "details": details,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.logs.insert_one(log_entry)

async def send_email(to_email: str, subject: str, html_content: str):
    try:
        settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
        resend_enabled = settings.get("resend_enabled", False) if settings else False
        resend_key = settings.get("resend_api_key") if settings else os.environ.get("RESEND_API_KEY")
        sender = settings.get("sender_email") if settings else os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
        
        # If admin disabled email in settings, do not send.
        if settings and not resend_enabled:
            logger.info("Resend disabled in admin settings; skipping email send.")
            return False
        
        if not resend_key:
            logger.warning("Resend API key not configured")
            return False
        
        import resend
        resend.api_key = resend_key
        
        params = {
            "from": sender,
            "to": [to_email],
            "subject": subject,
            "html": html_content
        }
        await asyncio.to_thread(resend.Emails.send, params)
        return True
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        return False

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register")
async def register(user: UserCreate):
    existing = await db.users.find_one({"email": user.email.lower()}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    client_id = generate_client_id()
    
    user_doc = {
        "user_id": user_id,
        "client_id": client_id,
        "email": user.email.lower(),
        "password_hash": hash_password(user.password),
        "full_name": user.full_name,
        "phone": user.phone,
        "language": user.language,
        "kyc_status": "pending",
        "wallet_htg": 0.0,
        "wallet_usd": 0.0,
        "affiliate_code": generate_affiliate_code(),
        "affiliate_earnings": 0.0,
        "referred_by": None,
        "is_active": True,
        "is_admin": False,
        "two_factor_enabled": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    await log_action(user_id, "register", {"email": user.email})
    
    token = create_access_token({"sub": user_id})
    
    del user_doc["password_hash"]
    if "_id" in user_doc:
        del user_doc["_id"]
    
    return {"token": token, "user": user_doc}

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email.lower()}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account is suspended")
    
    await log_action(user["user_id"], "login", {"email": credentials.email})
    
    token = create_access_token({"sub": user["user_id"]})
    
    user_response = {k: v for k, v in user.items() if k != "password_hash"}
    
    return {"token": token, "user": user_response}

@api_router.post("/auth/forgot-password")
async def forgot_password(request: PasswordReset):
    user = await db.users.find_one({"email": request.email.lower()}, {"_id": 0})
    if not user:
        return {"message": "If email exists, reset link will be sent"}
    
    reset_token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(hours=1)
    
    await db.password_resets.insert_one({
        "token": reset_token,
        "user_id": user["user_id"],
        "expires": expires.isoformat(),
        "used": False
    })
    
    reset_link = f"{os.environ.get('FRONTEND_URL', 'http://localhost:3000')}/reset-password?token={reset_token}"
    
    await send_email(
        request.email,
        "KAYICOM - Réinitialisation du mot de passe",
        f"""
        <h2>Réinitialisation de votre mot de passe</h2>
        <p>Cliquez sur le lien ci-dessous pour réinitialiser votre mot de passe:</p>
        <a href="{reset_link}">Réinitialiser le mot de passe</a>
        <p>Ce lien expire dans 1 heure.</p>
        """
    )
    
    return {"message": "If email exists, reset link will be sent"}

@api_router.post("/auth/reset-password")
async def reset_password(request: PasswordResetConfirm):
    reset_doc = await db.password_resets.find_one({"token": request.token, "used": False}, {"_id": 0})
    if not reset_doc:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    if datetime.fromisoformat(reset_doc["expires"]) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Reset token has expired")
    
    await db.users.update_one(
        {"user_id": reset_doc["user_id"]},
        {"$set": {"password_hash": hash_password(request.new_password)}}
    )
    
    await db.password_resets.update_one({"token": request.token}, {"$set": {"used": True}})
    await log_action(reset_doc["user_id"], "password_reset", {})
    
    return {"message": "Password reset successfully"}

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(**current_user)

# ==================== WALLET ROUTES ====================

@api_router.get("/wallet/balance")
async def get_balance(current_user: dict = Depends(get_current_user)):
    return {
        "wallet_htg": current_user["wallet_htg"],
        "wallet_usd": current_user["wallet_usd"]
    }

@api_router.get("/wallet/transactions")
async def get_transactions(
    currency: Optional[str] = None,
    transaction_type: Optional[str] = None,
    limit: int = Query(default=50, le=100),
    current_user: dict = Depends(get_current_user)
):
    query = {"user_id": current_user["user_id"]}
    if currency:
        query["currency"] = currency.upper()
    if transaction_type:
        query["type"] = transaction_type
    
    transactions = await db.transactions.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"transactions": transactions}

# ==================== DEPOSIT ROUTES ====================

@api_router.post("/deposits/create")
async def create_deposit(request: DepositRequest, current_user: dict = Depends(get_current_user)):
    if current_user["kyc_status"] != "approved":
        raise HTTPException(status_code=403, detail="KYC verification required for deposits")
    
    deposit_id = str(uuid.uuid4())
    deposit = {
        "deposit_id": deposit_id,
        "user_id": current_user["user_id"],
        "client_id": current_user["client_id"],
        "amount": request.amount,
        "currency": request.currency.upper(),
        "method": request.method,
        "proof_image": request.proof_image,
        "wallet_address": request.wallet_address,
        "network": request.network,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    # Automatic USDT deposits via Plisio (if enabled + configured)
    is_usdt = "usdt" in (request.method or "").lower()
    if is_usdt:
        enabled, api_key, _secret, _settings = await _plisio_get_settings()
        if enabled and api_key:
            # Frontend sends Plisio currency/network code in request.network, e.g. "USDT.TRC20", "USDT.BEP20", ...
            crypto_currency = (request.network or "USDT").upper().strip()
            if not crypto_currency.startswith("USDT"):
                crypto_currency = "USDT"

            # Prefer explicit config; otherwise infer from BACKEND_PUBLIC_URL/BACKEND_URL
            callback_url = os.environ.get("PLISIO_CALLBACK_URL") or os.environ.get("BACKEND_PUBLIC_URL") or os.environ.get("PUBLIC_BACKEND_URL") or os.environ.get("BACKEND_URL")
            if callback_url and callback_url.endswith("/api"):
                callback_url = callback_url[:-4]
            if callback_url and not callback_url.endswith("/api/public/plisio/callback"):
                callback_url = callback_url.rstrip("/") + "/api/public/plisio/callback"
            success_url = os.environ.get("PLISIO_SUCCESS_URL") or os.environ.get("FRONTEND_URL")
            cancel_url = os.environ.get("PLISIO_CANCEL_URL") or os.environ.get("FRONTEND_URL")

            try:
                invoice = await plisio_create_invoice(
                    api_key=api_key,
                    amount=float(request.amount),
                    source_currency=request.currency.upper(),
                    crypto_currency=crypto_currency,
                    order_number=deposit_id,
                    order_name=f"KAYICOM Deposit {deposit_id}",
                    callback_url=callback_url,
                    success_url=success_url,
                    cancel_url=cancel_url,
                )
                deposit.update({
                    "status": "pending_payment",
                    "provider": "plisio",
                    "plisio_txn_id": invoice.get("txn_id") or invoice.get("id"),
                    "plisio_invoice_url": invoice.get("invoice_url") or invoice.get("invoice"),
                    "plisio_wallet_hash": invoice.get("wallet_hash") or invoice.get("wallet"),
                    "plisio_currency": crypto_currency,
                    "provider_raw": invoice,
                    "provider_checked_at": datetime.now(timezone.utc).isoformat()
                })
            except HTTPException as e:
                # Do not silently fall back for USDT when Plisio is enabled — user expects automatic flow.
                raise e
        else:
            raise HTTPException(status_code=400, detail="Plisio is not enabled/configured for USDT deposits")
    
    await db.deposits.insert_one(deposit)
    await log_action(current_user["user_id"], "deposit_request", {"amount": request.amount, "method": request.method})
    
    if "_id" in deposit:
        del deposit["_id"]
    return {"deposit": deposit}


@api_router.get("/deposits/{deposit_id}")
async def get_deposit(deposit_id: str, current_user: dict = Depends(get_current_user)):
    dep = await db.deposits.find_one({"deposit_id": deposit_id, "user_id": current_user["user_id"]}, {"_id": 0})
    if not dep:
        raise HTTPException(status_code=404, detail="Deposit not found")
    return {"deposit": dep}


@api_router.post("/deposits/{deposit_id}/sync")
async def sync_deposit(deposit_id: str, current_user: dict = Depends(get_current_user)):
    """Manually sync a Plisio deposit status (optional; background poll also runs)."""
    dep = await db.deposits.find_one({"deposit_id": deposit_id, "user_id": current_user["user_id"]}, {"_id": 0})
    if not dep:
        raise HTTPException(status_code=404, detail="Deposit not found")
    if dep.get("provider") != "plisio" or not dep.get("plisio_txn_id"):
        return {"deposit": dep, "message": "No Plisio sync needed"}

    enabled, api_key, _secret, _settings = await _plisio_get_settings()
    if not (enabled and api_key):
        raise HTTPException(status_code=400, detail="Plisio not enabled/configured")

    op = await plisio_get_operation(api_key, str(dep["plisio_txn_id"]))
    if op:
        st = _normalize_plisio_status(op.get("status") or op.get("invoice_status") or op.get("state"))
        await db.deposits.update_one(
            {"deposit_id": dep["deposit_id"]},
            {"$set": {"provider_status": st, "provider_raw": op, "provider_checked_at": datetime.now(timezone.utc).isoformat()}}
        )
        if st == "completed":
            await _finalize_deposit_as_completed(dep, provider_status=st)

    dep2 = await db.deposits.find_one({"deposit_id": dep["deposit_id"]}, {"_id": 0})
    return {"deposit": dep2, "message": "Synced"}


@api_router.get("/deposits/usdt-options")
async def get_usdt_deposit_options(current_user: dict = Depends(get_current_user)):
    """Return available USDT networks from Plisio (without exposing secrets)."""
    enabled, api_key, _secret, settings = await _plisio_get_settings()
    # Serve cached options if recent (6h)
    cache = settings.get("plisio_usdt_networks_cache") if isinstance(settings, dict) else None
    cache_ts = settings.get("plisio_usdt_networks_cache_at") if isinstance(settings, dict) else None
    cache_fresh = False
    if cache and cache_ts:
        try:
            age = datetime.now(timezone.utc) - datetime.fromisoformat(cache_ts)
            cache_fresh = age.total_seconds() < 6 * 3600
        except Exception:
            cache_fresh = False

    if enabled and api_key:
        if cache_fresh:
            return {"enabled": True, "networks": cache}
        networks = await plisio_get_usdt_networks(api_key)
        await db.settings.update_one(
            {"setting_id": "main"},
            {"$set": {
                "plisio_usdt_networks_cache": networks,
                "plisio_usdt_networks_cache_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
        return {"enabled": True, "networks": networks}

    # Not enabled/configured
    return {"enabled": False, "networks": []}

@api_router.get("/deposits")
async def get_deposits(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"user_id": current_user["user_id"]}
    if status:
        query["status"] = status
    
    deposits = await db.deposits.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"deposits": deposits}

# ==================== WITHDRAWAL ROUTES ====================

@api_router.post("/withdrawals/create")
async def create_withdrawal(request: WithdrawalRequest, current_user: dict = Depends(get_current_user)):
    if current_user["kyc_status"] != "approved":
        raise HTTPException(status_code=403, detail="KYC verification required for withdrawals")
    
    # Determine source and target currencies
    target_currency = request.currency.upper()
    source_currency = (request.source_currency or request.currency).upper()
    
    # Get exchange rates for cross-currency withdrawal
    rates = await db.exchange_rates.find_one({"rate_id": "main"}, {"_id": 0})
    if not rates:
        rates = {"htg_to_usd": 0.0075, "usd_to_htg": 133.0}
    
    # Calculate amount to deduct from source wallet
    if source_currency == target_currency:
        amount_to_deduct = request.amount
    elif source_currency == "USD" and target_currency == "HTG":
        # User wants HTG but will pay from USD wallet
        amount_to_deduct = request.amount * rates["htg_to_usd"]
    else:  # source_currency == "HTG" and target_currency == "USD"
        # User wants USD but will pay from HTG wallet
        amount_to_deduct = request.amount * rates["usd_to_htg"]
    
    source_key = f"wallet_{source_currency.lower()}"
    if current_user.get(source_key, 0) < amount_to_deduct:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    # Check withdrawal limits
    limits = await db.withdrawal_limits.find_one({"method": request.method}, {"_id": 0})
    if limits:
        if request.amount < limits.get("min_amount", 0):
            raise HTTPException(status_code=400, detail=f"Minimum withdrawal is {limits['min_amount']}")
        if request.amount > limits.get("max_amount", float('inf')):
            raise HTTPException(status_code=400, detail=f"Maximum withdrawal is {limits['max_amount']}")
    
    # Calculate fees
    fee = 0

    # Card withdrawal uses dedicated tiered fees (USD)
    if request.method == "card":
        card_fee = await db.card_fees.find_one({
            "min_amount": {"$lte": request.amount},
            "max_amount": {"$gte": request.amount}
        }, {"_id": 0})
        if card_fee:
            if card_fee.get("fee_type") == "percentage":
                fee = request.amount * (card_fee["fee"] / 100)
            else:
                fee = card_fee["fee"]
    else:
        fee_config = await db.fees.find_one({
            "method": request.method,
            "min_amount": {"$lte": request.amount},
            "max_amount": {"$gte": request.amount}
        }, {"_id": 0})
        
        if fee_config:
            if fee_config.get("fee_type") == "percentage":
                fee = request.amount * (fee_config["fee_value"] / 100)
            else:
                fee = fee_config["fee_value"]
    
    withdrawal_id = str(uuid.uuid4())
    withdrawal = {
        "withdrawal_id": withdrawal_id,
        "user_id": current_user["user_id"],
        "client_id": current_user["client_id"],
        "amount": request.amount,
        "fee": fee,
        "net_amount": request.amount - fee,
        "currency": target_currency,
        "source_currency": source_currency,
        "amount_deducted": amount_to_deduct,
        "exchange_rate_used": rates["usd_to_htg"] if source_currency != target_currency else 1,
        "method": request.method,
        "destination": request.destination,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Deduct from source wallet
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$inc": {source_key: -amount_to_deduct}}
    )
    
    await db.withdrawals.insert_one(withdrawal)
    
    # Create transaction record
    description = f"Withdrawal via {request.method}"
    if source_currency != target_currency:
        description += f" (converted from {source_currency})"
    
    await db.transactions.insert_one({
        "transaction_id": str(uuid.uuid4()),
        "user_id": current_user["user_id"],
        "type": "withdrawal",
        "amount": -amount_to_deduct,
        "currency": source_currency,
        "target_amount": request.amount,
        "target_currency": target_currency,
        "reference_id": withdrawal_id,
        "status": "pending",
        "description": description,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    await log_action(current_user["user_id"], "withdrawal_request", {
        "amount": request.amount, 
        "method": request.method,
        "source_currency": source_currency,
        "target_currency": target_currency
    })
    
    if "_id" in withdrawal:
        del withdrawal["_id"]
    return {"withdrawal": withdrawal}

@api_router.get("/withdrawals")
async def get_withdrawals(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"user_id": current_user["user_id"]}
    if status:
        query["status"] = status
    
    withdrawals = await db.withdrawals.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"withdrawals": withdrawals}

@api_router.get("/withdrawals/fees")
async def get_withdrawal_fees():
    fees = await db.fees.find({}, {"_id": 0}).to_list(200)
    # Merge card tiered fees into same shape used by frontend
    card_fees = await db.card_fees.find({}, {"_id": 0}).to_list(500)
    for cf in card_fees:
        fees.append({
            "method": "card",
            "fee_type": cf.get("fee_type", "flat"),
            "fee_value": cf.get("fee", 0),
            "min_amount": cf.get("min_amount", 0),
            "max_amount": cf.get("max_amount", 0),
        })
    limits = await db.withdrawal_limits.find({}, {"_id": 0}).to_list(200)
    return {"fees": fees, "limits": limits}

# ==================== SWAP ROUTES ====================

@api_router.post("/wallet/swap")
async def swap_currency(request: SwapRequest, current_user: dict = Depends(get_current_user)):
    """Swap currency between HTG and USD with separate swap rates"""
    
    from_currency = request.from_currency.upper()
    to_currency = request.to_currency.upper()
    
    if from_currency not in ['HTG', 'USD'] or to_currency not in ['HTG', 'USD']:
        raise HTTPException(status_code=400, detail="Invalid currency")
    
    if from_currency == to_currency:
        raise HTTPException(status_code=400, detail="Cannot swap same currency")
    
    # Check balance
    from_key = f"wallet_{from_currency.lower()}"
    to_key = f"wallet_{to_currency.lower()}"
    
    if current_user.get(from_key, 0) < request.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    # Get exchange rates (with separate swap rates)
    rates = await db.exchange_rates.find_one({"rate_id": "main"}, {"_id": 0})
    if not rates:
        rates = {
            "htg_to_usd": 0.0075, 
            "usd_to_htg": 133.0,
            "swap_htg_to_usd": 0.0074,  # Slightly worse for user
            "swap_usd_to_htg": 132.0    # Slightly worse for user
        }
    
    # Use swap-specific rates if available, otherwise fall back to general rates
    if from_currency == "HTG":
        rate_used = rates.get("swap_htg_to_usd", rates.get("htg_to_usd", 0.0075))
        converted_amount = request.amount * rate_used
    else:
        rate_used = rates.get("swap_usd_to_htg", rates.get("usd_to_htg", 133.0))
        converted_amount = request.amount * rate_used
    
    swap_id = str(uuid.uuid4())
    
    # Update user balances
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {
            "$inc": {
                from_key: -request.amount,
                to_key: converted_amount
            }
        }
    )
    
    # Create transaction records
    await db.transactions.insert_many([
        {
            "transaction_id": str(uuid.uuid4()),
            "user_id": current_user["user_id"],
            "type": "swap_out",
            "amount": -request.amount,
            "currency": from_currency,
            "reference_id": swap_id,
            "status": "completed",
            "description": f"Swap {from_currency} to {to_currency}",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "transaction_id": str(uuid.uuid4()),
            "user_id": current_user["user_id"],
            "type": "swap_in",
            "amount": converted_amount,
            "currency": to_currency,
            "reference_id": swap_id,
            "status": "completed",
            "description": f"Swap from {from_currency} to {to_currency}",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ])
    
    await log_action(current_user["user_id"], "swap", {
        "from_currency": from_currency,
        "to_currency": to_currency,
        "amount": request.amount,
        "converted_amount": converted_amount,
        "rate_used": rate_used
    })
    
    return {
        "swap_id": swap_id,
        "from_amount": request.amount,
        "from_currency": from_currency,
        "to_amount": converted_amount,
        "to_currency": to_currency,
        "rate_used": rate_used
    }

# ==================== TRANSFER ROUTES ====================

@api_router.post("/transfers/send")
async def send_transfer(request: TransferRequest, current_user: dict = Depends(get_current_user)):
    if current_user["kyc_status"] != "approved":
        raise HTTPException(status_code=403, detail="KYC verification required for transfers")
    
    if request.recipient_client_id == current_user["client_id"]:
        raise HTTPException(status_code=400, detail="Cannot transfer to yourself")
    
    recipient = await db.users.find_one({"client_id": request.recipient_client_id}, {"_id": 0})
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")
    
    currency_key = f"wallet_{request.currency.lower()}"
    
    # Get transfer fee config
    fee = 0
    fee_config = await db.fees.find_one({"method": "internal_transfer"}, {"_id": 0})
    if fee_config:
        if fee_config.get("fee_type") == "percentage":
            fee = request.amount * (fee_config["fee_value"] / 100)
        else:
            fee = fee_config["fee_value"]

    # Validate balance INCLUDING fee (prevents negative wallet)
    total_to_deduct = request.amount + fee
    if current_user.get(currency_key, 0) < total_to_deduct:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    transfer_id = str(uuid.uuid4())
    
    # Deduct from sender
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$inc": {currency_key: -total_to_deduct}}
    )
    
    # Add to recipient
    await db.users.update_one(
        {"user_id": recipient["user_id"]},
        {"$inc": {currency_key: request.amount}}
    )
    
    # Create transactions
    await db.transactions.insert_one({
        "transaction_id": str(uuid.uuid4()),
        "user_id": current_user["user_id"],
        "type": "transfer_out",
        "amount": -total_to_deduct,
        "fee": fee,
        "currency": request.currency.upper(),
        "reference_id": transfer_id,
        "recipient_client_id": request.recipient_client_id,
        "status": "completed",
        "description": f"Transfer to {request.recipient_client_id}",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    await db.transactions.insert_one({
        "transaction_id": str(uuid.uuid4()),
        "user_id": recipient["user_id"],
        "type": "transfer_in",
        "amount": request.amount,
        "currency": request.currency.upper(),
        "reference_id": transfer_id,
        "sender_client_id": current_user["client_id"],
        "status": "completed",
        "description": f"Transfer from {current_user['client_id']}",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    await log_action(current_user["user_id"], "transfer", {
        "amount": request.amount,
        "recipient": request.recipient_client_id
    })
    
    return {
        "transfer_id": transfer_id,
        "amount": request.amount,
        "fee": fee,
        "recipient": request.recipient_client_id,
        "status": "completed"
    }

# ==================== KYC ROUTES ====================

@api_router.post("/kyc/submit")
async def submit_kyc(request: KYCSubmit, current_user: dict = Depends(get_current_user)):
    existing = await db.kyc.find_one({"user_id": current_user["user_id"]}, {"_id": 0})
    if existing and existing.get("status") == "approved":
        raise HTTPException(status_code=400, detail="KYC already approved")
    
    kyc_doc = {
        "kyc_id": str(uuid.uuid4()),
        "user_id": current_user["user_id"],
        "client_id": current_user["client_id"],
        "full_name": request.full_name,
        "date_of_birth": request.date_of_birth,
        "full_address": request.full_address,
        "city": request.city,
        "country": request.country,
        "nationality": request.nationality,
        "phone_number": request.phone_number,
        "whatsapp_number": request.whatsapp_number,
        "id_type": request.id_type,
        "id_number": request.id_number,
        "id_front_image": request.id_front_image,
        "id_back_image": request.id_back_image,
        "selfie_with_id": request.selfie_with_id,
        "status": "pending",
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "reviewed_at": None,
        "reviewed_by": None,
        "rejection_reason": None
    }
    
    if existing:
        await db.kyc.update_one(
            {"user_id": current_user["user_id"]},
            {"$set": kyc_doc}
        )
    else:
        await db.kyc.insert_one(kyc_doc)
    
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$set": {"kyc_status": "pending"}}
    )
    
    await log_action(current_user["user_id"], "kyc_submit", {})
    
    if "_id" in kyc_doc:
        del kyc_doc["_id"]
    return {"kyc": kyc_doc}

@api_router.get("/kyc/status")
async def get_kyc_status(current_user: dict = Depends(get_current_user)):
    kyc = await db.kyc.find_one({"user_id": current_user["user_id"]}, {"_id": 0})
    return {"kyc": kyc, "status": current_user["kyc_status"]}

# ==================== AFFILIATE ROUTES ====================

@api_router.get("/affiliate/info")
async def get_affiliate_info(current_user: dict = Depends(get_current_user)):
    settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0}) or {}
    reward_htg = int(settings.get("affiliate_reward_htg", 2000))
    cards_required = int(settings.get("affiliate_cards_required", 5))
    if cards_required <= 0:
        cards_required = 5

    # Get all referrals
    referrals = await db.users.find(
        {"referred_by": current_user["affiliate_code"]},
        {"_id": 0, "user_id": 1, "client_id": 1, "full_name": 1, "created_at": 1}
    ).to_list(100)
    
    # Check which referrals have approved card orders
    referrals_with_cards = 0
    enriched_referrals = []
    
    for ref in referrals:
        has_approved_card = await db.virtual_card_orders.find_one({
            "user_id": ref["user_id"],
            "status": "approved"
        }) is not None
        if has_approved_card:
            referrals_with_cards += 1
        enriched_referrals.append({
            "client_id": ref["client_id"],
            "full_name": ref["full_name"],
            "created_at": ref["created_at"],
            "has_card": has_approved_card
        })
    
    return {
        "affiliate_code": current_user["affiliate_code"],
        "affiliate_link": f"{os.environ.get('FRONTEND_URL', 'http://localhost:3000')}/register?ref={current_user['affiliate_code']}",
        "earnings": current_user.get("affiliate_earnings", 0),
        "referrals": enriched_referrals,
        "referrals_with_cards": referrals_with_cards,
        "affiliate_reward_htg": reward_htg,
        "affiliate_cards_required": cards_required
    }

@api_router.post("/affiliate/apply-code")
async def apply_affiliate_code(code: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("referred_by"):
        raise HTTPException(status_code=400, detail="Already have a referrer")
    
    referrer = await db.users.find_one({"affiliate_code": code}, {"_id": 0})
    if not referrer:
        raise HTTPException(status_code=404, detail="Invalid affiliate code")
    
    if referrer["user_id"] == current_user["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot refer yourself")
    
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$set": {"referred_by": code}}
    )
    
    return {"message": "Affiliate code applied successfully"}

@api_router.post("/affiliate/withdraw")
async def withdraw_affiliate_earnings(current_user: dict = Depends(get_current_user)):
    earnings = current_user.get("affiliate_earnings", 0)
    
    if earnings < 2000:
        raise HTTPException(status_code=400, detail="Minimum withdrawal is 2,000 HTG")
    
    # Transfer earnings to wallet
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {
            "$inc": {"wallet_htg": earnings},
            "$set": {"affiliate_earnings": 0}
        }
    )
    
    # Create transaction
    await db.transactions.insert_one({
        "transaction_id": str(uuid.uuid4()),
        "user_id": current_user["user_id"],
        "type": "affiliate_withdrawal",
        "amount": earnings,
        "currency": "HTG",
        "status": "completed",
        "description": "Affiliate earnings withdrawal to wallet",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    await log_action(current_user["user_id"], "affiliate_withdrawal", {"amount": earnings})
    
    return {"message": "Earnings transferred to wallet", "amount": earnings}

# ==================== VIRTUAL CARD ROUTES (Manual Third-Party System) ====================

CARD_FEE_HTG = 500  # Card order fee in HTG
CARD_BONUS_USD = 5  # $5 USD bonus for approved cards

@api_router.get("/virtual-cards")
async def get_virtual_cards(current_user: dict = Depends(get_current_user)):
    cards = await db.virtual_cards.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0}
    ).to_list(10)
    return {"cards": cards}

@api_router.get("/virtual-cards/orders")
async def get_card_orders(current_user: dict = Depends(get_current_user)):
    """Get user's virtual card orders"""
    orders = await db.virtual_card_orders.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return {"orders": orders}

@api_router.get("/virtual-cards/deposits")
async def get_card_deposits(current_user: dict = Depends(get_current_user)):
    """Get user's card deposit history (deposits made to their virtual card)"""
    deposits = await db.virtual_card_deposits.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return {"deposits": deposits}

@api_router.post("/virtual-cards/order")
async def order_virtual_card(request: VirtualCardOrder, current_user: dict = Depends(get_current_user)):
    """Submit a manual card order request"""
    if current_user["kyc_status"] != "approved":
        raise HTTPException(status_code=403, detail="KYC verification required")
    
    settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0}) or {}
    card_fee_htg = int(settings.get("card_order_fee_htg", CARD_FEE_HTG))
    if card_fee_htg < 0:
        card_fee_htg = CARD_FEE_HTG

    if current_user.get("wallet_htg", 0) < card_fee_htg:
        raise HTTPException(status_code=400, detail=f"Insufficient balance. Card fee is {card_fee_htg} HTG")
    
    # Deduct fee
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$inc": {"wallet_htg": -card_fee_htg}}
    )
    
    # Create card order (manual process - admin will approve/reject)
    order = {
        "order_id": str(uuid.uuid4()),
        "user_id": current_user["user_id"],
        "client_id": current_user["client_id"],
        "card_email": request.card_email.lower(),
        "fee": card_fee_htg,
        "status": "pending",  # pending, approved, rejected
        "admin_notes": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "processed_at": None,
        "processed_by": None
    }
    
    await db.virtual_card_orders.insert_one(order)
    
    # Create transaction for the fee
    await db.transactions.insert_one({
        "transaction_id": str(uuid.uuid4()),
        "user_id": current_user["user_id"],
        "type": "card_order",
        "amount": -card_fee_htg,
        "currency": "HTG",
        "status": "completed",
        "description": "Virtual card order fee",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    await log_action(current_user["user_id"], "card_order", {"order_id": order["order_id"]})
    
    if "_id" in order:
        del order["_id"]
    return {"order": order, "message": "Card order submitted successfully"}

# Admin: Get all card orders
@api_router.get("/admin/virtual-card-orders")
async def admin_get_card_orders(
    status: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    admin: dict = Depends(get_admin_user)
):
    query = {}
    if status:
        query["status"] = status
    
    orders = await db.virtual_card_orders.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"orders": orders}

# Admin: Process card order (approve/reject)
@api_router.patch("/admin/virtual-card-orders/{order_id}")
async def admin_process_card_order(
    order_id: str,
    action: str,
    admin_notes: Optional[str] = None,
    admin: dict = Depends(get_admin_user)
):
    order = await db.virtual_card_orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order["status"] != "pending":
        raise HTTPException(status_code=400, detail="Order already processed")
    
    if action not in ["approve", "reject"]:
        raise HTTPException(status_code=400, detail="Invalid action")
    
    new_status = "approved" if action == "approve" else "rejected"
    
    await db.virtual_card_orders.update_one(
        {"order_id": order_id},
        {"$set": {
            "status": new_status,
            "admin_notes": admin_notes,
            "processed_at": datetime.now(timezone.utc).isoformat(),
            "processed_by": admin["user_id"]
        }}
    )
    
    if action == "approve":
        # Add $5 USD bonus to user's wallet
        await db.users.update_one(
            {"user_id": order["user_id"]},
            {"$inc": {"wallet_usd": CARD_BONUS_USD}}
        )
        
        # Create bonus transaction
        await db.transactions.insert_one({
            "transaction_id": str(uuid.uuid4()),
            "user_id": order["user_id"],
            "type": "card_bonus",
            "amount": CARD_BONUS_USD,
            "currency": "USD",
            "status": "completed",
            "description": "Virtual card approval bonus",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Process affiliate reward if user was referred
        user = await db.users.find_one({"user_id": order["user_id"]}, {"_id": 0})
        if user and user.get("referred_by"):
            await process_card_affiliate_reward(user["referred_by"])
    else:
        # Refund the fee if rejected
        refund_fee = order.get("fee", CARD_FEE_HTG)
        await db.users.update_one(
            {"user_id": order["user_id"]},
            {"$inc": {"wallet_htg": refund_fee}}
        )
        
        await db.transactions.insert_one({
            "transaction_id": str(uuid.uuid4()),
            "user_id": order["user_id"],
            "type": "card_order_refund",
            "amount": refund_fee,
            "currency": "HTG",
            "status": "completed",
            "description": "Virtual card order refund (rejected)",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    await log_action(admin["user_id"], "card_order_process", {"order_id": order_id, "action": action})
    
    return {"message": f"Card order {action}d successfully"}

async def process_card_affiliate_reward(affiliate_code: str):
    """Process affiliate reward: configurable HTG reward per N approved card orders."""
    referrer = await db.users.find_one({"affiliate_code": affiliate_code}, {"_id": 0})
    if not referrer:
        return

    settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0}) or {}
    reward_htg = int(settings.get("affiliate_reward_htg", 2000))
    cards_required = int(settings.get("affiliate_cards_required", 5))
    if cards_required <= 0:
        cards_required = 5
    
    # Count referrals with approved card orders
    referrals = await db.users.find(
        {"referred_by": affiliate_code},
        {"_id": 0, "user_id": 1}
    ).to_list(1000)
    
    cards_count = 0
    for ref in referrals:
        has_approved_card = await db.virtual_card_orders.find_one({
            "user_id": ref["user_id"],
            "status": "approved"
        })
        if has_approved_card:
            cards_count += 1
    
    # Check if we've hit a new milestone of N
    rewarded_count = referrer.get("affiliate_cards_rewarded", 0)
    new_rewards = (cards_count // cards_required) - rewarded_count
    
    if new_rewards > 0:
        reward_amount = new_rewards * reward_htg
        
        await db.users.update_one(
            {"user_id": referrer["user_id"]},
            {
                "$inc": {"affiliate_earnings": reward_amount},
                "$set": {"affiliate_cards_rewarded": cards_count // cards_required}
            }
        )
        
        # Create transaction record
        await db.transactions.insert_one({
            "transaction_id": str(uuid.uuid4()),
            "user_id": referrer["user_id"],
            "type": "affiliate_card_reward",
            "amount": reward_amount,
            "currency": "HTG",
            "status": "completed",
            "description": f"Affiliate reward for {new_rewards * cards_required} approved card orders",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        await log_action(referrer["user_id"], "affiliate_card_reward", {"amount": reward_amount})

# ==================== TOP-UP (International Minutes) ROUTES ====================

@api_router.post("/topup/order")
async def create_topup_order(request: TopUpOrder, current_user: dict = Depends(get_current_user)):
    """Create a manual top-up order for international minutes"""
    if current_user["kyc_status"] != "approved":
        raise HTTPException(status_code=403, detail="KYC verification required")
    
    if current_user.get("wallet_usd", 0) < request.price:
        raise HTTPException(status_code=400, detail="Insufficient USD balance")
    
    # Deduct from wallet
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$inc": {"wallet_usd": -request.price}}
    )
    
    # Create order
    order = {
        "order_id": str(uuid.uuid4()),
        "user_id": current_user["user_id"],
        "client_id": current_user["client_id"],
        "country": request.country,
        "country_name": request.country_name,
        "minutes": request.minutes,
        "price": request.price,
        "phone_number": request.phone_number,
        "status": "pending",  # pending, completed, cancelled
        "admin_notes": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "processed_at": None,
        "processed_by": None
    }
    
    await db.topup_orders.insert_one(order)
    
    # Create transaction
    await db.transactions.insert_one({
        "transaction_id": str(uuid.uuid4()),
        "user_id": current_user["user_id"],
        "type": "topup_order",
        "amount": -request.price,
        "currency": "USD",
        "status": "pending",
        "description": f"Top-up order: {request.minutes} mins for {request.country_name}",
        "reference_id": order["order_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    await log_action(current_user["user_id"], "topup_order", {"order_id": order["order_id"]})
    
    if "_id" in order:
        del order["_id"]
    return {"order": order, "message": "Top-up order submitted successfully"}

@api_router.get("/topup/orders")
async def get_topup_orders(current_user: dict = Depends(get_current_user)):
    """Get user's top-up orders"""
    orders = await db.topup_orders.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return {"orders": orders}

# Admin: Get all top-up orders
@api_router.get("/admin/topup-orders")
async def admin_get_topup_orders(
    status: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    admin: dict = Depends(get_admin_user)
):
    query = {}
    if status:
        query["status"] = status
    
    orders = await db.topup_orders.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"orders": orders}

# Admin: Process top-up order
@api_router.patch("/admin/topup-orders/{order_id}")
async def admin_process_topup_order(
    order_id: str,
    action: str,
    admin_notes: Optional[str] = None,
    admin: dict = Depends(get_admin_user)
):
    order = await db.topup_orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order["status"] != "pending":
        raise HTTPException(status_code=400, detail="Order already processed")
    
    if action not in ["complete", "cancel"]:
        raise HTTPException(status_code=400, detail="Invalid action. Use 'complete' or 'cancel'")
    
    new_status = "completed" if action == "complete" else "cancelled"
    
    await db.topup_orders.update_one(
        {"order_id": order_id},
        {"$set": {
            "status": new_status,
            "admin_notes": admin_notes,
            "processed_at": datetime.now(timezone.utc).isoformat(),
            "processed_by": admin["user_id"]
        }}
    )
    
    # Update transaction status
    await db.transactions.update_one(
        {"reference_id": order_id, "type": "topup_order"},
        {"$set": {"status": new_status}}
    )
    
    if action == "cancel":
        # Refund the amount
        await db.users.update_one(
            {"user_id": order["user_id"]},
            {"$inc": {"wallet_usd": order["price"]}}
        )
        
        await db.transactions.insert_one({
            "transaction_id": str(uuid.uuid4()),
            "user_id": order["user_id"],
            "type": "topup_refund",
            "amount": order["price"],
            "currency": "USD",
            "status": "completed",
            "description": f"Top-up order refund (cancelled)",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    await log_action(admin["user_id"], "topup_order_process", {"order_id": order_id, "action": action})
    
    return {"message": f"Top-up order {action}d successfully"}

# ==================== EXCHANGE RATES ====================

@api_router.get("/exchange-rates")
async def get_exchange_rates():
    rates = await db.exchange_rates.find_one({"rate_id": "main"}, {"_id": 0})
    if not rates:
        rates = {
            "htg_to_usd": 0.0075, 
            "usd_to_htg": 133.0,
            "swap_htg_to_usd": 0.0074,
            "swap_usd_to_htg": 132.0
        }
    return rates

# ==================== ADMIN ROUTES ====================

@api_router.get("/admin/dashboard")
async def admin_dashboard(admin: dict = Depends(get_admin_user)):
    total_users = await db.users.count_documents({})
    pending_kyc = await db.kyc.count_documents({"status": "pending"})
    pending_deposits = await db.deposits.count_documents({"status": "pending"})
    pending_withdrawals = await db.withdrawals.count_documents({"status": "pending"})
    
    # Calculate total balances
    pipeline = [
        {"$group": {
            "_id": None,
            "total_htg": {"$sum": "$wallet_htg"},
            "total_usd": {"$sum": "$wallet_usd"}
        }}
    ]
    totals = await db.users.aggregate(pipeline).to_list(1)
    total_balances = totals[0] if totals else {"total_htg": 0, "total_usd": 0}
    
    return {
        "total_users": total_users,
        "pending_kyc": pending_kyc,
        "pending_deposits": pending_deposits,
        "pending_withdrawals": pending_withdrawals,
        "total_htg": total_balances.get("total_htg", 0),
        "total_usd": total_balances.get("total_usd", 0)
    }

@api_router.get("/admin/users")
async def admin_get_users(
    search: Optional[str] = None,
    kyc_status: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    skip: int = 0,
    admin: dict = Depends(get_admin_user)
):
    query = {}
    if search:
        query["$or"] = [
            {"email": {"$regex": search, "$options": "i"}},
            {"client_id": {"$regex": search, "$options": "i"}},
            {"full_name": {"$regex": search, "$options": "i"}}
        ]
    if kyc_status:
        query["kyc_status"] = kyc_status
    
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.users.count_documents(query)
    
    return {"users": users, "total": total}

@api_router.get("/admin/users/{user_id}")
async def admin_get_user(user_id: str, admin: dict = Depends(get_admin_user)):
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Avoid returning base64 images in generic user detail payload
    kyc = await db.kyc.find_one(
        {"user_id": user_id},
        {"_id": 0, "id_front_image": 0, "id_back_image": 0, "selfie_with_id": 0}
    )
    transactions = await db.transactions.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    
    return {"user": user, "kyc": kyc, "recent_transactions": transactions}

@api_router.patch("/admin/users/{user_id}/status")
async def admin_update_user_status(user_id: str, update: UserStatusUpdate, admin: dict = Depends(get_admin_user)):
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_doc = {"is_active": update.is_active}
    if update.ban_reason:
        update_doc["ban_reason"] = update.ban_reason
    if update.ban_until:
        update_doc["ban_until"] = update.ban_until
    
    await db.users.update_one({"user_id": user_id}, {"$set": update_doc})
    await log_action(admin["user_id"], "user_status_update", {"target_user": user_id, "is_active": update.is_active})
    
    return {"message": "User status updated"}

@api_router.post("/admin/users/{user_id}/balance")
async def admin_adjust_balance(user_id: str, adjustment: BalanceAdjustment, admin: dict = Depends(get_admin_user)):
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    currency_key = f"wallet_{adjustment.currency.lower()}"
    
    await db.users.update_one(
        {"user_id": user_id},
        {"$inc": {currency_key: adjustment.amount}}
    )
    
    await db.transactions.insert_one({
        "transaction_id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": "admin_adjustment",
        "amount": adjustment.amount,
        "currency": adjustment.currency.upper(),
        "status": "completed",
        "description": f"Admin adjustment: {adjustment.reason}",
        "admin_id": admin["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    await log_action(admin["user_id"], "balance_adjustment", {
        "target_user": user_id,
        "amount": adjustment.amount,
        "currency": adjustment.currency,
        "reason": adjustment.reason
    })
    
    return {"message": "Balance adjusted successfully"}

# KYC Admin
@api_router.get("/admin/kyc")
async def admin_get_kyc_submissions(
    status: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    admin: dict = Depends(get_admin_user)
):
    query = {}
    if status:
        query["status"] = status
    
    # Avoid returning large/sensitive base64 images in list view
    projection = {
        "_id": 0,
        "id_front_image": 0,
        "id_back_image": 0,
        "selfie_with_id": 0
    }
    submissions = await db.kyc.find(query, projection).sort("submitted_at", -1).limit(limit).to_list(limit)
    return {"submissions": submissions}

@api_router.get("/admin/kyc/{kyc_id}")
async def admin_get_kyc_detail(kyc_id: str, admin: dict = Depends(get_admin_user)):
    kyc = await db.kyc.find_one({"kyc_id": kyc_id}, {"_id": 0})
    if not kyc:
        raise HTTPException(status_code=404, detail="KYC submission not found")
    return {"kyc": kyc}

@api_router.patch("/admin/kyc/{kyc_id}")
async def admin_review_kyc(
    kyc_id: str,
    action: str,
    rejection_reason: Optional[str] = None,
    admin: dict = Depends(get_admin_user)
):
    kyc = await db.kyc.find_one({"kyc_id": kyc_id}, {"_id": 0})
    if not kyc:
        raise HTTPException(status_code=404, detail="KYC submission not found")
    
    if action not in ["approve", "reject"]:
        raise HTTPException(status_code=400, detail="Invalid action")
    
    new_status = "approved" if action == "approve" else "rejected"
    
    update_doc = {
        "status": new_status,
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
        "reviewed_by": admin["user_id"]
    }
    if rejection_reason:
        update_doc["rejection_reason"] = rejection_reason
    
    await db.kyc.update_one({"kyc_id": kyc_id}, {"$set": update_doc})
    await db.users.update_one({"user_id": kyc["user_id"]}, {"$set": {"kyc_status": new_status}})
    
    await log_action(admin["user_id"], "kyc_review", {"kyc_id": kyc_id, "action": action})
    
    # Send email notification
    user = await db.users.find_one({"user_id": kyc["user_id"]}, {"_id": 0})
    if user:
        subject = "KAYICOM - KYC Verification " + ("Approved" if action == "approve" else "Rejected")
        content = f"""
        <h2>KYC Verification Update</h2>
        <p>Your KYC verification has been {'approved' if action == 'approve' else 'rejected'}.</p>
        {'<p>Reason: ' + rejection_reason + '</p>' if rejection_reason else ''}
        """
        await send_email(user["email"], subject, content)
    
    return {"message": f"KYC {action}d successfully"}

# Deposits Admin
@api_router.get("/admin/deposits")
async def admin_get_deposits(
    status: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    admin: dict = Depends(get_admin_user)
):
    query = {}
    if status:
        query["status"] = status
    
    # Avoid returning large base64 proof images in list view
    deposits = await db.deposits.find(query, {"_id": 0, "proof_image": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"deposits": deposits}

@api_router.get("/admin/deposits/{deposit_id}")
async def admin_get_deposit_detail(deposit_id: str, admin: dict = Depends(get_admin_user)):
    deposit = await db.deposits.find_one({"deposit_id": deposit_id}, {"_id": 0})
    if not deposit:
        raise HTTPException(status_code=404, detail="Deposit not found")
    return {"deposit": deposit}

@api_router.patch("/admin/deposits/{deposit_id}")
async def admin_process_deposit(
    deposit_id: str,
    action: str,
    admin: dict = Depends(get_admin_user)
):
    deposit = await db.deposits.find_one({"deposit_id": deposit_id}, {"_id": 0})
    if not deposit:
        raise HTTPException(status_code=404, detail="Deposit not found")
    
    if deposit["status"] != "pending":
        raise HTTPException(status_code=400, detail="Deposit already processed")
    
    if action not in ["approve", "reject"]:
        raise HTTPException(status_code=400, detail="Invalid action")
    
    new_status = "completed" if action == "approve" else "rejected"
    
    await db.deposits.update_one(
        {"deposit_id": deposit_id},
        {"$set": {"status": new_status, "processed_at": datetime.now(timezone.utc).isoformat(), "processed_by": admin["user_id"]}}
    )
    
    if action == "approve":
        currency_key = f"wallet_{deposit['currency'].lower()}"
        await db.users.update_one(
            {"user_id": deposit["user_id"]},
            {"$inc": {currency_key: deposit["amount"]}}
        )
        
        await db.transactions.insert_one({
            "transaction_id": str(uuid.uuid4()),
            "user_id": deposit["user_id"],
            "type": "deposit",
            "amount": deposit["amount"],
            "currency": deposit["currency"],
            "reference_id": deposit_id,
            "status": "completed",
            "description": f"Deposit via {deposit['method']}",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    await log_action(admin["user_id"], "deposit_process", {"deposit_id": deposit_id, "action": action})
    
    return {"message": f"Deposit {action}d successfully"}

# Withdrawals Admin
@api_router.get("/admin/withdrawals")
async def admin_get_withdrawals(
    status: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    admin: dict = Depends(get_admin_user)
):
    query = {}
    if status:
        query["status"] = status
    
    withdrawals = await db.withdrawals.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"withdrawals": withdrawals}

@api_router.patch("/admin/withdrawals/{withdrawal_id}")
async def admin_process_withdrawal(
    withdrawal_id: str,
    action: str,
    admin: dict = Depends(get_admin_user)
):
    withdrawal = await db.withdrawals.find_one({"withdrawal_id": withdrawal_id}, {"_id": 0})
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    
    if withdrawal["status"] != "pending":
        raise HTTPException(status_code=400, detail="Withdrawal already processed")
    
    if action not in ["approve", "reject"]:
        raise HTTPException(status_code=400, detail="Invalid action")
    
    new_status = "completed" if action == "approve" else "rejected"
    
    await db.withdrawals.update_one(
        {"withdrawal_id": withdrawal_id},
        {"$set": {"status": new_status, "processed_at": datetime.now(timezone.utc).isoformat(), "processed_by": admin["user_id"]}}
    )
    
    if action == "reject":
        # Refund the ORIGINAL deducted amount back to the SOURCE currency wallet.
        # (Fixes cross-currency withdrawal refund bug.)
        source_currency = (withdrawal.get("source_currency") or withdrawal.get("currency") or "").upper()
        amount_deducted = withdrawal.get("amount_deducted", withdrawal.get("amount", 0))

        currency_key = f"wallet_{source_currency.lower()}"
        await db.users.update_one(
            {"user_id": withdrawal["user_id"]},
            {"$inc": {currency_key: amount_deducted}}
        )

        # Add refund transaction record for traceability
        await db.transactions.insert_one({
            "transaction_id": str(uuid.uuid4()),
            "user_id": withdrawal["user_id"],
            "type": "withdrawal_refund",
            "amount": amount_deducted,
            "currency": source_currency,
            "reference_id": withdrawal_id,
            "status": "completed",
            "description": f"Withdrawal refund (rejected) - refunded to {source_currency}",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    await db.transactions.update_one(
        {"reference_id": withdrawal_id, "type": "withdrawal"},
        {"$set": {"status": new_status}}
    )
    
    await log_action(admin["user_id"], "withdrawal_process", {"withdrawal_id": withdrawal_id, "action": action})
    
    return {"message": f"Withdrawal {action}d successfully"}

# Exchange Rates Admin
@api_router.put("/admin/exchange-rates")
async def admin_update_exchange_rates(rates: ExchangeRateUpdate, admin: dict = Depends(get_admin_user)):
    update_data = {
        "htg_to_usd": rates.htg_to_usd,
        "usd_to_htg": rates.usd_to_htg,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": admin["user_id"]
    }
    
    # Add swap rates if provided
    if rates.swap_htg_to_usd is not None:
        update_data["swap_htg_to_usd"] = rates.swap_htg_to_usd
    if rates.swap_usd_to_htg is not None:
        update_data["swap_usd_to_htg"] = rates.swap_usd_to_htg
    
    await db.exchange_rates.update_one(
        {"rate_id": "main"},
        {"$set": update_data},
        upsert=True
    )
    
    await log_action(admin["user_id"], "exchange_rate_update", update_data)
    
    return {"message": "Exchange rates updated"}

# Fees Admin
@api_router.get("/admin/fees")
async def admin_get_fees(admin: dict = Depends(get_admin_user)):
    fees = await db.fees.find({}, {"_id": 0}).to_list(100)
    return {"fees": fees}

@api_router.post("/admin/fees")
async def admin_create_fee(fee: FeeConfigUpdate, admin: dict = Depends(get_admin_user)):
    fee_doc = {
        "fee_id": str(uuid.uuid4()),
        **fee.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.fees.insert_one(fee_doc)
    
    await log_action(admin["user_id"], "fee_create", fee.model_dump())
    
    if "_id" in fee_doc:
        del fee_doc["_id"]
    return {"fee": fee_doc}

@api_router.delete("/admin/fees/{fee_id}")
async def admin_delete_fee(fee_id: str, admin: dict = Depends(get_admin_user)):
    result = await db.fees.delete_one({"fee_id": fee_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Fee not found")
    
    await log_action(admin["user_id"], "fee_delete", {"fee_id": fee_id})
    
    return {"message": "Fee deleted"}

# Card Withdrawal Fees (by limit range)
class CardFeeConfig(BaseModel):
    min_amount: float
    max_amount: float
    fee: float
    fee_type: str = "flat"  # flat | percentage

@api_router.get("/admin/card-fees")
async def admin_get_card_fees(admin: dict = Depends(get_admin_user)):
    fees = await db.card_fees.find({}, {"_id": 0}).sort("min_amount", 1).to_list(100)
    return {"fees": fees}

@api_router.post("/admin/card-fees")
async def admin_create_card_fee(fee: CardFeeConfig, admin: dict = Depends(get_admin_user)):
    fee_doc = {
        "fee_id": str(uuid.uuid4()),
        **fee.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.card_fees.insert_one(fee_doc)
    
    await log_action(admin["user_id"], "card_fee_create", fee.model_dump())
    
    if "_id" in fee_doc:
        del fee_doc["_id"]
    return {"fee": fee_doc}

@api_router.delete("/admin/card-fees/{fee_id}")
async def admin_delete_card_fee(fee_id: str, admin: dict = Depends(get_admin_user)):
    result = await db.card_fees.delete_one({"fee_id": fee_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Card fee not found")
    
    await log_action(admin["user_id"], "card_fee_delete", {"fee_id": fee_id})
    
    return {"message": "Card fee deleted"}

# Withdrawal Limits Admin
@api_router.get("/admin/withdrawal-limits")
async def admin_get_withdrawal_limits(admin: dict = Depends(get_admin_user)):
    limits = await db.withdrawal_limits.find({}, {"_id": 0}).to_list(100)
    return {"limits": limits}

@api_router.put("/admin/withdrawal-limits")
async def admin_update_withdrawal_limit(limit: WithdrawalLimitUpdate, admin: dict = Depends(get_admin_user)):
    await db.withdrawal_limits.update_one(
        {"method": limit.method},
        {"$set": limit.model_dump()},
        upsert=True
    )
    
    await log_action(admin["user_id"], "withdrawal_limit_update", limit.model_dump())
    
    return {"message": "Withdrawal limit updated"}

# Settings Admin
@api_router.get("/admin/settings")
async def admin_get_settings(admin: dict = Depends(get_admin_user)):
    settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
    if not settings:
        settings = {
            "setting_id": "main",
            "resend_enabled": False,
            "resend_api_key": "",
            "sender_email": "",
            "crisp_enabled": False,
            "crisp_website_id": "",
            "whatsapp_enabled": False,
            "whatsapp_number": "",
            "plisio_enabled": False,
            "plisio_api_key": "",
            "plisio_secret_key": "",
            "card_order_fee_htg": CARD_FEE_HTG,
            "affiliate_reward_htg": 2000,
            "affiliate_cards_required": 5
        }

    # Do not return sensitive keys in plaintext
    def _last4(val: Optional[str]) -> Optional[str]:
        if not val:
            return None
        v = str(val)
        return v[-4:] if len(v) >= 4 else v

    safe_settings = dict(settings)
    safe_settings["resend_api_key_last4"] = _last4(settings.get("resend_api_key"))
    safe_settings["plisio_api_key_last4"] = _last4(settings.get("plisio_api_key"))
    safe_settings["plisio_secret_key_last4"] = _last4(settings.get("plisio_secret_key"))
    safe_settings["resend_api_key"] = ""
    safe_settings["plisio_api_key"] = ""
    safe_settings["plisio_secret_key"] = ""
    return {"settings": safe_settings}

# Public endpoint for chat settings (no auth required)
@api_router.get("/public/chat-settings")
async def get_public_chat_settings():
    """Get chat settings for public display (Crisp/WhatsApp)"""
    settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
    if not settings:
        return {
            "crisp_enabled": False,
            "crisp_website_id": None,
            "whatsapp_enabled": False,
            "whatsapp_number": None
        }
    
    return {
        "crisp_enabled": settings.get("crisp_enabled", False),
        "crisp_website_id": settings.get("crisp_website_id") if settings.get("crisp_enabled") else None,
        "whatsapp_enabled": settings.get("whatsapp_enabled", False),
        "whatsapp_number": settings.get("whatsapp_number") if settings.get("whatsapp_enabled") else None
    }

@api_router.put("/admin/settings")
async def admin_update_settings(settings: AdminSettingsUpdate, admin: dict = Depends(get_admin_user)):
    update_doc = {k: v for k, v in settings.model_dump().items() if v is not None}
    # Avoid wiping secrets if UI sends empty strings
    for secret_field in ["resend_api_key", "plisio_api_key", "plisio_secret_key"]:
        if secret_field in update_doc and isinstance(update_doc[secret_field], str) and update_doc[secret_field].strip() == "":
            update_doc.pop(secret_field, None)
    update_doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.settings.update_one(
        {"setting_id": "main"},
        {"$set": update_doc},
        upsert=True
    )
    
    await log_action(admin["user_id"], "settings_update", {"fields_updated": list(update_doc.keys())})
    
    return {"message": "Settings updated"}

@api_router.get("/admin/diagnostics")
async def admin_diagnostics(admin: dict = Depends(get_admin_user)):
    """Quick admin diagnostics to verify configuration and DB access."""
    settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0}) or {}
    try:
        await db.command("ping")
        db_ok = True
    except Exception:
        db_ok = False

    diagnostics = {
        "db_ok": db_ok,
        "resend": {
            "enabled": bool(settings.get("resend_enabled", False)),
            "configured": bool(settings.get("resend_api_key")),
            "sender_email": settings.get("sender_email") or None,
        },
        "crisp": {
            "enabled": bool(settings.get("crisp_enabled", False)),
            "configured": bool(settings.get("crisp_website_id")),
        },
        "whatsapp": {
            "enabled": bool(settings.get("whatsapp_enabled", False)),
            "configured": bool(settings.get("whatsapp_number")),
        },
        "plisio": {
            "enabled": bool(settings.get("plisio_enabled", False)),
            "configured": bool(settings.get("plisio_api_key") and settings.get("plisio_secret_key")),
            "usdt_networks_cached": len(settings.get("plisio_usdt_networks_cache") or []) if isinstance(settings.get("plisio_usdt_networks_cache"), list) else 0,
        },
    }
    warnings = []
    if diagnostics["resend"]["enabled"] and not diagnostics["resend"]["configured"]:
        warnings.append("Resend enabled but API key not configured")
    if diagnostics["crisp"]["enabled"] and not diagnostics["crisp"]["configured"]:
        warnings.append("Crisp enabled but website id not configured")
    if diagnostics["whatsapp"]["enabled"] and not diagnostics["whatsapp"]["configured"]:
        warnings.append("WhatsApp enabled but number not configured")
    if diagnostics["plisio"]["enabled"] and not diagnostics["plisio"]["configured"]:
        warnings.append("Plisio enabled but keys not configured")
    if not db_ok:
        warnings.append("MongoDB ping failed")
    return {"diagnostics": diagnostics, "warnings": warnings}


@api_router.post("/admin/purge-old-records")
async def admin_purge_old_records(days: int = Query(default=7, ge=1, le=365), admin: dict = Depends(get_admin_user)):
    result = await _purge_old_records(days=days)
    await log_action(admin["user_id"], "purge_old_records", result)
    return {"result": result}

# Bulk Email Admin
@api_router.post("/admin/bulk-email")
async def admin_send_bulk_email(request: BulkEmailRequest, admin: dict = Depends(get_admin_user)):
    query = {}
    if request.recipient_filter == "kyc_approved":
        query["kyc_status"] = "approved"
    elif request.recipient_filter == "active":
        query["is_active"] = True
    
    users = await db.users.find(query, {"_id": 0, "email": 1}).to_list(10000)
    
    success_count = 0
    fail_count = 0
    
    for user in users:
        result = await send_email(user["email"], request.subject, request.html_content)
        if result:
            success_count += 1
        else:
            fail_count += 1
    
    await log_action(admin["user_id"], "bulk_email", {
        "subject": request.subject,
        "filter": request.recipient_filter,
        "success": success_count,
        "failed": fail_count
    })
    
    return {"message": f"Emails sent: {success_count} success, {fail_count} failed"}

# Logs Admin
@api_router.get("/admin/logs")
async def admin_get_logs(
    user_id: Optional[str] = None,
    action: Optional[str] = None,
    limit: int = Query(default=100, le=500),
    admin: dict = Depends(get_admin_user)
):
    query = {}
    if user_id:
        query["user_id"] = user_id
    if action:
        query["action"] = action
    
    logs = await db.logs.find(query, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)
    return {"logs": logs}

# ==================== MAIN ROUTES ====================

@api_router.get("/")
async def root():
    return {"message": "KAYICOM Wallet API", "version": "1.0.0"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("client_id", unique=True)
    await db.users.create_index("affiliate_code", unique=True)
    await db.transactions.create_index([("user_id", 1), ("created_at", -1)])
    await db.deposits.create_index([("user_id", 1), ("status", 1)])
    await db.withdrawals.create_index([("user_id", 1), ("status", 1)])
    await db.kyc.create_index("user_id", unique=True)
    
    # Ensure default settings exist
    existing_settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
    if not existing_settings:
        await db.settings.insert_one({
            "setting_id": "main",
            "resend_enabled": False,
            "resend_api_key": "",
            "sender_email": "",
            "crisp_enabled": False,
            "crisp_website_id": "",
            "whatsapp_enabled": False,
            "whatsapp_number": "",
            "plisio_enabled": False,
            "plisio_api_key": "",
            "plisio_secret_key": "",
            "card_order_fee_htg": CARD_FEE_HTG,
            "affiliate_reward_htg": 2000,
            "affiliate_cards_required": 5,
            "created_at": datetime.now(timezone.utc).isoformat()
        })

    # Initialize JWT secret (env overrides DB). Persist in settings for stability across restarts.
    global SECRET_KEY
    if not SECRET_KEY:
        settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0}) or {}
        jwt_secret = settings.get("jwt_secret")
        if not jwt_secret:
            jwt_secret = secrets.token_urlsafe(32)
            await db.settings.update_one(
                {"setting_id": "main"},
                {"$set": {"jwt_secret": jwt_secret, "updated_at": datetime.now(timezone.utc).isoformat()}},
                upsert=True
            )
        SECRET_KEY = jwt_secret

    # Create default admin if not exists (or migrate old email)
    admin = await db.users.find_one({"is_admin": True}, {"_id": 0})
    desired_admin_email = "graciaemmanuel509@gmail.com"
    if not admin:
        existing_user_with_email = await db.users.find_one({"email": desired_admin_email.lower()}, {"_id": 0})
        if existing_user_with_email:
            await db.users.update_one(
                {"user_id": existing_user_with_email["user_id"]},
                {"$set": {"is_admin": True, "kyc_status": "approved"}}
            )
            logger.info("Promoted existing user to admin: %s", desired_admin_email)
            admin = await db.users.find_one({"is_admin": True}, {"_id": 0})
            # continue startup (indexes/exchange rates/etc.)
        else:
            admin_doc = {
                "user_id": str(uuid.uuid4()),
                "client_id": "KCADMIN001",
                "email": desired_admin_email,
                "password_hash": hash_password("Admin123!"),
                "full_name": "System Admin",
                "phone": "+509 0000 0000",
                "language": "fr",
                "kyc_status": "approved",
                "wallet_htg": 0.0,
                "wallet_usd": 0.0,
                "affiliate_code": "ADMINCODE",
                "affiliate_earnings": 0.0,
                "referred_by": None,
                "is_active": True,
                "is_admin": True,
                "two_factor_enabled": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(admin_doc)
            logger.info("Default admin created: %s / Admin123!", desired_admin_email)
    else:
        if admin.get("email", "").lower() == "admin@kayicom.com":
            existing_user_with_email = await db.users.find_one({"email": desired_admin_email.lower()}, {"_id": 0, "user_id": 1})
            if existing_user_with_email and existing_user_with_email["user_id"] != admin["user_id"]:
                logger.warning("Cannot migrate admin email to %s (email already in use).", desired_admin_email)
            else:
                await db.users.update_one({"user_id": admin["user_id"]}, {"$set": {"email": desired_admin_email}})
                logger.info("Default admin email updated to %s", desired_admin_email)
    
    # Create default exchange rates
    rates = await db.exchange_rates.find_one({"rate_id": "main"}, {"_id": 0})
    if not rates:
        await db.exchange_rates.insert_one({
            "rate_id": "main",
            "htg_to_usd": 0.0075,
            "usd_to_htg": 133.0,
            "updated_at": datetime.now(timezone.utc).isoformat()
        })

    # Seed default card withdrawal fees (if none exist)
    if await db.card_fees.count_documents({}) == 0:
        now = datetime.now(timezone.utc).isoformat()
        tiers = [
            (5, 19, "flat", 2.5),
            (20, 39, "flat", 3),
            (40, 99, "flat", 4.4),
            (100, 199, "flat", 5.9),
            (200, 299, "flat", 9),
            (300, 399, "flat", 14),
            (400, 499, "flat", 15),
            (500, 599, "flat", 20),
            (600, 1500, "flat", 30),
            (1500, 10**12, "percentage", 5),
        ]
        docs = []
        for mn, mx, fee_type, fee in tiers:
            docs.append({
                "fee_id": str(uuid.uuid4()),
                "min_amount": float(mn),
                "max_amount": float(mx),
                "fee_type": fee_type,
                "fee": float(fee),
                "created_at": now
            })
        await db.card_fees.insert_many(docs)

    # Start Plisio polling loop (auto-detect paid deposits)
    global _plisio_poll_task
    if _plisio_poll_task is None:
        _plisio_poll_task = asyncio.create_task(_plisio_poll_loop())

    # Start daily cleanup loop (purge old deposits/withdrawals)
    global _cleanup_task
    if _cleanup_task is None:
        _cleanup_task = asyncio.create_task(_cleanup_loop())

@app.on_event("shutdown")
async def shutdown_db_client():
    global _plisio_poll_task
    if _plisio_poll_task is not None:
        _plisio_poll_task.cancel()
        _plisio_poll_task = None
    global _cleanup_task
    if _cleanup_task is not None:
        _cleanup_task.cancel()
        _cleanup_task = None
    client.close()
