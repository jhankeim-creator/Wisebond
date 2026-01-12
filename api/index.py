from fastapi import FastAPI, APIRouter, HTTPException, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
import base64
import binascii
import re
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
from jose import jwt, JWTError
import secrets

load_dotenv()

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', '')
db_name = os.environ.get('DB_NAME', 'Kayicom')

# Ensure database name is in connection string for proper authentication
# MongoDB Atlas requires authSource parameter or database in path
if mongo_url and ('mongodb+srv://' in mongo_url or 'mongodb://' in mongo_url):
    from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
    
    parsed = urlparse(mongo_url)
    query_params = parse_qs(parsed.query)
    
    # Add authSource if not present (required for Atlas authentication)
    if 'authSource' not in query_params:
        query_params['authSource'] = [db_name]
    
    # Add standard connection options
    if 'retryWrites' not in query_params:
        query_params['retryWrites'] = ['true']
    if 'w' not in query_params:
        query_params['w'] = ['majority']
    
    # If no database in path, add it (optional but recommended)
    if not parsed.path or parsed.path == '/':
        new_path = f'/{db_name}'
    else:
        new_path = parsed.path
    
    # Reconstruct URL
    new_query = urlencode(query_params, doseq=True)
    mongo_url = urlunparse((
        parsed.scheme,
        parsed.netloc,
        new_path,
        parsed.params,
        new_query,
        parsed.fragment
    ))

client = None
db = None

def get_db():
    global client, db
    if client is None:
        if not mongo_url:
            raise ValueError("MONGO_URL environment variable is required")
        client = AsyncIOMotorClient(mongo_url)
        db = client[db_name]
    return db

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET', secrets.token_urlsafe(32))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

app = FastAPI(
    title="KAYICOM Wallet API",
    description="API for KAYICOM digital wallet platform",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== KYC IMAGE STORAGE (OPTIONAL CLOUDINARY) ====================

_DATA_URL_IMAGE_RE = re.compile(
    r"^data:(image/(?:png|jpe?g|webp));base64,(.+)$",
    flags=re.IGNORECASE | re.DOTALL,
)

_CLOUDINARY_CONFIGURED: Optional[bool] = None


def _cloudinary_is_configured() -> bool:
    global _CLOUDINARY_CONFIGURED
    if _CLOUDINARY_CONFIGURED is not None:
        return _CLOUDINARY_CONFIGURED
    cloud_name = (os.environ.get("CLOUDINARY_CLOUD_NAME") or "").strip()
    api_key = (os.environ.get("CLOUDINARY_API_KEY") or "").strip()
    api_secret = (os.environ.get("CLOUDINARY_API_SECRET") or "").strip()
    _CLOUDINARY_CONFIGURED = bool(cloud_name and api_key and api_secret)
    return _CLOUDINARY_CONFIGURED


def _cloudinary_setup() -> bool:
    if not _cloudinary_is_configured():
        return False
    import cloudinary  # type: ignore

    cloudinary.config(
        cloud_name=(os.environ.get("CLOUDINARY_CLOUD_NAME") or "").strip(),
        api_key=(os.environ.get("CLOUDINARY_API_KEY") or "").strip(),
        api_secret=(os.environ.get("CLOUDINARY_API_SECRET") or "").strip(),
        secure=True,
    )
    return True


def _parse_image_data_url(value: str) -> Optional[Dict[str, Any]]:
    if not isinstance(value, str):
        return None
    m = _DATA_URL_IMAGE_RE.match(value.strip())
    if not m:
        return None
    mime = (m.group(1) or "").lower().replace("image/jpg", "image/jpeg")
    b64 = m.group(2) or ""
    try:
        raw = base64.b64decode(b64, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=400, detail="Invalid image encoding (base64)")
    return {"mime": mime, "bytes": raw, "data_url": value.strip()}


async def _cloudinary_upload_data_url(*, data_url: str, folder: str, public_id: str) -> str:
    if not _cloudinary_setup():
        raise RuntimeError("Cloudinary not configured")
    import cloudinary.uploader  # type: ignore

    result = await asyncio.to_thread(
        cloudinary.uploader.upload,
        data_url,
        folder=folder,
        public_id=public_id,
        overwrite=True,
        unique_filename=False,
        resource_type="image",
    )
    url = (result or {}).get("secure_url") or (result or {}).get("url")
    if not url:
        raise RuntimeError("Cloudinary upload did not return a URL")
    return str(url)


async def _kyc_store_image_value(
    value: Optional[str],
    *,
    user_id: str,
    kyc_id: str,
    field_name: str,
) -> Dict[str, Any]:
    if not value:
        return {"value": value, "meta": None}

    parsed = _parse_image_data_url(value)
    if not parsed:
        return {
            "value": value,
            "meta": {
                "storage": "external",
                "mime": None,
                "bytes": None,
                "uploaded_at": datetime.now(timezone.utc).isoformat(),
            },
        }

    mime = parsed["mime"]
    raw = parsed["bytes"]
    max_bytes = int(os.environ.get("KYC_MAX_IMAGE_BYTES") or 5 * 1024 * 1024)
    if len(raw) > max_bytes:
        raise HTTPException(status_code=413, detail="Image too large")
    if mime not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=400, detail="Unsupported image type")

    if _cloudinary_is_configured():
        folder = (os.environ.get("CLOUDINARY_FOLDER") or "kayicom/kyc").strip().strip("/")
        public_id = f"{kyc_id}_{field_name}"
        try:
            url = await _cloudinary_upload_data_url(data_url=parsed["data_url"], folder=folder, public_id=public_id)
            return {
                "value": url,
                "meta": {
                    "storage": "cloudinary",
                    "mime": mime,
                    "bytes": len(raw),
                    "public_id": f"{folder}/{public_id}" if folder else public_id,
                    "uploaded_at": datetime.now(timezone.utc).isoformat(),
                },
            }
        except Exception as e:
            logger.exception("Cloudinary upload failed; falling back to inline storage: %s", e)

    return {
        "value": parsed["data_url"],
        "meta": {
            "storage": "inline",
            "mime": mime,
            "bytes": len(raw),
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
        },
    }

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
    source_currency: Optional[str] = None

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
    """
    Admin-configurable settings.
    Keep this aligned with `frontend/src/pages/admin/AdminSettings.js` allowedKeys.
    """

    class Config:
        extra = "ignore"

    # Email (Resend)
    resend_enabled: Optional[bool] = None
    resend_api_key: Optional[str] = None
    sender_email: Optional[str] = None

    # Live Chat (Crisp)
    crisp_enabled: Optional[bool] = None
    crisp_website_id: Optional[str] = None

    # WhatsApp (CallMeBot)
    whatsapp_enabled: Optional[bool] = None
    whatsapp_number: Optional[str] = None
    callmebot_api_key: Optional[str] = None

    # Telegram
    telegram_enabled: Optional[bool] = None
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None

    # USDT (Plisio)
    plisio_enabled: Optional[bool] = None
    plisio_api_key: Optional[str] = None
    plisio_secret_key: Optional[str] = None

    # Virtual Cards (Strowallet)
    strowallet_enabled: Optional[bool] = None
    strowallet_base_url: Optional[str] = None
    strowallet_api_key: Optional[str] = None
    strowallet_api_secret: Optional[str] = None
    strowallet_create_user_path: Optional[str] = None
    strowallet_create_card_path: Optional[str] = None
    strowallet_fund_card_path: Optional[str] = None
    strowallet_withdraw_card_path: Optional[str] = None
    strowallet_fetch_card_detail_path: Optional[str] = None
    strowallet_card_transactions_path: Optional[str] = None
    strowallet_brand_name: Optional[str] = None
    strowallet_mode: Optional[str] = None
    strowallet_create_card_amount_usd: Optional[float] = None
    strowallet_freeze_unfreeze_path: Optional[str] = None
    strowallet_full_card_history_path: Optional[str] = None
    strowallet_withdraw_status_path: Optional[str] = None
    strowallet_upgrade_limit_path: Optional[str] = None

    # Fees & Affiliate
    card_order_fee_htg: Optional[int] = None
    affiliate_reward_htg: Optional[int] = None
    affiliate_cards_required: Optional[int] = None
    card_background_image: Optional[str] = None
    topup_fee_tiers: Optional[List[Dict[str, Any]]] = None

    # Announcement bar
    announcement_enabled: Optional[bool] = None
    announcement_text_ht: Optional[str] = None
    announcement_text_fr: Optional[str] = None
    announcement_text_en: Optional[str] = None
    announcement_link: Optional[str] = None

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

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    db = get_db()
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
    db = get_db()
    log_entry = {
        "log_id": str(uuid.uuid4()),
        "user_id": user_id,
        "action": action,
        "details": details,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.logs.insert_one(log_entry)

async def send_email(to_email: str, subject: str, html_content: str):
    db = get_db()
    try:
        settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
        resend_key = settings.get("resend_api_key") if settings else os.environ.get("RESEND_API_KEY")
        sender = settings.get("sender_email") if settings else os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
        
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
    db = get_db()
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
    db = get_db()
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
    db = get_db()
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
    
    frontend_url = os.environ.get('FRONTEND_URL', 'https://kayicom.vercel.app')
    reset_link = f"{frontend_url}/reset-password?token={reset_token}"
    
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
    db = get_db()
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
    db = get_db()
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
    db = get_db()
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
    
    await db.deposits.insert_one(deposit)
    await log_action(current_user["user_id"], "deposit_request", {"amount": request.amount, "method": request.method})
    
    if "_id" in deposit:
        del deposit["_id"]
    return {"deposit": deposit}

@api_router.get("/deposits")
async def get_deposits(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    query = {"user_id": current_user["user_id"]}
    if status:
        query["status"] = status
    
    deposits = await db.deposits.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"deposits": deposits}

# ==================== WITHDRAWAL ROUTES ====================

@api_router.post("/withdrawals/create")
async def create_withdrawal(request: WithdrawalRequest, current_user: dict = Depends(get_current_user)):
    db = get_db()
    if current_user["kyc_status"] != "approved":
        raise HTTPException(status_code=403, detail="KYC verification required for withdrawals")
    
    target_currency = request.currency.upper()
    source_currency = (request.source_currency or request.currency).upper()
    
    rates = await db.exchange_rates.find_one({"rate_id": "main"}, {"_id": 0})
    if not rates:
        rates = {"htg_to_usd": 0.0075, "usd_to_htg": 133.0}
    
    if source_currency == target_currency:
        amount_to_deduct = request.amount
    elif source_currency == "USD" and target_currency == "HTG":
        amount_to_deduct = request.amount * rates["htg_to_usd"]
    else:
        amount_to_deduct = request.amount * rates["usd_to_htg"]
    
    source_key = f"wallet_{source_currency.lower()}"
    if current_user.get(source_key, 0) < amount_to_deduct:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    limits = await db.withdrawal_limits.find_one({"method": request.method}, {"_id": 0})
    if limits:
        if request.amount < limits.get("min_amount", 0):
            raise HTTPException(status_code=400, detail=f"Minimum withdrawal is {limits['min_amount']}")
        if request.amount > limits.get("max_amount", float('inf')):
            raise HTTPException(status_code=400, detail=f"Maximum withdrawal is {limits['max_amount']}")
    
    fee = 0
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
    
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$inc": {source_key: -amount_to_deduct}}
    )
    
    await db.withdrawals.insert_one(withdrawal)
    
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
    db = get_db()
    query = {"user_id": current_user["user_id"]}
    if status:
        query["status"] = status
    
    withdrawals = await db.withdrawals.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"withdrawals": withdrawals}

@api_router.get("/withdrawals/fees")
async def get_withdrawal_fees():
    db = get_db()
    fees = await db.fees.find({}, {"_id": 0}).to_list(100)
    limits = await db.withdrawal_limits.find({}, {"_id": 0}).to_list(100)
    return {"fees": fees, "limits": limits}

# ==================== SWAP ROUTES ====================

@api_router.post("/wallet/swap")
async def swap_currency(request: SwapRequest, current_user: dict = Depends(get_current_user)):
    db = get_db()
    from_currency = request.from_currency.upper()
    to_currency = request.to_currency.upper()
    
    if from_currency not in ['HTG', 'USD'] or to_currency not in ['HTG', 'USD']:
        raise HTTPException(status_code=400, detail="Invalid currency")
    
    if from_currency == to_currency:
        raise HTTPException(status_code=400, detail="Cannot swap same currency")
    
    from_key = f"wallet_{from_currency.lower()}"
    to_key = f"wallet_{to_currency.lower()}"
    
    if current_user.get(from_key, 0) < request.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    rates = await db.exchange_rates.find_one({"rate_id": "main"}, {"_id": 0})
    if not rates:
        rates = {
            "htg_to_usd": 0.0075, 
            "usd_to_htg": 133.0,
            "swap_htg_to_usd": 0.0074,
            "swap_usd_to_htg": 132.0
        }
    
    if from_currency == "HTG":
        rate_used = rates.get("swap_htg_to_usd", rates.get("htg_to_usd", 0.0075))
        converted_amount = request.amount * rate_used
    else:
        rate_used = rates.get("swap_usd_to_htg", rates.get("usd_to_htg", 133.0))
        converted_amount = request.amount * rate_used
    
    swap_id = str(uuid.uuid4())
    
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {
            "$inc": {
                from_key: -request.amount,
                to_key: converted_amount
            }
        }
    )
    
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
    db = get_db()
    if current_user["kyc_status"] != "approved":
        raise HTTPException(status_code=403, detail="KYC verification required for transfers")
    
    if request.recipient_client_id == current_user["client_id"]:
        raise HTTPException(status_code=400, detail="Cannot transfer to yourself")
    
    recipient = await db.users.find_one({"client_id": request.recipient_client_id}, {"_id": 0})
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")
    
    currency_key = f"wallet_{request.currency.lower()}"
    if current_user.get(currency_key, 0) < request.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    fee = 0
    fee_config = await db.fees.find_one({"method": "internal_transfer"}, {"_id": 0})
    if fee_config:
        if fee_config.get("fee_type") == "percentage":
            fee = request.amount * (fee_config["fee_value"] / 100)
        else:
            fee = fee_config["fee_value"]
    
    transfer_id = str(uuid.uuid4())
    
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$inc": {currency_key: -(request.amount + fee)}}
    )
    
    await db.users.update_one(
        {"user_id": recipient["user_id"]},
        {"$inc": {currency_key: request.amount}}
    )
    
    await db.transactions.insert_one({
        "transaction_id": str(uuid.uuid4()),
        "user_id": current_user["user_id"],
        "type": "transfer_out",
        "amount": -(request.amount + fee),
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
    db = get_db()
    existing = await db.kyc.find_one({"user_id": current_user["user_id"]}, {"_id": 0})
    if existing and existing.get("status") == "approved":
        raise HTTPException(status_code=400, detail="KYC already approved")
    
    kyc_id = str(uuid.uuid4())

    id_front = await _kyc_store_image_value(
        request.id_front_image,
        user_id=current_user["user_id"],
        kyc_id=kyc_id,
        field_name="id_front_image",
    )
    id_back = await _kyc_store_image_value(
        request.id_back_image,
        user_id=current_user["user_id"],
        kyc_id=kyc_id,
        field_name="id_back_image",
    )
    selfie = await _kyc_store_image_value(
        request.selfie_with_id,
        user_id=current_user["user_id"],
        kyc_id=kyc_id,
        field_name="selfie_with_id",
    )

    kyc_doc = {
        "kyc_id": kyc_id,
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
        "id_front_image": id_front["value"],
        "id_back_image": id_back["value"],
        "selfie_with_id": selfie["value"],
        "image_meta": {
            "id_front_image": id_front["meta"],
            "id_back_image": id_back["meta"],
            "selfie_with_id": selfie["meta"],
        },
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
    db = get_db()
    kyc = await db.kyc.find_one({"user_id": current_user["user_id"]}, {"_id": 0})
    return {"kyc": kyc, "status": current_user["kyc_status"]}

# ==================== AFFILIATE ROUTES ====================

@api_router.get("/affiliate/info")
async def get_affiliate_info(current_user: dict = Depends(get_current_user)):
    db = get_db()
    referrals = await db.users.find(
        {"referred_by": current_user["affiliate_code"]},
        {"_id": 0, "user_id": 1, "client_id": 1, "full_name": 1, "created_at": 1}
    ).to_list(100)
    
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
    
    frontend_url = os.environ.get('FRONTEND_URL', 'https://kayicom.vercel.app')
    
    return {
        "affiliate_code": current_user["affiliate_code"],
        "affiliate_link": f"{frontend_url}/register?ref={current_user['affiliate_code']}",
        "earnings": current_user.get("affiliate_earnings", 0),
        "referrals": enriched_referrals,
        "referrals_with_cards": referrals_with_cards
    }

@api_router.post("/affiliate/apply-code")
async def apply_affiliate_code(code: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
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
    db = get_db()
    earnings = current_user.get("affiliate_earnings", 0)
    
    if earnings < 2000:
        raise HTTPException(status_code=400, detail="Minimum withdrawal is 2,000 HTG")
    
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {
            "$inc": {"wallet_htg": earnings},
            "$set": {"affiliate_earnings": 0}
        }
    )
    
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

# ==================== VIRTUAL CARD ROUTES ====================

CARD_FEE_HTG = 500
CARD_BONUS_USD = 5

@api_router.get("/virtual-cards")
async def get_virtual_cards(current_user: dict = Depends(get_current_user)):
    db = get_db()
    cards = await db.virtual_cards.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0}
    ).to_list(10)
    return {"cards": cards}

@api_router.get("/virtual-cards/orders")
async def get_card_orders(current_user: dict = Depends(get_current_user)):
    db = get_db()
    orders = await db.virtual_card_orders.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return {"orders": orders}

@api_router.get("/virtual-cards/deposits")
async def get_card_deposits(current_user: dict = Depends(get_current_user)):
    db = get_db()
    deposits = await db.virtual_card_deposits.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return {"deposits": deposits}

@api_router.post("/virtual-cards/order")
async def order_virtual_card(request: VirtualCardOrder, current_user: dict = Depends(get_current_user)):
    db = get_db()
    if current_user["kyc_status"] != "approved":
        raise HTTPException(status_code=403, detail="KYC verification required")
    
    if current_user.get("wallet_htg", 0) < CARD_FEE_HTG:
        raise HTTPException(status_code=400, detail=f"Insufficient balance. Card fee is {CARD_FEE_HTG} HTG")
    
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$inc": {"wallet_htg": -CARD_FEE_HTG}}
    )
    
    order = {
        "order_id": str(uuid.uuid4()),
        "user_id": current_user["user_id"],
        "client_id": current_user["client_id"],
        "card_email": request.card_email.lower(),
        "fee": CARD_FEE_HTG,
        "status": "pending",
        "admin_notes": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "processed_at": None,
        "processed_by": None
    }
    
    await db.virtual_card_orders.insert_one(order)
    
    await db.transactions.insert_one({
        "transaction_id": str(uuid.uuid4()),
        "user_id": current_user["user_id"],
        "type": "card_order",
        "amount": -CARD_FEE_HTG,
        "currency": "HTG",
        "status": "completed",
        "description": "Virtual card order fee",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    await log_action(current_user["user_id"], "card_order", {"order_id": order["order_id"]})
    
    if "_id" in order:
        del order["_id"]
    return {"order": order, "message": "Card order submitted successfully"}

# ==================== TOP-UP ROUTES ====================

@api_router.post("/topup/order")
async def create_topup_order(request: TopUpOrder, current_user: dict = Depends(get_current_user)):
    db = get_db()
    if current_user["kyc_status"] != "approved":
        raise HTTPException(status_code=403, detail="KYC verification required")
    
    if current_user.get("wallet_usd", 0) < request.price:
        raise HTTPException(status_code=400, detail="Insufficient USD balance")
    
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$inc": {"wallet_usd": -request.price}}
    )
    
    order = {
        "order_id": str(uuid.uuid4()),
        "user_id": current_user["user_id"],
        "client_id": current_user["client_id"],
        "country": request.country,
        "country_name": request.country_name,
        "minutes": request.minutes,
        "price": request.price,
        "phone_number": request.phone_number,
        "status": "pending",
        "admin_notes": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "processed_at": None,
        "processed_by": None
    }
    
    await db.topup_orders.insert_one(order)
    
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
    db = get_db()
    orders = await db.topup_orders.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return {"orders": orders}

# ==================== EXCHANGE RATES ====================

@api_router.get("/exchange-rates")
async def get_exchange_rates():
    db = get_db()
    rates = await db.exchange_rates.find_one({"rate_id": "main"}, {"_id": 0})
    if not rates:
        rates = {
            "htg_to_usd": 0.0075, 
            "usd_to_htg": 133.0,
            "swap_htg_to_usd": 0.0074,
            "swap_usd_to_htg": 132.0
        }
    return rates

# ==================== PUBLIC ROUTES ====================

@api_router.get("/public/chat-settings")
async def get_public_chat_settings():
    db = get_db()
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

# ==================== ADMIN ROUTES ====================

@api_router.get("/admin/dashboard")
async def admin_dashboard(admin: dict = Depends(get_admin_user)):
    db = get_db()
    total_users = await db.users.count_documents({})
    pending_kyc = await db.kyc.count_documents({"status": "pending"})
    pending_deposits = await db.deposits.count_documents({"status": "pending"})
    pending_withdrawals = await db.withdrawals.count_documents({"status": "pending"})
    
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
    db = get_db()
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
    db = get_db()
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    kyc = await db.kyc.find_one({"user_id": user_id}, {"_id": 0})
    transactions = await db.transactions.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    
    return {"user": user, "kyc": kyc, "recent_transactions": transactions}

@api_router.patch("/admin/users/{user_id}/status")
async def admin_update_user_status(user_id: str, update: UserStatusUpdate, admin: dict = Depends(get_admin_user)):
    db = get_db()
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
    db = get_db()
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

@api_router.get("/admin/kyc")
async def admin_get_kyc_submissions(
    status: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    page: int = Query(default=1, ge=1),
    q: Optional[str] = None,
    admin: dict = Depends(get_admin_user)
):
    db = get_db()
    query = {}
    # Frontend uses `all` as a sentinel for "no status filter".
    if status and status != "all":
        query["status"] = status

    if q and q.strip():
        s = re.escape(q.strip())
        query["$or"] = [
            {"full_name": {"$regex": s, "$options": "i"}},
            {"client_id": {"$regex": s, "$options": "i"}},
            {"phone_number": {"$regex": s, "$options": "i"}},
            {"whatsapp_number": {"$regex": s, "$options": "i"}},
        ]
    
    # List view must be lightweight and stable: only include fields the admin table needs.
    # (Older records may contain large base64 blobs under different keys; projecting-in avoids 500s.)
    skip = (page - 1) * limit
    total_matches = await db.kyc.count_documents(query)
    submissions = await db.kyc.find(
        query,
        {
            "_id": 0,
            "kyc_id": 1,
            "user_id": 1,
            "client_id": 1,
            "full_name": 1,
            "nationality": 1,
            "id_type": 1,
            "submitted_at": 1,
            "status": 1,
        },
    ).sort("submitted_at", -1).skip(skip).limit(limit).to_list(limit)
    stats = {
        "pending": await db.kyc.count_documents({"status": "pending"}),
        "approved": await db.kyc.count_documents({"status": "approved"}),
        "rejected": await db.kyc.count_documents({"status": "rejected"}),
        "total": await db.kyc.count_documents({}),
    }
    return {
        "submissions": submissions,
        "stats": stats,
        "meta": {
            "page": page,
            "limit": limit,
            "total_matches": total_matches,
            "query": (q or "").strip() or None,
        },
    }

@api_router.get("/admin/kyc/{kyc_id}")
async def admin_get_kyc(
    kyc_id: str,
    admin: dict = Depends(get_admin_user)
):
    """
    Get a single KYC submission by id.
    Required by `frontend/src/pages/admin/AdminKYC.js` (View action).
    """
    db = get_db()
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
    db = get_db()
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


@api_router.post("/admin/kyc/migrate-images")
async def admin_migrate_kyc_images(
    limit: int = Query(default=25, le=100),
    dry_run: bool = Query(default=True),
    status: Optional[str] = None,
    admin: dict = Depends(get_admin_user),
):
    db = get_db()
    if not _cloudinary_is_configured():
        raise HTTPException(status_code=400, detail="Cloudinary is not configured (set CLOUDINARY_* env vars)")

    base_filter: Dict[str, Any] = {}
    if status and status != "all":
        base_filter["status"] = status

    needs_migrate = {
        "$or": [
            {"id_front_image": {"$regex": r"^data:image/", "$options": "i"}},
            {"id_back_image": {"$regex": r"^data:image/", "$options": "i"}},
            {"selfie_with_id": {"$regex": r"^data:image/", "$options": "i"}},
        ]
    }

    query: Dict[str, Any]
    if base_filter:
        query = {"$and": [base_filter, needs_migrate]}
    else:
        query = needs_migrate

    cursor = db.kyc.find(
        query,
        {
            "_id": 0,
            "kyc_id": 1,
            "user_id": 1,
            "id_front_image": 1,
            "id_back_image": 1,
            "selfie_with_id": 1,
            "image_meta": 1,
        },
    ).sort("submitted_at", -1).limit(limit)

    processed = 0
    migrated = 0
    errors: List[Dict[str, Any]] = []

    async for doc in cursor:
        processed += 1
        kyc_id = doc.get("kyc_id")
        user_id = doc.get("user_id")
        if not kyc_id or not user_id:
            continue

        update_fields: Dict[str, Any] = {}
        meta = dict(doc.get("image_meta") or {})

        for field_name in ("id_front_image", "id_back_image", "selfie_with_id"):
            val = doc.get(field_name)
            if not isinstance(val, str) or not val.lower().startswith("data:image/"):
                continue
            try:
                stored = await _kyc_store_image_value(val, user_id=user_id, kyc_id=kyc_id, field_name=field_name)
                if stored["value"] and stored["value"] != val:
                    update_fields[field_name] = stored["value"]
                    meta[field_name] = stored["meta"]
            except Exception as e:
                errors.append({"kyc_id": kyc_id, "field": field_name, "error": str(e)})

        if update_fields:
            update_fields["image_meta"] = meta
            update_fields["images_migrated_at"] = datetime.now(timezone.utc).isoformat()
            if not dry_run:
                await db.kyc.update_one({"kyc_id": kyc_id}, {"$set": update_fields})
            migrated += 1

    return {
        "dry_run": dry_run,
        "processed": processed,
        "migrated": migrated,
        "errors": errors[:20],
        "note": "Run again to continue migrating remaining records.",
    }

@api_router.get("/admin/deposits")
async def admin_get_deposits(
    status: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    admin: dict = Depends(get_admin_user)
):
    db = get_db()
    query = {}
    if status:
        query["status"] = status
    
    deposits = await db.deposits.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"deposits": deposits}

@api_router.patch("/admin/deposits/{deposit_id}")
async def admin_process_deposit(
    deposit_id: str,
    action: str,
    admin: dict = Depends(get_admin_user)
):
    db = get_db()
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

@api_router.get("/admin/withdrawals")
async def admin_get_withdrawals(
    status: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    admin: dict = Depends(get_admin_user)
):
    db = get_db()
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
    db = get_db()
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
        currency_key = f"wallet_{withdrawal['currency'].lower()}"
        await db.users.update_one(
            {"user_id": withdrawal["user_id"]},
            {"$inc": {currency_key: withdrawal["amount"]}}
        )
    
    await db.transactions.update_one(
        {"reference_id": withdrawal_id, "type": "withdrawal"},
        {"$set": {"status": new_status}}
    )
    
    await log_action(admin["user_id"], "withdrawal_process", {"withdrawal_id": withdrawal_id, "action": action})
    
    return {"message": f"Withdrawal {action}d successfully"}

@api_router.put("/admin/exchange-rates")
async def admin_update_exchange_rates(rates: ExchangeRateUpdate, admin: dict = Depends(get_admin_user)):
    db = get_db()
    update_data = {
        "htg_to_usd": rates.htg_to_usd,
        "usd_to_htg": rates.usd_to_htg,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": admin["user_id"]
    }
    
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

@api_router.get("/admin/fees")
async def admin_get_fees(admin: dict = Depends(get_admin_user)):
    db = get_db()
    fees = await db.fees.find({}, {"_id": 0}).to_list(100)
    return {"fees": fees}

@api_router.post("/admin/fees")
async def admin_create_fee(fee: FeeConfigUpdate, admin: dict = Depends(get_admin_user)):
    db = get_db()
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
    db = get_db()
    result = await db.fees.delete_one({"fee_id": fee_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Fee not found")
    
    await log_action(admin["user_id"], "fee_delete", {"fee_id": fee_id})
    
    return {"message": "Fee deleted"}

@api_router.get("/admin/withdrawal-limits")
async def admin_get_withdrawal_limits(admin: dict = Depends(get_admin_user)):
    db = get_db()
    limits = await db.withdrawal_limits.find({}, {"_id": 0}).to_list(100)
    return {"limits": limits}

@api_router.put("/admin/withdrawal-limits")
async def admin_update_withdrawal_limit(limit: WithdrawalLimitUpdate, admin: dict = Depends(get_admin_user)):
    db = get_db()
    await db.withdrawal_limits.update_one(
        {"method": limit.method},
        {"$set": limit.model_dump()},
        upsert=True
    )
    
    await log_action(admin["user_id"], "withdrawal_limit_update", limit.model_dump())
    
    return {"message": "Withdrawal limit updated"}

@api_router.get("/admin/settings")
async def admin_get_settings(admin: dict = Depends(get_admin_user)):
    db = get_db()
    settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
    defaults = {
        "setting_id": "main",
        # Email (Resend)
        "resend_enabled": False,
        "resend_api_key": "",
        "sender_email": "",

        # Live Chat (Crisp)
        "crisp_enabled": False,
        "crisp_website_id": "",

        # WhatsApp (CallMeBot)
        "whatsapp_enabled": False,
        "whatsapp_number": "",
        "callmebot_api_key": "",

        # Telegram
        "telegram_enabled": False,
        "telegram_bot_token": "",
        "telegram_chat_id": "",

        # USDT (Plisio)
        "plisio_enabled": False,
        "plisio_api_key": "",
        "plisio_secret_key": "",

        # Virtual Cards (Strowallet)
        "strowallet_enabled": False,
        "strowallet_base_url": os.environ.get("STROWALLET_BASE_URL", "") or "https://strowallet.com",
        "strowallet_api_key": "",
        "strowallet_api_secret": "",
        "strowallet_create_user_path": os.environ.get("STROWALLET_CREATE_USER_PATH", "") or "/api/bitvcard/card-user",
        "strowallet_create_card_path": os.environ.get("STROWALLET_CREATE_CARD_PATH", ""),
        "strowallet_fund_card_path": os.environ.get("STROWALLET_FUND_CARD_PATH", ""),
        "strowallet_withdraw_card_path": os.environ.get("STROWALLET_WITHDRAW_CARD_PATH", ""),
        "strowallet_fetch_card_detail_path": os.environ.get("STROWALLET_FETCH_CARD_DETAIL_PATH", "") or "/api/bitvcard/fetch-card-detail/",
        "strowallet_card_transactions_path": os.environ.get("STROWALLET_CARD_TRANSACTIONS_PATH", "") or "/api/bitvcard/card-transactions/",
        "strowallet_brand_name": os.environ.get("STROWALLET_BRAND_NAME", "") or "KAYICOM",
        "strowallet_mode": os.environ.get("STROWALLET_MODE", "") or "live",
        "strowallet_create_card_amount_usd": float(os.environ.get("STROWALLET_CREATE_CARD_AMOUNT_USD", "5") or "5"),
        "strowallet_freeze_unfreeze_path": os.environ.get("STROWALLET_FREEZE_UNFREEZE_PATH", ""),
        "strowallet_full_card_history_path": os.environ.get("STROWALLET_FULL_CARD_HISTORY_PATH", ""),
        "strowallet_withdraw_status_path": os.environ.get("STROWALLET_WITHDRAW_STATUS_PATH", ""),
        "strowallet_upgrade_limit_path": os.environ.get("STROWALLET_UPGRADE_LIMIT_PATH", ""),

        # Fees & Affiliate
        "card_order_fee_htg": 500,
        "affiliate_reward_htg": 2000,
        "affiliate_cards_required": 5,
        "card_background_image": None,
        "topup_fee_tiers": [],

        # Announcement bar
        "announcement_enabled": False,
        "announcement_text_ht": "",
        "announcement_text_fr": "",
        "announcement_text_en": "",
        "announcement_link": ""
    }

    if settings:
        for k, v in defaults.items():
            if k not in settings:
                settings[k] = v
    else:
        settings = defaults
    return {"settings": settings}

@api_router.put("/admin/settings")
async def admin_update_settings(settings: AdminSettingsUpdate, admin: dict = Depends(get_admin_user)):
    db = get_db()
    update_doc = {k: v for k, v in settings.model_dump().items() if v is not None}
    update_doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.settings.update_one(
        {"setting_id": "main"},
        {"$set": update_doc},
        upsert=True
    )
    
    await log_action(admin["user_id"], "settings_update", {"fields_updated": list(update_doc.keys())})
    
    return {"message": "Settings updated"}

@api_router.post("/admin/bulk-email")
async def admin_send_bulk_email(request: BulkEmailRequest, admin: dict = Depends(get_admin_user)):
    db = get_db()
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

@api_router.get("/admin/virtual-card-orders")
async def admin_get_card_orders(
    status: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    admin: dict = Depends(get_admin_user)
):
    db = get_db()
    query = {}
    if status:
        query["status"] = status
    
    orders = await db.virtual_card_orders.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"orders": orders}

@api_router.patch("/admin/virtual-card-orders/{order_id}")
async def admin_process_card_order(
    order_id: str,
    action: str,
    admin_notes: Optional[str] = None,
    admin: dict = Depends(get_admin_user)
):
    db = get_db()
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
        await db.users.update_one(
            {"user_id": order["user_id"]},
            {"$inc": {"wallet_usd": CARD_BONUS_USD}}
        )
        
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
    else:
        await db.users.update_one(
            {"user_id": order["user_id"]},
            {"$inc": {"wallet_htg": CARD_FEE_HTG}}
        )
        
        await db.transactions.insert_one({
            "transaction_id": str(uuid.uuid4()),
            "user_id": order["user_id"],
            "type": "card_order_refund",
            "amount": CARD_FEE_HTG,
            "currency": "HTG",
            "status": "completed",
            "description": "Virtual card order refund (rejected)",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    await log_action(admin["user_id"], "card_order_process", {"order_id": order_id, "action": action})
    
    return {"message": f"Card order {action}d successfully"}

@api_router.get("/admin/topup-orders")
async def admin_get_topup_orders(
    status: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    admin: dict = Depends(get_admin_user)
):
    db = get_db()
    query = {}
    if status:
        query["status"] = status
    
    orders = await db.topup_orders.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"orders": orders}

@api_router.patch("/admin/topup-orders/{order_id}")
async def admin_process_topup_order(
    order_id: str,
    action: str,
    admin_notes: Optional[str] = None,
    admin: dict = Depends(get_admin_user)
):
    db = get_db()
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
    
    await db.transactions.update_one(
        {"reference_id": order_id, "type": "topup_order"},
        {"$set": {"status": new_status}}
    )
    
    if action == "cancel":
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
            "description": "Top-up order refund (cancelled)",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    await log_action(admin["user_id"], "topup_order_process", {"order_id": order_id, "action": action})
    
    return {"message": f"Top-up order {action}d successfully"}

@api_router.get("/admin/logs")
async def admin_get_logs(
    user_id: Optional[str] = None,
    action: Optional[str] = None,
    limit: int = Query(default=100, le=500),
    admin: dict = Depends(get_admin_user)
):
    db = get_db()
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

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup event for creating indexes and default data
@app.on_event("startup")
async def startup():
    db = get_db()
    
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("client_id", unique=True)
    await db.users.create_index("affiliate_code", unique=True)
    await db.transactions.create_index([("user_id", 1), ("created_at", -1)])
    await db.deposits.create_index([("user_id", 1), ("status", 1)])
    await db.withdrawals.create_index([("user_id", 1), ("status", 1)])
    await db.kyc.create_index("user_id", unique=True)
    
    # Create default admin if not exists, or update existing admin email
    admin = await db.users.find_one({"is_admin": True}, {"_id": 0})
    if not admin:
        admin_doc = {
            "user_id": str(uuid.uuid4()),
            "client_id": "KCADMIN001",
            "email": "kayicom509@gmail.com",
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
        logger.info("Default admin created: kayicom509@gmail.com / Admin123!")
    else:
        # Update admin email if it's the old one
        if admin.get("email") == "admin@kayicom.com":
            await db.users.update_one(
                {"user_id": admin["user_id"]},
                {"$set": {"email": "kayicom509@gmail.com"}}
            )
            logger.info("Admin email updated from admin@kayicom.com to kayicom509@gmail.com")
    
    # Create default exchange rates
    rates = await db.exchange_rates.find_one({"rate_id": "main"}, {"_id": 0})
    if not rates:
        await db.exchange_rates.insert_one({
            "rate_id": "main",
            "htg_to_usd": 0.0075,
            "usd_to_htg": 133.0,
            "swap_htg_to_usd": 0.0074,
            "swap_usd_to_htg": 132.0,
            "updated_at": datetime.now(timezone.utc).isoformat()
        })

# Export handler for Vercel
handler = app
