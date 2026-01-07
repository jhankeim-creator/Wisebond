from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, Query, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import Any, Dict, List, Literal, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
from jose import jwt, JWTError
import secrets
import base64
import httpx
import re

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
db_name = os.environ.get('DB_NAME', 'wisebond')

# Ensure database name is in connection string for proper authentication
# MongoDB Atlas requires authSource parameter or database in path
if 'mongodb+srv://' in mongo_url or 'mongodb://' in mongo_url:
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

client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET', secrets.token_urlsafe(32))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: str
    language: str = "fr"
    referral_code: Optional[str] = None

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
    telegram_chat_id: Optional[str] = None

class PasswordReset(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str

class ProfileUpdate(BaseModel):
    telegram_chat_id: Optional[str] = None

PaymentGatewayPaymentType = Literal["deposit", "withdrawal"]
PaymentGatewayStatus = Literal["active", "inactive"]
PaymentGatewayFeeType = Literal["fixed", "percentage"]
PaymentGatewayFieldType = Literal[
    "text",
    "number",
    "email",
    "phone",
    "textarea",
    "select",
    "checkbox",
    "file",
]


class PaymentGatewayCustomField(BaseModel):
    field_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    key: str = Field(min_length=1, max_length=64)  # stable key used in submissions
    label: str = Field(min_length=1, max_length=128)
    type: PaymentGatewayFieldType
    required: bool = False
    placeholder: Optional[str] = None
    help_text: Optional[str] = None
    options: Optional[List[str]] = None  # for select
    accept: Optional[str] = None  # for file (e.g. "image/*")


class PaymentGatewayDisplayConfig(BaseModel):
    instructions: Optional[str] = None
    recipient_details: Optional[str] = None
    qr_image: Optional[str] = None  # data URL (base64)


class PaymentGatewayWithdrawalConfig(BaseModel):
    processing_time: Optional[str] = None  # e.g. "1–24 hours"
    processing_mode: Optional[Literal["manual", "automatic"]] = "manual"
    admin_approval_required: Optional[bool] = True


class PaymentGatewayMethodUpsert(BaseModel):
    payment_method_name: str = Field(min_length=1, max_length=128)
    payment_type: PaymentGatewayPaymentType
    status: PaymentGatewayStatus = "inactive"
    supported_currencies: List[Literal["HTG", "USD"]] = Field(default_factory=list)
    minimum_amount: float = 0.0
    maximum_amount: float = 0.0
    fee_type: PaymentGatewayFeeType = "fixed"
    fee_value: float = 0.0
    display: Optional[PaymentGatewayDisplayConfig] = None
    custom_fields: List[PaymentGatewayCustomField] = Field(default_factory=list)
    withdrawal_config: Optional[PaymentGatewayWithdrawalConfig] = None


class DepositRequest(BaseModel):
    amount: float
    currency: str
    payment_method_id: str
    field_values: Dict[str, Any] = Field(default_factory=dict)


class WithdrawalRequest(BaseModel):
    amount: float
    currency: str
    payment_method_id: str
    field_values: Dict[str, Any] = Field(default_factory=dict)
    source_currency: Optional[str] = None  # for cross-currency withdrawals

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

    # Live Chat (Crisp)
    crisp_enabled: Optional[bool] = None
    crisp_website_id: Optional[str] = None

    # WhatsApp (CallMeBot - free)
    whatsapp_enabled: Optional[bool] = None
    whatsapp_number: Optional[str] = None
    callmebot_api_key: Optional[str] = None
    
    # Telegram Bot (free, unlimited) - RECOMMENDED
    telegram_enabled: Optional[bool] = None
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None

    # USDT (Plisio)
    plisio_enabled: Optional[bool] = None
    plisio_api_key: Optional[str] = None
    plisio_secret_key: Optional[str] = None

    # Fees & Affiliate (optional, UI-configurable)
    card_order_fee_htg: Optional[int] = None
    affiliate_reward_htg: Optional[int] = None
    affiliate_cards_required: Optional[int] = None
    
    # Manual HTG deposits
    moncash_enabled: Optional[bool] = None
    moncash_number: Optional[str] = None
    moncash_name: Optional[str] = None
    moncash_qr: Optional[str] = None
    natcash_enabled: Optional[bool] = None
    natcash_number: Optional[str] = None
    natcash_name: Optional[str] = None
    natcash_qr: Optional[str] = None
    
    # USD payment methods
    zelle_email: Optional[str] = None
    zelle_name: Optional[str] = None
    paypal_email: Optional[str] = None
    paypal_name: Optional[str] = None

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

# ==================== AGENT DEPOSIT MODELS ====================

class AgentDepositRequest(BaseModel):
    client_phone_or_id: str  # Client phone number or client ID
    amount_usd: float  # Amount in USD to deposit
    amount_htg_received: float  # Amount in Gourdes received from client
    proof_image: Optional[str] = None  # Payment proof image

class CommissionTier(BaseModel):
    min: float  # Minimum amount
    max: float  # Maximum amount
    commission: float  # Commission amount or percentage
    is_percentage: bool = False  # If true, commission is a percentage

class AgentSettingsUpdate(BaseModel):
    agent_deposit_enabled: Optional[bool] = None
    agent_rate_usd_to_htg: Optional[float] = None  # Rate for how many HTG per 1 USD
    agent_whatsapp_notifications: Optional[bool] = None
    commission_tiers: Optional[List[dict]] = None  # List of commission tiers

class AgentRechargeRequest(BaseModel):
    agent_user_id: str
    amount_usd: float
    reason: str

class ClientReportRequest(BaseModel):
    client_phone_or_id: str
    reason: str
    details: Optional[str] = None

class ClientLookupRequest(BaseModel):
    identifier: str  # Phone or client ID

class UserInfoUpdate(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    full_name: Optional[str] = None

class CardApprovalWithDetails(BaseModel):
    card_name: Optional[str] = None
    card_last4: Optional[str] = None
    admin_notes: Optional[str] = None

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
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
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
    """Send email notification using Resend"""
    try:
        settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
        
        # Check if Resend is enabled (handle both boolean and string values)
        resend_enabled = False
        if settings:
            resend_enabled_val = settings.get("resend_enabled", False)
            # Handle string "true"/"True" or boolean True
            if isinstance(resend_enabled_val, bool):
                resend_enabled = resend_enabled_val
            elif isinstance(resend_enabled_val, str):
                resend_enabled = resend_enabled_val.lower() in ("true", "1", "yes")
            elif isinstance(resend_enabled_val, (int, float)):
                resend_enabled = bool(resend_enabled_val)
            
            if not resend_enabled:
                logger.info(f"Resend email disabled in settings (value: {resend_enabled_val}, type: {type(resend_enabled_val).__name__})")
                return False
        else:
            # If no settings, check environment variable
            if not os.environ.get("RESEND_API_KEY"):
                logger.info("Resend not configured - no settings found and no RESEND_API_KEY env var")
                return False

        resend_key = (settings.get("resend_api_key") if settings else None) or os.environ.get("RESEND_API_KEY")
        sender = (settings.get("sender_email") if settings else None) or os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
        
        if not resend_key or resend_key.strip() == "":
            logger.warning("Resend API key not configured or empty")
            return False
        
        if not sender or sender.strip() == "":
            logger.warning("Sender email not configured or empty")
            return False
        
        # Import resend and set API key
        try:
            import resend
        except ImportError:
            logger.error("Resend package not installed. Run: pip install resend")
            return False
        
        resend.api_key = resend_key.strip()
        
        params = {
            "from": sender.strip(),
            "to": [to_email.strip()],
            "subject": subject,
            "html": html_content
        }
        
        logger.info(f"Attempting to send email to {to_email} from {sender.strip()}")
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Email sent successfully to {to_email}. Result: {result}")
        return True
    except Exception as e:
        error_msg = str(e)
        error_type = type(e).__name__
        logger.error(f"Failed to send email to {to_email}: {error_type}: {error_msg}")
        logger.exception("Full traceback:")
        return False

async def send_telegram_notification(message: str, chat_id: Optional[str] = None):
    """Send Telegram notification using bot
    
    Args:
        message: The message to send
        chat_id: Optional chat ID. If not provided, uses the default chat_id from settings
    """
    import httpx
    
    try:
        settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
        if not settings or not settings.get("telegram_enabled"):
            return False
        
        bot_token = settings.get("telegram_bot_token")
        
        # Use provided chat_id or fall back to settings chat_id
        if not chat_id:
            chat_id = settings.get("telegram_chat_id")
        
        if not bot_token or not chat_id:
            logger.warning("Telegram bot token or chat_id not configured")
            return False
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://api.telegram.org/bot{bot_token}/sendMessage",
                json={
                    "chat_id": chat_id,
                    "text": message,
                    "parse_mode": "HTML"
                },
                timeout=30.0
            )
            
            if response.status_code == 200:
                logger.info(f"Telegram notification sent successfully to chat_id: {chat_id}")
                return True
            else:
                logger.error(f"Telegram error: {response.text}")
                return False
    except Exception as e:
        logger.error(f"Failed to send Telegram notification: {e}")
        return False

async def send_whatsapp_notification(phone_number: str, message: str):
    """Send WhatsApp notification using CallMeBot (free)"""
    import httpx
    
    try:
        settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
        if not settings or not settings.get("whatsapp_enabled"):
            logger.info("WhatsApp notifications disabled in settings")
            return False
        
        # Clean phone number (remove spaces, dashes)
        clean_phone = phone_number.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
        if not clean_phone.startswith("+"):
            clean_phone = "+509" + clean_phone  # Default to Haiti
        
        # Remove + for API calls
        phone_for_api = clean_phone.replace("+", "")
        
        notification_id = str(uuid.uuid4())
        notification_status = "pending"
        api_response = None
        
        # CallMeBot API (free, requires user to activate first)
        # User must first send: "I allow callmebot to send me messages" to +34 644 71 67 43
        api_key = settings.get("callmebot_api_key")
        
        if api_key:
            encoded_message = message.replace(" ", "+").replace("\n", "%0A")
            url = f"https://api.callmebot.com/whatsapp.php?phone={phone_for_api}&text={encoded_message}&apikey={api_key}"
            
            async with httpx.AsyncClient() as client:
                response = await client.get(url, timeout=30.0)
                api_response = response.text
                if response.status_code == 200 and "Message queued" in response.text:
                    notification_status = "sent"
                    logger.info(f"WhatsApp sent via CallMeBot to {clean_phone}")
                else:
                    notification_status = "failed"
                    logger.error(f"CallMeBot error: {response.text}")
        else:
            logger.warning(f"No CallMeBot API key configured")
            notification_status = "not_configured"
        
        # Store notification for tracking
        await db.whatsapp_notifications.insert_one({
            "notification_id": notification_id,
            "phone_number": clean_phone,
            "message": message,
            "status": notification_status,
            "provider": "callmebot",
            "api_response": api_response,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return notification_status == "sent"
    except Exception as e:
        logger.error(f"Failed to send WhatsApp notification: {e}")
        return False

# Default commission tiers (can be overridden in database)
DEFAULT_COMMISSION_TIERS = [
    {"min": 5, "max": 19.99, "commission": 1.0, "is_percentage": False},
    {"min": 20, "max": 39.99, "commission": 1.2, "is_percentage": False},
    {"min": 40, "max": 99.99, "commission": 1.3, "is_percentage": False},
    {"min": 100, "max": 199.99, "commission": 1.8, "is_percentage": False},
    {"min": 200, "max": 299.99, "commission": 3.0, "is_percentage": False},
    {"min": 300, "max": 399.99, "commission": 4.5, "is_percentage": False},
    {"min": 400, "max": 499.99, "commission": 5.0, "is_percentage": False},
    {"min": 500, "max": 599.99, "commission": 6.0, "is_percentage": False},
    {"min": 600, "max": 1499.99, "commission": 7.0, "is_percentage": False},
    {"min": 1500, "max": 999999, "commission": 1.0, "is_percentage": True}  # 1%
]

async def get_commission_tiers():
    """Get commission tiers from database or return defaults"""
    settings = await db.agent_settings.find_one({"setting_id": "main"}, {"_id": 0})
    if settings and settings.get("commission_tiers"):
        return settings.get("commission_tiers")
    return DEFAULT_COMMISSION_TIERS

async def calculate_agent_commission_async(amount_usd: float) -> float:
    """Calculate agent commission based on configurable tiered structure"""
    if amount_usd < 5:
        return 0.0
    
    tiers = await get_commission_tiers()
    
    for tier in tiers:
        if tier["min"] <= amount_usd <= tier["max"]:
            if tier.get("is_percentage", False):
                return round(amount_usd * (tier["commission"] / 100), 2)
            else:
                return tier["commission"]
    
    # Fallback: 1% for any amount not covered
    return round(amount_usd * 0.01, 2)

def calculate_agent_commission_sync(amount_usd: float, tiers: list) -> float:
    """Synchronous version for use when tiers are already loaded"""
    if amount_usd < 5:
        return 0.0
    
    for tier in tiers:
        if tier["min"] <= amount_usd <= tier["max"]:
            if tier.get("is_percentage", False):
                return round(amount_usd * (tier["commission"] / 100), 2)
            else:
                return tier["commission"]
    
    return round(amount_usd * 0.01, 2)

async def get_commission_tier_label(amount_usd: float) -> str:
    """Get the commission tier description for display"""
    if amount_usd < 5:
        return "Pa kalifye (minimòm $5)"
    
    tiers = await get_commission_tiers()
    
    for tier in tiers:
        if tier["min"] <= amount_usd <= tier["max"]:
            if tier.get("is_percentage", False):
                return f"${tier['min']}+ → {tier['commission']}%"
            else:
                return f"${tier['min']}-${tier['max']:.0f} → ${tier['commission']}"
    
    return "1%"

async def get_agent_user(current_user: dict = Depends(get_current_user)):
    """Verify user is an approved agent"""
    if not current_user.get("is_agent"):
        raise HTTPException(status_code=403, detail="Agent access required")
    if current_user.get("kyc_status") != "approved":
        raise HTTPException(status_code=403, detail="KYC verification required for agents")
    return current_user

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register")
async def register(user: UserCreate):
    existing = await db.users.find_one({"email": user.email.lower()}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    client_id = generate_client_id()
    
    # Process referral code if provided
    referred_by = None
    if user.referral_code:
        referrer = await db.users.find_one({"affiliate_code": user.referral_code}, {"_id": 0})
        if referrer:
            if referrer["user_id"] != user_id:  # Can't refer yourself (though user_id doesn't exist yet, this is a safety check)
                referred_by = user.referral_code
            else:
                logger.warning(f"User tried to refer themselves with code {user.referral_code}")
        else:
            logger.warning(f"Invalid referral code provided: {user.referral_code}")
    
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
        "referred_by": referred_by,
        "is_active": True,
        "is_admin": False,
        "two_factor_enabled": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    await log_action(user_id, "register", {"email": user.email, "referred_by": referred_by})
    
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
    
    reset_link = f"{os.environ.get('FRONTEND_URL', 'https://wallet.kayicom.com')}/reset-password?token={reset_token}"
    
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

@api_router.patch("/profile")
async def update_profile(
    update: ProfileUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update user profile (Telegram chat ID, etc.)"""
    update_doc = {}
    
    if update.telegram_chat_id is not None:
        update_doc["telegram_chat_id"] = update.telegram_chat_id
    
    if update_doc:
        await db.users.update_one(
            {"user_id": current_user["user_id"]},
            {"$set": update_doc}
        )
        await log_action(current_user["user_id"], "profile_update", update_doc)
    
    # Return updated user
    updated_user = await db.users.find_one({"user_id": current_user["user_id"]}, {"_id": 0, "password_hash": 0})
    return {"user": updated_user, "message": "Profile updated successfully"}

@api_router.post("/telegram/generate-activation-code")
async def generate_telegram_activation_code(current_user: dict = Depends(get_current_user)):
    """Generate a unique activation code for Telegram bot activation"""
    import secrets
    
    # Generate a unique 8-character activation code
    activation_code = secrets.token_urlsafe(6).upper().replace('_', '').replace('-', '')[:8]
    
    # Store activation code with user_id and expiration (24 hours)
    activation_doc = {
        "activation_code": activation_code,
        "user_id": current_user["user_id"],
        "client_id": current_user["client_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(),
        "used": False
    }
    
    await db.telegram_activations.insert_one(activation_doc)
    
    return {
        "activation_code": activation_code,
        "bot_username": None,  # Will be filled from settings
        "message": "Activation code generated. Send /start CODE to the bot on Telegram."
    }

@api_router.post("/telegram/webhook")
async def telegram_webhook(request: dict):
    """Webhook endpoint for Telegram bot to receive updates"""
    import httpx
    
    try:
        # Get update from Telegram
        if "message" not in request:
            return {"ok": True}
        
        message = request["message"]
        chat_id = str(message["chat"]["id"])
        text = message.get("text", "").strip()
        
        # Check if it's a /start command with activation code
        if text.startswith("/start"):
            parts = text.split()
            activation_code = parts[1] if len(parts) > 1 else None
            
            if activation_code:
                # Find activation code in database
                activation = await db.telegram_activations.find_one(
                    {
                        "activation_code": activation_code.upper(),
                        "used": False
                    },
                    {"_id": 0}
                )
                
                if activation:
                    # Check if expired
                    expires_at = datetime.fromisoformat(activation["expires_at"])
                    if datetime.now(timezone.utc) > expires_at:
                        # Send expired message
                        settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
                        bot_token = settings.get("telegram_bot_token") if settings else None
                        
                        if bot_token:
                            async with httpx.AsyncClient() as client:
                                await client.post(
                                    f"https://api.telegram.org/bot{bot_token}/sendMessage",
                                    json={
                                        "chat_id": chat_id,
                                        "text": "❌ Activation code has expired. Please generate a new one from your account settings."
                                    }
                                )
                        return {"ok": True}
                    
                    # Update user with chat_id
                    await db.users.update_one(
                        {"user_id": activation["user_id"]},
                        {"$set": {"telegram_chat_id": chat_id}}
                    )
                    
                    # Mark activation as used
                    await db.telegram_activations.update_one(
                        {"activation_code": activation_code.upper()},
                        {"$set": {"used": True, "activated_at": datetime.now(timezone.utc).isoformat()}}
                    )
                    
                    # Get user info
                    user = await db.users.find_one({"user_id": activation["user_id"]}, {"_id": 0, "full_name": 1, "client_id": 1})
                    
                    # Send success message
                    settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
                    bot_token = settings.get("telegram_bot_token") if settings else None
                    
                    if bot_token:
                        user_name = user.get("full_name", "User") if user else "User"
                        client_id = user.get("client_id", "") if user else ""
                        async with httpx.AsyncClient() as client:
                            await client.post(
                                f"https://api.telegram.org/bot{bot_token}/sendMessage",
                                json={
                                    "chat_id": chat_id,
                                    "text": f"✅ <b>Telegram Notifications Activated!</b>\n\nHello {user_name}!\n\nYour Telegram notifications have been successfully activated. You will now receive notifications for:\n• Agent deposit approvals\n• Transaction updates\n\nYour Client ID: <code>{client_id}</code>\n\nThank you for using KAYICOM! 🎉",
                                    "parse_mode": "HTML"
                                }
                            )
                    
                    await log_action(activation["user_id"], "telegram_activated", {"chat_id": chat_id})
                else:
                    # Invalid activation code
                    settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
                    bot_token = settings.get("telegram_bot_token") if settings else None
                    
                    if bot_token:
                        async with httpx.AsyncClient() as client:
                            await client.post(
                                f"https://api.telegram.org/bot{bot_token}/sendMessage",
                                json={
                                    "chat_id": chat_id,
                                    "text": "❌ Invalid activation code. Please check your code and try again, or generate a new one from your account settings."
                                }
                            )
            else:
                # /start without code - send instructions
                settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
                bot_token = settings.get("telegram_bot_token") if settings else None
                
                if bot_token:
                    async with httpx.AsyncClient() as client:
                        await client.post(
                            f"https://api.telegram.org/bot{bot_token}/sendMessage",
                            json={
                                "chat_id": chat_id,
                                "text": "👋 Welcome to KAYICOM Telegram Notifications!\n\nTo activate notifications:\n1. Go to your account settings\n2. Click 'Activate Telegram'\n3. Send /start YOUR_CODE to this bot\n\nExample: /start ABC12345"
                            }
                        )
        
        return {"ok": True}
    except Exception as e:
        logger.error(f"Telegram webhook error: {e}")
        return {"ok": False, "error": str(e)}

@api_router.get("/telegram/activation-status")
async def get_telegram_activation_status(current_user: dict = Depends(get_current_user)):
    """Get current Telegram activation status and any pending activation codes"""
    # Check if user has active activation code
    active_activation = await db.telegram_activations.find_one(
        {
            "user_id": current_user["user_id"],
            "used": False
        },
        {"_id": 0}
    )
    
    # Check expiration
    if active_activation:
        expires_at = datetime.fromisoformat(active_activation["expires_at"])
        if datetime.now(timezone.utc) > expires_at:
            active_activation = None
    
    return {
        "activated": bool(current_user.get("telegram_chat_id")),
        "chat_id": current_user.get("telegram_chat_id"),
        "activation_code": active_activation["activation_code"] if active_activation else None,
        "expires_at": active_activation["expires_at"] if active_activation else None
    }

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

    currency = request.currency.upper()
    if currency not in ["HTG", "USD"]:
        raise HTTPException(status_code=400, detail="Invalid currency")

    method = await db.payment_gateway_methods.find_one(
        {"payment_method_id": request.payment_method_id, "payment_type": "deposit"},
        {"_id": 0},
    )
    if not method or method.get("status") != "active":
        raise HTTPException(status_code=400, detail="Selected deposit method is not available")

    if currency not in method.get("supported_currencies", []):
        raise HTTPException(status_code=400, detail="Selected deposit method does not support this currency")

    min_amount = float(method.get("minimum_amount") or 0)
    max_amount = float(method.get("maximum_amount") or 0)
    if min_amount and request.amount < min_amount:
        raise HTTPException(status_code=400, detail=f"Minimum deposit is {min_amount}")
    if max_amount and request.amount > max_amount:
        raise HTTPException(status_code=400, detail=f"Maximum deposit is {max_amount}")

    # Validate required custom fields
    submitted = request.field_values or {}
    for f in method.get("custom_fields", []):
        key = f.get("key")
        if not key:
            continue
        if f.get("required"):
            if key not in submitted:
                raise HTTPException(status_code=400, detail=f"Missing required field: {f.get('label') or key}")
            if f.get("type") == "checkbox" and submitted.get(key) is not True:
                raise HTTPException(status_code=400, detail=f"Field must be checked: {f.get('label') or key}")
            if f.get("type") == "file" and not str(submitted.get(key) or "").startswith("data:"):
                raise HTTPException(status_code=400, detail=f"Missing required file: {f.get('label') or key}")

    fee_type = method.get("fee_type", "fixed")
    fee_value = float(method.get("fee_value") or 0)
    fee = (request.amount * (fee_value / 100.0)) if fee_type == "percentage" else fee_value
    fee = max(0.0, float(fee))
    net_amount = max(0.0, float(request.amount - fee))

    deposit_id = str(uuid.uuid4())
    deposit = {
        "deposit_id": deposit_id,
        "user_id": current_user["user_id"],
        "client_id": current_user["client_id"],
        "payment_method_id": request.payment_method_id,
        "payment_method_name": method.get("payment_method_name"),
        "payment_method_snapshot": {
            "payment_method_id": method.get("payment_method_id"),
            "payment_method_name": method.get("payment_method_name"),
            "payment_type": "deposit",
            "fee_type": fee_type,
            "fee_value": fee_value,
            "minimum_amount": min_amount,
            "maximum_amount": max_amount,
            "supported_currencies": method.get("supported_currencies", []),
        },
        "amount": float(request.amount),
        "fee": fee,
        "net_amount": net_amount,
        "currency": currency,
        "field_values": submitted,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.deposits.insert_one(deposit)
    await log_action(
        current_user["user_id"],
        "deposit_request",
        {"amount": request.amount, "payment_method_id": request.payment_method_id},
    )

    if "_id" in deposit:
        del deposit["_id"]
    return {"deposit": deposit}

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

    target_currency = request.currency.upper()
    if target_currency not in ["HTG", "USD"]:
        raise HTTPException(status_code=400, detail="Invalid currency")

    method = await db.payment_gateway_methods.find_one(
        {"payment_method_id": request.payment_method_id, "payment_type": "withdrawal"},
        {"_id": 0},
    )
    if not method or method.get("status") != "active":
        raise HTTPException(status_code=400, detail="Selected withdrawal method is not available")

    if target_currency not in method.get("supported_currencies", []):
        raise HTTPException(status_code=400, detail="Selected withdrawal method does not support this currency")

    min_amount = float(method.get("minimum_amount") or 0)
    max_amount = float(method.get("maximum_amount") or 0)
    if min_amount and request.amount < min_amount:
        raise HTTPException(status_code=400, detail=f"Minimum withdrawal is {min_amount}")
    if max_amount and request.amount > max_amount:
        raise HTTPException(status_code=400, detail=f"Maximum withdrawal is {max_amount}")

    # Validate required custom fields
    submitted = request.field_values or {}
    for f in method.get("custom_fields", []):
        key = f.get("key")
        if not key:
            continue
        if f.get("required"):
            if key not in submitted:
                raise HTTPException(status_code=400, detail=f"Missing required field: {f.get('label') or key}")
            if f.get("type") == "checkbox" and submitted.get(key) is not True:
                raise HTTPException(status_code=400, detail=f"Field must be checked: {f.get('label') or key}")
            if f.get("type") == "file" and not str(submitted.get(key) or "").startswith("data:"):
                raise HTTPException(status_code=400, detail=f"Missing required file: {f.get('label') or key}")

    fee_type = method.get("fee_type", "fixed")
    fee_value = float(method.get("fee_value") or 0)
    fee = (request.amount * (fee_value / 100.0)) if fee_type == "percentage" else fee_value
    fee = max(0.0, float(fee))
    net_amount = max(0.0, float(request.amount - fee))

    # Determine source and target currencies (cross-currency withdrawals supported)
    source_currency = (request.source_currency or request.currency).upper()
    if source_currency not in ["HTG", "USD"]:
        raise HTTPException(status_code=400, detail="Invalid source currency")

    rates = await db.exchange_rates.find_one({"rate_id": "main"}, {"_id": 0})
    if not rates:
        rates = {"htg_to_usd": 0.0075, "usd_to_htg": 133.0}

    if source_currency == target_currency:
        amount_to_deduct = float(request.amount)
        exchange_rate_used = 1
    elif source_currency == "USD" and target_currency == "HTG":
        amount_to_deduct = float(request.amount) * float(rates["htg_to_usd"])
        exchange_rate_used = float(rates["htg_to_usd"])
    else:
        amount_to_deduct = float(request.amount) * float(rates["usd_to_htg"])
        exchange_rate_used = float(rates["usd_to_htg"])

    source_key = f"wallet_{source_currency.lower()}"
    if current_user.get(source_key, 0) < amount_to_deduct:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    withdrawal_cfg = method.get("withdrawal_config") or {}
    withdrawal_id = str(uuid.uuid4())
    withdrawal = {
        "withdrawal_id": withdrawal_id,
        "user_id": current_user["user_id"],
        "client_id": current_user["client_id"],
        "payment_method_id": request.payment_method_id,
        "payment_method_name": method.get("payment_method_name"),
        "payment_method_snapshot": {
            "payment_method_id": method.get("payment_method_id"),
            "payment_method_name": method.get("payment_method_name"),
            "payment_type": "withdrawal",
            "fee_type": fee_type,
            "fee_value": fee_value,
            "minimum_amount": min_amount,
            "maximum_amount": max_amount,
            "supported_currencies": method.get("supported_currencies", []),
            "withdrawal_config": withdrawal_cfg,
        },
        "amount": float(request.amount),
        "fee": fee,
        "net_amount": net_amount,
        "currency": target_currency,
        "source_currency": source_currency,
        "amount_deducted": amount_to_deduct,
        "exchange_rate_used": exchange_rate_used,
        "field_values": submitted,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$inc": {source_key: -amount_to_deduct}},
    )
    await db.withdrawals.insert_one(withdrawal)

    description = f"Withdrawal via {method.get('payment_method_name') or 'method'}"
    if source_currency != target_currency:
        description += f" (converted from {source_currency})"

    await db.transactions.insert_one(
        {
            "transaction_id": str(uuid.uuid4()),
            "user_id": current_user["user_id"],
            "type": "withdrawal",
            "amount": -amount_to_deduct,
            "currency": source_currency,
            "target_amount": float(request.amount),
            "target_currency": target_currency,
            "reference_id": withdrawal_id,
            "status": "pending",
            "description": description,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )

    await log_action(
        current_user["user_id"],
        "withdrawal_request",
        {
            "amount": request.amount,
            "payment_method_id": request.payment_method_id,
            "source_currency": source_currency,
            "target_currency": target_currency,
        },
    )

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
    fees = await db.fees.find({}, {"_id": 0}).to_list(100)
    limits = await db.withdrawal_limits.find({}, {"_id": 0}).to_list(100)
    card_fees = await db.card_fees.find({}, {"_id": 0}).sort("min_amount", 1).to_list(100)
    return {"fees": fees, "limits": limits, "card_fees": card_fees}

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
    
    # Send email notification
    user_email = current_user.get("email")
    if user_email:
        subject = "KAYICOM - Currency Swap Completed"
        content = f"""
        <h2>Currency Swap Completed</h2>
        <p>Hello {current_user.get('full_name', 'User')},</p>
        <p>Your currency swap has been completed successfully.</p>
        <p><strong>From:</strong> {request.amount} {from_currency}</p>
        <p><strong>To:</strong> {converted_amount} {to_currency}</p>
        <p><strong>Rate Used:</strong> {rate_used}</p>
        <p>Transaction ID: <code>{swap_id}</code></p>
        <p>Thank you for using KAYICOM!</p>
        """
        await send_email(user_email, subject, content)
    
    return {
        "swap_id": swap_id,
        "from_amount": request.amount,
        "from_currency": from_currency,
        "to_amount": converted_amount,
        "to_currency": to_currency,
        "rate_used": rate_used
    }

# ==================== TRANSFER ROUTES ====================

@api_router.post("/transfers/lookup-recipient")
async def lookup_recipient(request: dict, current_user: dict = Depends(get_current_user)):
    """Lookup recipient by client ID for transfers"""
    client_id = (request.get("client_id") or request.get("identifier", "")).upper().strip()
    
    if not client_id:
        raise HTTPException(status_code=400, detail="Client ID required")
    
    # Find user by client_id
    user = await db.users.find_one(
        {"client_id": client_id},
        {"_id": 0, "user_id": 1, "client_id": 1, "full_name": 1, "email": 1, "is_active": 1, "kyc_status": 1}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="Client not found")
    
    if not user.get("is_active", True):
        raise HTTPException(status_code=400, detail="Client account is inactive")
    
    if user.get("kyc_status") != "approved":
        raise HTTPException(status_code=400, detail="Recipient KYC not approved")
    
    # Don't return sensitive info, just what's needed for display
    return {
        "client_id": user["client_id"],
        "full_name": user.get("full_name", "User"),
        "email": user.get("email", ""),
        "kyc_status": user.get("kyc_status", "pending")
    }

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
    if current_user.get(currency_key, 0) < request.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    # Get transfer fee config
    fee = 0
    fee_config = await db.fees.find_one({"method": "internal_transfer"}, {"_id": 0})
    if fee_config:
        if fee_config.get("fee_type") == "percentage":
            fee = request.amount * (fee_config["fee_value"] / 100)
        else:
            fee = fee_config["fee_value"]
    
    transfer_id = str(uuid.uuid4())
    
    # Deduct from sender
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$inc": {currency_key: -(request.amount + fee)}}
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
    
    # Send email notifications to both sender and recipient
    sender_email = current_user.get("email")
    recipient_email = recipient.get("email")
    
    if sender_email:
        subject = "KAYICOM - Transfer Sent"
        content = f"""
        <h2>Transfer Sent</h2>
        <p>Hello {current_user.get('full_name', 'User')},</p>
        <p>You have successfully sent <strong>{request.amount} {request.currency}</strong> to <strong>{request.recipient_client_id}</strong>.</p>
        <p>Fee: <strong>{fee} {request.currency}</strong></p>
        <p>Transaction ID: <code>{transfer_id}</code></p>
        <p>Thank you for using KAYICOM!</p>
        """
        await send_email(sender_email, subject, content)
    
    if recipient_email:
        subject = "KAYICOM - Transfer Received"
        content = f"""
        <h2>Transfer Received</h2>
        <p>Hello {recipient.get('full_name', 'User')},</p>
        <p>You have received <strong>{request.amount} {request.currency}</strong> from <strong>{current_user['client_id']}</strong>.</p>
        <p>Transaction ID: <code>{transfer_id}</code></p>
        <p>Thank you for using KAYICOM!</p>
        """
        await send_email(recipient_email, subject, content)
    
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
    
    # Get affiliate settings
    settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
    affiliate_cards_required = settings.get("affiliate_cards_required", 5) if settings else 5
    affiliate_reward_htg = settings.get("affiliate_reward_htg", 2000) if settings else 2000
    
    # Construct link - always use production URL
    frontend_url = os.environ.get('FRONTEND_URL', 'https://wallet.kayicom.com')
    
    return {
        "affiliate_code": current_user["affiliate_code"],
        "affiliate_link": f"{frontend_url}/register?ref={current_user['affiliate_code']}",
        "earnings": current_user.get("affiliate_earnings", 0),
        "referrals": enriched_referrals,
        "referrals_with_cards": referrals_with_cards,
        "affiliate_cards_required": affiliate_cards_required,
        "affiliate_reward_htg": affiliate_reward_htg
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
    
    # Get card fee from settings
    settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
    card_fee_htg = settings.get("card_order_fee_htg", CARD_FEE_HTG) if settings else CARD_FEE_HTG
    
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

class CardTopUpRequest(BaseModel):
    order_id: str
    amount: float

@api_router.post("/virtual-cards/top-up")
async def top_up_virtual_card(request: CardTopUpRequest, current_user: dict = Depends(get_current_user)):
    """Submit a card top-up request - deducts from USD balance, admin delivers to card"""
    if current_user["kyc_status"] != "approved":
        raise HTTPException(status_code=403, detail="KYC verification required")
    
    # Verify the card order exists and belongs to user
    card_order = await db.virtual_card_orders.find_one({
        "order_id": request.order_id,
        "user_id": current_user["user_id"],
        "status": "approved"
    }, {"_id": 0})
    
    if not card_order:
        raise HTTPException(status_code=404, detail="Card not found or not approved")
    
    if request.amount < 5:
        raise HTTPException(status_code=400, detail="Minimum amount is $5")
    
    # Calculate fee based on card fees
    card_fees = await db.card_fees.find({}, {"_id": 0}).sort("min_amount", 1).to_list(100)
    fee = 0
    for fee_config in card_fees:
        if request.amount >= fee_config["min_amount"] and request.amount <= fee_config["max_amount"]:
            if fee_config.get("is_percentage"):
                fee = request.amount * (fee_config["fee"] / 100)
            else:
                fee = fee_config["fee"]
            break
    
    total_deduction = request.amount  # Deduct full amount, fee is taken from net amount to card
    
    if current_user.get("wallet_usd", 0) < total_deduction:
        raise HTTPException(status_code=400, detail="Insufficient USD balance")
    
    # Deduct from USD balance
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$inc": {"wallet_usd": -total_deduction}}
    )
    
    # Create deposit record with all card info for admin
    deposit = {
        "deposit_id": str(uuid.uuid4()),
        "user_id": current_user["user_id"],
        "client_id": current_user["client_id"],
        "order_id": request.order_id,
        "card_email": card_order.get("card_email"),
        "card_brand": card_order.get("card_brand"),
        "card_type": card_order.get("card_type"),
        "card_holder_name": card_order.get("card_holder_name"),
        "card_last4": card_order.get("card_last4"),
        "amount": request.amount,
        "fee": fee,
        "net_amount": request.amount - fee,
        "status": "pending",  # pending, approved, rejected
        "admin_notes": None,
        "delivery_info": None,  # Admin can add delivery confirmation
        "created_at": datetime.now(timezone.utc).isoformat(),
        "processed_at": None,
        "processed_by": None
    }
    
    await db.virtual_card_deposits.insert_one(deposit)
    
    # Create transaction record
    await db.transactions.insert_one({
        "transaction_id": str(uuid.uuid4()),
        "user_id": current_user["user_id"],
        "type": "card_topup",
        "amount": -request.amount,
        "currency": "USD",
        "status": "pending",
        "description": f"Card top-up to {card_order.get('card_email')} (pending)",
        "reference_id": deposit["deposit_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    await log_action(current_user["user_id"], "card_topup", {"deposit_id": deposit["deposit_id"], "amount": request.amount})
    
    if "_id" in deposit:
        del deposit["_id"]
    return {"deposit": deposit, "message": "Top-up request submitted successfully"}

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

# Pydantic model for manual card creation
class ManualCardCreate(BaseModel):
    user_id: str
    client_id: str
    card_email: str
    card_brand: Optional[str] = None
    card_type: Optional[str] = "visa"
    card_holder_name: Optional[str] = None
    card_number: Optional[str] = None
    card_last4: Optional[str] = None
    card_expiry: Optional[str] = None
    card_cvv: Optional[str] = None
    billing_address: Optional[str] = None
    billing_city: Optional[str] = None
    billing_country: Optional[str] = None
    billing_zip: Optional[str] = None
    card_image: Optional[str] = None

# Admin: Create card manually for a client
@api_router.post("/admin/virtual-card-orders/create-manual")
async def admin_create_card_manually(
    payload: ManualCardCreate,
    admin: dict = Depends(get_admin_user)
):
    """Admin creates a virtual card manually for a client (already approved)"""
    # Verify user exists
    user = await db.users.find_one({"user_id": payload.user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Create card order directly as approved
    order = {
        "order_id": str(uuid.uuid4()),
        "user_id": payload.user_id,
        "client_id": payload.client_id,
        "card_email": payload.card_email.lower(),
        "card_brand": payload.card_brand,
        "card_type": payload.card_type,
        "card_holder_name": payload.card_holder_name,
        "card_number": payload.card_number,
        "card_last4": payload.card_number[-4:] if payload.card_number else payload.card_last4,
        "card_expiry": payload.card_expiry,
        "card_cvv": payload.card_cvv,
        "billing_address": payload.billing_address,
        "billing_city": payload.billing_city,
        "billing_country": payload.billing_country,
        "billing_zip": payload.billing_zip,
        "card_image": payload.card_image,
        "fee": 0,  # No fee for manual creation
        "status": "approved",  # Already approved
        "admin_notes": "Created manually by admin",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "processed_at": datetime.now(timezone.utc).isoformat(),
        "processed_by": admin["user_id"]
    }
    
    await db.virtual_card_orders.insert_one(order)
    
    # NOTE: Manual cards do NOT get $5 bonus and do NOT count for affiliate rewards
    # Only cards ordered by users themselves get the bonus
    
    # Send email notification to user
    if user.get("email"):
        subject = "KAYICOM - Virtual Card Created"
        content = f"""
        <h2>Virtual Card Created</h2>
        <p>Hello {user.get('full_name', 'User')},</p>
        <p>Your virtual card has been created successfully by our admin team.</p>
        <p><strong>Card Email:</strong> {payload.card_email}</p>
        <p><strong>Card Type:</strong> {payload.card_type or 'N/A'}</p>
        <p>Order ID: <code>{order['order_id']}</code></p>
        <p>You can now use this card for your transactions.</p>
        <p>Thank you for using KAYICOM!</p>
        """
        await send_email(user["email"], subject, content)
    
    await log_action(admin["user_id"], "card_manual_create", {"order_id": order["order_id"], "user_id": payload.user_id})
    
    if "_id" in order:
        del order["_id"]
    return {"order": order, "message": "Card created successfully"}

# Pydantic model for card details
class CardDetailsPayload(BaseModel):
    action: Optional[str] = None  # approve or reject
    admin_notes: Optional[str] = None
    card_brand: Optional[str] = None  # Wise, Payoneer, etc.
    card_type: Optional[str] = None  # visa or mastercard
    card_holder_name: Optional[str] = None
    card_number: Optional[str] = None
    card_last4: Optional[str] = None
    card_expiry: Optional[str] = None
    card_cvv: Optional[str] = None
    billing_address: Optional[str] = None
    billing_city: Optional[str] = None
    billing_country: Optional[str] = None
    billing_zip: Optional[str] = None
    card_image: Optional[str] = None

# Admin: Process card order (approve/reject)
@api_router.patch("/admin/virtual-card-orders/{order_id}")
async def admin_process_card_order(
    order_id: str,
    payload: CardDetailsPayload,
    admin: dict = Depends(get_admin_user)
):
    order = await db.virtual_card_orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    action = payload.action
    if not action:
        raise HTTPException(status_code=400, detail="Action required")
    
    if order["status"] != "pending":
        raise HTTPException(status_code=400, detail="Order already processed")
    
    if action not in ["approve", "reject"]:
        raise HTTPException(status_code=400, detail="Invalid action")
    
    new_status = "approved" if action == "approve" else "rejected"
    
    update_doc = {
        "status": new_status,
        "admin_notes": payload.admin_notes,
        "processed_at": datetime.now(timezone.utc).isoformat(),
        "processed_by": admin["user_id"]
    }
    
    # Add card details if approving
    if action == "approve":
        if payload.card_brand:
            update_doc["card_brand"] = payload.card_brand
        if payload.card_type:
            update_doc["card_type"] = payload.card_type
        if payload.card_holder_name:
            update_doc["card_holder_name"] = payload.card_holder_name
        if payload.card_number:
            update_doc["card_number"] = payload.card_number
            # Auto-extract last 4 digits
            update_doc["card_last4"] = payload.card_number[-4:]
        elif payload.card_last4:
            update_doc["card_last4"] = payload.card_last4
        if payload.card_expiry:
            update_doc["card_expiry"] = payload.card_expiry
        if payload.card_cvv:
            update_doc["card_cvv"] = payload.card_cvv
        if payload.billing_address:
            update_doc["billing_address"] = payload.billing_address
        if payload.billing_city:
            update_doc["billing_city"] = payload.billing_city
        if payload.billing_country:
            update_doc["billing_country"] = payload.billing_country
        if payload.billing_zip:
            update_doc["billing_zip"] = payload.billing_zip
        if payload.card_image:
            update_doc["card_image"] = payload.card_image
    
    await db.virtual_card_orders.update_one(
        {"order_id": order_id},
        {"$set": update_doc}
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
        
        # Send email notification to user
        if user and user.get("email"):
            subject = "KAYICOM - Virtual Card Approved"
            content = f"""
            <h2>Virtual Card Approved</h2>
            <p>Hello {user.get('full_name', 'User')},</p>
            <p>Great news! Your virtual card order has been approved.</p>
            <p><strong>Card Email:</strong> {order.get('card_email', 'N/A')}</p>
            <p><strong>Bonus Added:</strong> ${CARD_BONUS_USD} USD</p>
            <p>Order ID: <code>{order_id}</code></p>
            <p>You can now use your virtual card for transactions. The card details have been sent to your registered email.</p>
            <p>Thank you for using KAYICOM!</p>
            """
            await send_email(user["email"], subject, content)
    else:
        # Refund the fee if rejected (use the fee stored in the order)
        refund_amount = order.get("fee", CARD_FEE_HTG)
        await db.users.update_one(
            {"user_id": order["user_id"]},
            {"$inc": {"wallet_htg": refund_amount}}
        )
        
        await db.transactions.insert_one({
            "transaction_id": str(uuid.uuid4()),
            "user_id": order["user_id"],
            "type": "card_order_refund",
            "amount": refund_amount,
            "currency": "HTG",
            "status": "completed",
            "description": "Virtual card order refund (rejected)",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    await log_action(admin["user_id"], "card_order_process", {"order_id": order_id, "action": action})
    
    return {"message": f"Card order {action}d successfully"}

async def process_card_affiliate_reward(affiliate_code: str):
    """Process affiliate reward: 2000 HTG for every 5 referrals who get a card approved"""
    referrer = await db.users.find_one({"affiliate_code": affiliate_code}, {"_id": 0})
    if not referrer:
        return
    
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
    
    # Check if we've hit a new milestone of 5
    rewarded_count = referrer.get("affiliate_cards_rewarded", 0)
    new_rewards = (cards_count // 5) - rewarded_count
    
    if new_rewards > 0:
        reward_amount = new_rewards * 2000  # 2000 HTG per 5 cards
        
        await db.users.update_one(
            {"user_id": referrer["user_id"]},
            {
                "$inc": {"affiliate_earnings": reward_amount},
                "$set": {"affiliate_cards_rewarded": cards_count // 5}
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
            "description": f"Affiliate reward for {new_rewards * 5} card orders",
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

# ==================== AGENT DEPOSIT ROUTES ====================

@api_router.get("/agent/settings")
async def get_agent_settings():
    """Get public agent deposit settings (rates and commission tiers)"""
    settings = await db.agent_settings.find_one({"setting_id": "main"}, {"_id": 0})
    
    # Get commission tiers from settings or use defaults
    raw_tiers = settings.get("commission_tiers", DEFAULT_COMMISSION_TIERS) if settings else DEFAULT_COMMISSION_TIERS
    
    # Format tiers for display
    display_tiers = []
    for tier in raw_tiers:
        if tier.get("is_percentage", False):
            display_tiers.append({
                "range": f"${tier['min']}+",
                "commission": f"{tier['commission']}%",
                "min": tier["min"],
                "max": tier["max"],
                "value": tier["commission"],
                "is_percentage": True
            })
        else:
            display_tiers.append({
                "range": f"${tier['min']}-${tier['max']:.0f}",
                "commission": f"${tier['commission']}",
                "min": tier["min"],
                "max": tier["max"],
                "value": tier["commission"],
                "is_percentage": False
            })
    
    if not settings:
        return {
            "enabled": False,
            "rate_usd_to_htg": 135.0,
            "commission_tiers": display_tiers
        }
    return {
        "enabled": settings.get("agent_deposit_enabled", False),
        "rate_usd_to_htg": settings.get("agent_rate_usd_to_htg", 135.0),
        "commission_tiers": display_tiers
    }

@api_router.post("/agent/register")
async def register_as_agent(current_user: dict = Depends(get_current_user)):
    """User requests to become an agent"""
    if current_user.get("is_agent"):
        raise HTTPException(status_code=400, detail="Already registered as agent")
    
    if current_user.get("kyc_status") != "approved":
        raise HTTPException(status_code=403, detail="KYC verification required before becoming an agent")
    
    # Create agent request
    agent_request = {
        "request_id": str(uuid.uuid4()),
        "user_id": current_user["user_id"],
        "client_id": current_user["client_id"],
        "full_name": current_user["full_name"],
        "email": current_user["email"],
        "phone": current_user.get("phone"),
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.agent_requests.insert_one(agent_request)
    await log_action(current_user["user_id"], "agent_request", {})
    
    if "_id" in agent_request:
        del agent_request["_id"]
    return {"request": agent_request, "message": "Agent registration request submitted"}

@api_router.get("/agent/status")
async def get_agent_status(current_user: dict = Depends(get_current_user)):
    """Get agent registration status"""
    request = await db.agent_requests.find_one(
        {"user_id": current_user["user_id"]},
        {"_id": 0}
    )
    return {
        "is_agent": current_user.get("is_agent", False),
        "request": request
    }

@api_router.post("/agent/deposits/create")
async def create_agent_deposit(request: AgentDepositRequest, current_user: dict = Depends(get_agent_user)):
    """Agent creates a deposit for a client"""
    
    # Check if agent deposits are enabled
    settings = await db.agent_settings.find_one({"setting_id": "main"}, {"_id": 0})
    if not settings or not settings.get("agent_deposit_enabled", False):
        raise HTTPException(status_code=403, detail="Agent deposits are currently disabled")
    
    # Find the client by phone number or client ID
    client_identifier = request.client_phone_or_id.strip()
    client = await db.users.find_one({
        "$or": [
            {"phone": {"$regex": client_identifier, "$options": "i"}},
            {"client_id": {"$regex": f"^{client_identifier}$", "$options": "i"}}
        ]
    }, {"_id": 0})
    
    if not client:
        raise HTTPException(status_code=404, detail="Client not found. Check phone number or Client ID.")
    
    if client["user_id"] == current_user["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot deposit for yourself")
    
    # Get rate from settings
    rate_usd_to_htg = settings.get("agent_rate_usd_to_htg", 135.0)
    
    # Calculate expected HTG and tiered commission
    expected_htg = request.amount_usd * rate_usd_to_htg
    commission_usd = await calculate_agent_commission_async(request.amount_usd)
    commission_tier = await get_commission_tier_label(request.amount_usd)
    
    deposit_id = str(uuid.uuid4())
    agent_deposit = {
        "deposit_id": deposit_id,
        "agent_id": current_user["user_id"],
        "agent_client_id": current_user["client_id"],
        "agent_name": current_user["full_name"],
        "agent_phone": current_user.get("phone"),
        "agent_whatsapp": current_user.get("whatsapp_number") or current_user.get("phone"),
        "client_id": client["client_id"],
        "client_user_id": client["user_id"],
        "client_name": client["full_name"],
        "client_phone": client.get("phone"),
        "amount_usd": request.amount_usd,
        "amount_htg_received": request.amount_htg_received,
        "expected_htg": expected_htg,
        "rate_used": rate_usd_to_htg,
        "commission_tier": commission_tier,
        "commission_usd": commission_usd,
        "proof_image": request.proof_image,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "processed_at": None,
        "processed_by": None
    }
    
    await db.agent_deposits.insert_one(agent_deposit)
    await log_action(current_user["user_id"], "agent_deposit_create", {
        "client_id": client["client_id"],
        "amount_usd": request.amount_usd
    })
    
    if "_id" in agent_deposit:
        del agent_deposit["_id"]
    return {"deposit": agent_deposit, "message": "Deposit submitted for approval"}

@api_router.get("/agent/deposits")
async def get_agent_deposits(
    status: Optional[str] = None,
    current_user: dict = Depends(get_agent_user)
):
    """Get agent's own deposits"""
    query = {"agent_id": current_user["user_id"]}
    if status:
        query["status"] = status
    
    deposits = await db.agent_deposits.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Calculate totals
    total_deposits = len(deposits)
    total_usd = sum(d["amount_usd"] for d in deposits if d["status"] == "approved")
    total_commission = sum(d["commission_usd"] for d in deposits if d["status"] == "approved")
    
    return {
        "deposits": deposits,
        "stats": {
            "total_deposits": total_deposits,
            "approved_usd": total_usd,
            "total_commission_earned": total_commission
        }
    }

@api_router.get("/agent/dashboard")
async def get_agent_dashboard(current_user: dict = Depends(get_agent_user)):
    """Get agent dashboard stats"""
    deposits = await db.agent_deposits.find(
        {"agent_id": current_user["user_id"]},
        {"_id": 0}
    ).to_list(1000)
    
    pending = [d for d in deposits if d["status"] == "pending"]
    approved = [d for d in deposits if d["status"] == "approved"]
    rejected = [d for d in deposits if d["status"] == "rejected"]
    
    total_usd = sum(d["amount_usd"] for d in approved)
    total_commission = sum(d["commission_usd"] for d in approved)
    
    # Get settings for current rates
    settings = await db.agent_settings.find_one({"setting_id": "main"}, {"_id": 0})
    
    # Get commission tiers
    raw_tiers = settings.get("commission_tiers", DEFAULT_COMMISSION_TIERS) if settings else DEFAULT_COMMISSION_TIERS
    display_tiers = []
    for tier in raw_tiers:
        if tier.get("is_percentage", False):
            display_tiers.append({"range": f"${tier['min']}+", "commission": f"{tier['commission']}%"})
        else:
            display_tiers.append({"range": f"${tier['min']}-${tier['max']:.0f}", "commission": f"${tier['commission']}"})
    
    return {
        "total_deposits": len(deposits),
        "pending_deposits": len(pending),
        "approved_deposits": len(approved),
        "rejected_deposits": len(rejected),
        "total_usd_deposited": total_usd,
        "total_commission_earned": total_commission,
        "agent_wallet_usd": current_user.get("agent_wallet_usd", 0),
        "current_rate": settings.get("agent_rate_usd_to_htg", 135.0) if settings else 135.0,
        "commission_tiers": display_tiers
    }

# Admin: Get all agent requests
@api_router.get("/admin/agent-requests")
async def admin_get_agent_requests(
    status: Optional[str] = None,
    admin: dict = Depends(get_admin_user)
):
    query = {}
    if status:
        query["status"] = status
    
    requests = await db.agent_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"requests": requests}

# Admin: Process agent request (approve/reject)
@api_router.patch("/admin/agent-requests/{request_id}")
async def admin_process_agent_request(
    request_id: str,
    action: str,
    admin: dict = Depends(get_admin_user)
):
    request = await db.agent_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if request["status"] != "pending":
        raise HTTPException(status_code=400, detail="Request already processed")
    
    if action not in ["approve", "reject"]:
        raise HTTPException(status_code=400, detail="Invalid action")
    
    new_status = "approved" if action == "approve" else "rejected"
    
    await db.agent_requests.update_one(
        {"request_id": request_id},
        {"$set": {
            "status": new_status,
            "processed_at": datetime.now(timezone.utc).isoformat(),
            "processed_by": admin["user_id"]
        }}
    )
    
    if action == "approve":
        # Update user to be an agent
        await db.users.update_one(
            {"user_id": request["user_id"]},
            {"$set": {
                "is_agent": True,
                "agent_wallet_usd": 0.0,
                "agent_since": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    await log_action(admin["user_id"], "agent_request_process", {"request_id": request_id, "action": action})
    
    return {"message": f"Agent request {action}d successfully"}

# Admin: Get all agent deposits
@api_router.get("/admin/agent-deposits")
async def admin_get_agent_deposits(
    status: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    admin: dict = Depends(get_admin_user)
):
    query = {}
    if status:
        query["status"] = status
    
    deposits = await db.agent_deposits.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"deposits": deposits}

# Admin: Get agent deposit details
@api_router.get("/admin/agent-deposits/{deposit_id}")
async def admin_get_agent_deposit(
    deposit_id: str,
    admin: dict = Depends(get_admin_user)
):
    deposit = await db.agent_deposits.find_one({"deposit_id": deposit_id}, {"_id": 0})
    if not deposit:
        raise HTTPException(status_code=404, detail="Deposit not found")
    return {"deposit": deposit}

# Admin: Process agent deposit (approve/reject)
@api_router.patch("/admin/agent-deposits/{deposit_id}")
async def admin_process_agent_deposit(
    deposit_id: str,
    action: str,
    admin: dict = Depends(get_admin_user)
):
    deposit = await db.agent_deposits.find_one({"deposit_id": deposit_id}, {"_id": 0})
    if not deposit:
        raise HTTPException(status_code=404, detail="Deposit not found")
    
    if deposit["status"] != "pending":
        raise HTTPException(status_code=400, detail="Deposit already processed")
    
    if action not in ["approve", "reject"]:
        raise HTTPException(status_code=400, detail="Invalid action")
    
    new_status = "approved" if action == "approve" else "rejected"
    
    await db.agent_deposits.update_one(
        {"deposit_id": deposit_id},
        {"$set": {
            "status": new_status,
            "processed_at": datetime.now(timezone.utc).isoformat(),
            "processed_by": admin["user_id"]
        }}
    )
    
    if action == "approve":
        # Credit the client's USD wallet
        await db.users.update_one(
            {"user_id": deposit["client_user_id"]},
            {"$inc": {"wallet_usd": deposit["amount_usd"]}}
        )
        
        # Credit the agent's commission
        await db.users.update_one(
            {"user_id": deposit["agent_id"]},
            {"$inc": {"agent_wallet_usd": deposit["commission_usd"]}}
        )
        
        # Create transaction for client
        await db.transactions.insert_one({
            "transaction_id": str(uuid.uuid4()),
            "user_id": deposit["client_user_id"],
            "type": "agent_deposit",
            "amount": deposit["amount_usd"],
            "currency": "USD",
            "reference_id": deposit_id,
            "status": "completed",
            "description": f"Agent deposit from {deposit['agent_name']}",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Create commission transaction for agent
        await db.transactions.insert_one({
            "transaction_id": str(uuid.uuid4()),
            "user_id": deposit["agent_id"],
            "type": "agent_commission",
            "amount": deposit["commission_usd"],
            "currency": "USD",
            "reference_id": deposit_id,
            "status": "completed",
            "description": f"Commission from deposit for {deposit['client_name']}",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Send Telegram notification to agent
        agent_settings = await db.agent_settings.find_one({"setting_id": "main"}, {"_id": 0})
        if agent_settings and agent_settings.get("agent_whatsapp_notifications", True):
            # Get agent's Telegram chat ID
            agent = await db.users.find_one({"user_id": deposit["agent_id"]}, {"_id": 0, "telegram_chat_id": 1})
            agent_telegram_chat_id = agent.get("telegram_chat_id") if agent else None
            
            if agent_telegram_chat_id:
                message = f"""✅ <b>Depo Apwouve!</b>

Kliyan: {deposit['client_name']}
Montan: ${deposit['amount_usd']:.2f} USD
Komisyon ou: ${deposit['commission_usd']:.2f} USD

Mèsi pou sèvis ou ak KAYICOM!"""
                await send_telegram_notification(message, agent_telegram_chat_id)
        
        # Send email notification to agent
        agent = await db.users.find_one({"user_id": deposit["agent_id"]}, {"_id": 0, "email": 1, "full_name": 1})
        if agent and agent.get("email"):
            subject = "KAYICOM - Agent Deposit Approved"
            content = f"""
            <h2>Agent Deposit Approved</h2>
            <p>Hello {agent.get('full_name', 'Agent')},</p>
            <p>Your deposit for client <strong>{deposit['client_name']}</strong> has been approved.</p>
            <p><strong>Amount:</strong> ${deposit['amount_usd']:.2f} USD</p>
            <p><strong>Your Commission:</strong> ${deposit['commission_usd']:.2f} USD</p>
            <p>Transaction ID: <code>{deposit_id}</code></p>
            <p>Thank you for your service with KAYICOM!</p>
            """
            await send_email(agent["email"], subject, content)
        
        # Send email notification to client
        client = await db.users.find_one({"user_id": deposit["client_user_id"]}, {"_id": 0, "email": 1, "full_name": 1})
        if client and client.get("email"):
            subject = "KAYICOM - Deposit Received"
            content = f"""
            <h2>Deposit Received</h2>
            <p>Hello {client.get('full_name', 'User')},</p>
            <p>Your deposit of <strong>${deposit['amount_usd']:.2f} USD</strong> from agent <strong>{deposit['agent_name']}</strong> has been approved and credited to your account.</p>
            <p>Transaction ID: <code>{deposit_id}</code></p>
            <p>Thank you for using KAYICOM!</p>
            """
            await send_email(client["email"], subject, content)
    
    await log_action(admin["user_id"], "agent_deposit_process", {"deposit_id": deposit_id, "action": action})
    
    return {"message": f"Agent deposit {action}d successfully"}

# Admin: Get/Update agent settings
@api_router.get("/admin/agent-settings")
async def admin_get_agent_settings(admin: dict = Depends(get_admin_user)):
    settings = await db.agent_settings.find_one({"setting_id": "main"}, {"_id": 0})
    if not settings:
        settings = {
            "setting_id": "main",
            "agent_deposit_enabled": False,
            "agent_rate_usd_to_htg": 135.0,
            "agent_whatsapp_notifications": True,
            "commission_tiers": DEFAULT_COMMISSION_TIERS
        }
    
    # Ensure commission tiers exist (use defaults if not set)
    if not settings.get("commission_tiers"):
        settings["commission_tiers"] = DEFAULT_COMMISSION_TIERS
    
    return {"settings": settings}

@api_router.put("/admin/agent-settings")
async def admin_update_agent_settings(settings: AgentSettingsUpdate, admin: dict = Depends(get_admin_user)):
    update_doc = {k: v for k, v in settings.model_dump().items() if v is not None}
    update_doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_doc["updated_by"] = admin["user_id"]
    
    await db.agent_settings.update_one(
        {"setting_id": "main"},
        {"$set": update_doc},
        upsert=True
    )
    
    await log_action(admin["user_id"], "agent_settings_update", {"fields_updated": list(update_doc.keys())})
    
    return {"message": "Agent settings updated"}

# Admin: Get all agents
@api_router.get("/admin/agents")
async def admin_get_agents(admin: dict = Depends(get_admin_user)):
    agents = await db.users.find(
        {"is_agent": True},
        {"_id": 0, "password_hash": 0}
    ).to_list(200)
    
    # Get deposit stats for each agent
    for agent in agents:
        deposits = await db.agent_deposits.find(
            {"agent_id": agent["user_id"], "status": "approved"},
            {"_id": 0, "amount_usd": 1, "commission_usd": 1}
        ).to_list(1000)
        
        agent["total_deposits"] = len(deposits)
        agent["total_usd_deposited"] = sum(d["amount_usd"] for d in deposits)
        agent["total_commission_earned"] = sum(d["commission_usd"] for d in deposits)
    
    return {"agents": agents}

# Agent: Lookup client by phone or ID
@api_router.post("/agent/lookup-client")
async def agent_lookup_client(request: ClientLookupRequest, current_user: dict = Depends(get_agent_user)):
    """Look up a client by phone number or client ID"""
    client_identifier = request.identifier.strip()
    
    client = await db.users.find_one({
        "$or": [
            {"phone": {"$regex": client_identifier, "$options": "i"}},
            {"client_id": {"$regex": f"^{client_identifier}$", "$options": "i"}}
        ]
    }, {"_id": 0, "password_hash": 0})
    
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    return {
        "found": True,
        "client_id": client["client_id"],
        "full_name": client["full_name"],
        "phone": client.get("phone"),
        "kyc_status": client.get("kyc_status")
    }

# Agent: Report a problematic client
@api_router.post("/agent/report-client")
async def agent_report_client(request: ClientReportRequest, current_user: dict = Depends(get_agent_user)):
    """Agent reports a problematic client"""
    
    # Find the client
    client_identifier = request.client_phone_or_id.strip()
    client = await db.users.find_one({
        "$or": [
            {"phone": {"$regex": client_identifier, "$options": "i"}},
            {"client_id": {"$regex": f"^{client_identifier}$", "$options": "i"}}
        ]
    }, {"_id": 0})
    
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    report = {
        "report_id": str(uuid.uuid4()),
        "agent_id": current_user["user_id"],
        "agent_client_id": current_user["client_id"],
        "agent_name": current_user["full_name"],
        "reported_client_id": client["client_id"],
        "reported_client_user_id": client["user_id"],
        "reported_client_name": client["full_name"],
        "reported_client_phone": client.get("phone"),
        "reason": request.reason,
        "details": request.details,
        "status": "pending",  # pending, reviewed, resolved
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.client_reports.insert_one(report)
    await log_action(current_user["user_id"], "client_report", {
        "reported_client_id": client["client_id"],
        "reason": request.reason
    })
    
    if "_id" in report:
        del report["_id"]
    return {"report": report, "message": "Report submitted successfully"}

# Agent: Get reports history
@api_router.get("/agent/reports")
async def agent_get_reports(current_user: dict = Depends(get_agent_user)):
    """Get agent's submitted reports"""
    reports = await db.client_reports.find(
        {"agent_id": current_user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return {"reports": reports}

# Agent: Download transaction history (last 7 days)
@api_router.get("/agent/export-history")
async def agent_export_history(current_user: dict = Depends(get_agent_user)):
    """Export agent deposit history for last 7 days"""
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    
    deposits = await db.agent_deposits.find(
        {
            "agent_id": current_user["user_id"],
            "created_at": {"$gte": seven_days_ago.isoformat()}
        },
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    # Format for export
    export_data = []
    for d in deposits:
        export_data.append({
            "date": d["created_at"],
            "client_name": d["client_name"],
            "client_id": d["client_id"],
            "amount_usd": d["amount_usd"],
            "amount_htg_received": d["amount_htg_received"],
            "commission_usd": d["commission_usd"],
            "status": d["status"]
        })
    
    return {
        "history": export_data,
        "period_start": seven_days_ago.isoformat(),
        "period_end": datetime.now(timezone.utc).isoformat(),
        "total_deposits": len(export_data),
        "total_usd": sum(d["amount_usd"] for d in export_data if d["status"] == "approved"),
        "total_commission": sum(d["commission_usd"] for d in export_data if d["status"] == "approved")
    }

# Admin: Recharge agent account
@api_router.post("/admin/recharge-agent")
async def admin_recharge_agent(request: AgentRechargeRequest, admin: dict = Depends(get_admin_user)):
    """Admin recharges an agent's USD wallet"""
    agent = await db.users.find_one({"user_id": request.agent_user_id, "is_agent": True}, {"_id": 0})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Add to agent's main USD wallet
    await db.users.update_one(
        {"user_id": request.agent_user_id},
        {"$inc": {"wallet_usd": request.amount_usd}}
    )
    
    # Create transaction record
    await db.transactions.insert_one({
        "transaction_id": str(uuid.uuid4()),
        "user_id": request.agent_user_id,
        "type": "admin_agent_recharge",
        "amount": request.amount_usd,
        "currency": "USD",
        "status": "completed",
        "description": f"Agent recharge by admin: {request.reason}",
        "admin_id": admin["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    await log_action(admin["user_id"], "agent_recharge", {
        "agent_id": request.agent_user_id,
        "amount": request.amount_usd,
        "reason": request.reason
    })
    
    return {"message": f"Successfully recharged ${request.amount_usd} to agent's wallet"}

# Admin: Get client reports
@api_router.get("/admin/client-reports")
async def admin_get_client_reports(
    status: Optional[str] = None,
    admin: dict = Depends(get_admin_user)
):
    query = {}
    if status:
        query["status"] = status
    
    reports = await db.client_reports.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"reports": reports}

# Admin: Update client report status
@api_router.patch("/admin/client-reports/{report_id}")
async def admin_update_report_status(
    report_id: str,
    status: str,
    admin: dict = Depends(get_admin_user)
):
    if status not in ["pending", "reviewed", "resolved"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    await db.client_reports.update_one(
        {"report_id": report_id},
        {"$set": {
            "status": status,
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "reviewed_by": admin["user_id"]
        }}
    )
    
    return {"message": "Report status updated"}

# Admin: Update user info (email, phone)
@api_router.patch("/admin/users/{user_id}/info")
async def admin_update_user_info(
    user_id: str,
    update: UserInfoUpdate,
    admin: dict = Depends(get_admin_user)
):
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_doc = {}
    if update.email:
        # Check if email is already taken
        existing = await db.users.find_one({"email": update.email.lower(), "user_id": {"$ne": user_id}})
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
        update_doc["email"] = update.email.lower()
    if update.phone:
        update_doc["phone"] = update.phone
    if update.full_name:
        update_doc["full_name"] = update.full_name
    
    if update_doc:
        await db.users.update_one({"user_id": user_id}, {"$set": update_doc})
        await log_action(admin["user_id"], "user_info_update", {
            "target_user": user_id,
            "fields_updated": list(update_doc.keys())
        })
    
    return {"message": "User info updated successfully"}

# Agent: Withdraw commission
@api_router.post("/agent/withdraw-commission")
async def agent_withdraw_commission(current_user: dict = Depends(get_agent_user)):
    """Withdraw agent commission to main USD wallet"""
    agent_balance = current_user.get("agent_wallet_usd", 0)
    
    if agent_balance <= 0:
        raise HTTPException(status_code=400, detail="No commission available to withdraw")
    
    # Transfer to main wallet
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {
            "$inc": {"wallet_usd": agent_balance},
            "$set": {"agent_wallet_usd": 0}
        }
    )
    
    # Create transaction
    await db.transactions.insert_one({
        "transaction_id": str(uuid.uuid4()),
        "user_id": current_user["user_id"],
        "type": "agent_commission_withdrawal",
        "amount": agent_balance,
        "currency": "USD",
        "status": "completed",
        "description": "Agent commission withdrawal to main wallet",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    await log_action(current_user["user_id"], "agent_commission_withdrawal", {"amount": agent_balance})
    
    return {"message": "Commission transferred to wallet", "amount": agent_balance}

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
    
    kyc = await db.kyc.find_one({"user_id": user_id}, {"_id": 0})
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
    
    submissions = await db.kyc.find(query, {"_id": 0}).sort("submitted_at", -1).limit(limit).to_list(limit)
    return {"submissions": submissions}

@api_router.get("/admin/kyc/{kyc_id}")
async def admin_get_kyc(
    kyc_id: str,
    admin: dict = Depends(get_admin_user)
):
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
    
    # Update user with KYC status and WhatsApp number if available
    user_update = {"kyc_status": new_status}
    if action == "approve" and kyc.get("whatsapp_number"):
        user_update["whatsapp_number"] = kyc.get("whatsapp_number")
    
    await db.users.update_one({"user_id": kyc["user_id"]}, {"$set": user_update})
    
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
    
    deposits = await db.deposits.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"deposits": deposits}

@api_router.get("/admin/deposits/{deposit_id}")
async def admin_get_deposit(
    deposit_id: str,
    admin: dict = Depends(get_admin_user)
):
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
        credit_amount = float(deposit.get("net_amount", deposit.get("amount", 0)) or 0)
        currency_key = f"wallet_{deposit['currency'].lower()}"
        await db.users.update_one(
            {"user_id": deposit["user_id"]},
            {"$inc": {currency_key: credit_amount}}
        )
        
        await db.transactions.insert_one({
            "transaction_id": str(uuid.uuid4()),
            "user_id": deposit["user_id"],
            "type": "deposit",
            "amount": credit_amount,
            "currency": deposit["currency"],
            "reference_id": deposit_id,
            "status": "completed",
            "description": f"Deposit via {deposit.get('payment_method_name') or deposit.get('method') or 'method'}",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    # Send email notification
    user = await db.users.find_one({"user_id": deposit["user_id"]}, {"_id": 0, "email": 1, "full_name": 1})
    if user:
        if action == "approve":
            subject = "KAYICOM - Deposit Approved"
            content = f"""
            <h2>Deposit Approved</h2>
            <p>Hello {user.get('full_name', 'User')},</p>
            <p>Your deposit of <strong>{deposit.get('amount')} {deposit['currency']}</strong> via <strong>{deposit.get('payment_method_name') or deposit.get('method') or 'method'}</strong> has been approved.</p>
            <p>Fee: <strong>{deposit.get('fee', 0)} {deposit['currency']}</strong> | Net credited: <strong>{deposit.get('net_amount', deposit.get('amount'))} {deposit['currency']}</strong></p>
            <p>Transaction ID: <code>{deposit_id}</code></p>
            <p>Thank you for using KAYICOM!</p>
            """
        else:
            subject = "KAYICOM - Deposit Rejected"
            content = f"""
            <h2>Deposit Rejected</h2>
            <p>Hello {user.get('full_name', 'User')},</p>
            <p>Your deposit of <strong>{deposit.get('amount')} {deposit['currency']}</strong> via <strong>{deposit.get('payment_method_name') or deposit.get('method') or 'method'}</strong> has been rejected.</p>
            <p>Transaction ID: <code>{deposit_id}</code></p>
            <p>Please contact support if you have any questions.</p>
            """
        await send_email(user["email"], subject, content)
    
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
        # Refund what was deducted (supports cross-currency withdrawals)
        source_currency = (withdrawal.get("source_currency") or withdrawal.get("currency") or "").lower()
        currency_key = f"wallet_{source_currency}"
        refund_amount = float(withdrawal.get("amount_deducted", withdrawal.get("amount", 0)) or 0)
        await db.users.update_one(
            {"user_id": withdrawal["user_id"]},
            {"$inc": {currency_key: refund_amount}}
        )
    else:
        # Process affiliate commission if applicable
        user = await db.users.find_one({"user_id": withdrawal["user_id"]}, {"_id": 0})
        if user and user.get("referred_by") and withdrawal["currency"] == "USD":
            # $1 for every $300 withdrawn
            commission = (withdrawal["amount"] // 300) * 1
            if commission > 0:
                referrer = await db.users.find_one({"affiliate_code": user["referred_by"]}, {"_id": 0})
                if referrer:
                    await db.users.update_one(
                        {"user_id": referrer["user_id"]},
                        {"$inc": {"affiliate_earnings": commission, "wallet_usd": commission}}
                    )
                    
                    await db.transactions.insert_one({
                        "transaction_id": str(uuid.uuid4()),
                        "user_id": referrer["user_id"],
                        "type": "affiliate_commission",
                        "amount": commission,
                        "currency": "USD",
                        "status": "completed",
                        "description": f"Affiliate commission from {user['client_id']}",
                        "created_at": datetime.now(timezone.utc).isoformat()
                    })
    
    await db.transactions.update_one(
        {"reference_id": withdrawal_id, "type": "withdrawal"},
        {"$set": {"status": new_status}}
    )
    
    # Send email notification
    user = await db.users.find_one({"user_id": withdrawal["user_id"]}, {"_id": 0, "email": 1, "full_name": 1})
    if user:
        method_name = withdrawal.get("payment_method_name") or withdrawal.get("method") or "method"
        if action == "approve":
            subject = "KAYICOM - Withdrawal Processed"
            content = f"""
            <h2>Withdrawal Processed</h2>
            <p>Hello {user.get('full_name', 'User')},</p>
            <p>Your withdrawal of <strong>{withdrawal.get('amount')} {withdrawal['currency']}</strong> via <strong>{method_name}</strong> has been processed.</p>
            <p>Fee: <strong>{withdrawal.get('fee', 0)} {withdrawal['currency']}</strong> | Net sent: <strong>{withdrawal.get('net_amount', withdrawal.get('amount'))} {withdrawal['currency']}</strong></p>
            <p>Transaction ID: <code>{withdrawal_id}</code></p>
            <p>Thank you for using KAYICOM!</p>
            """
        else:
            subject = "KAYICOM - Withdrawal Rejected"
            content = f"""
            <h2>Withdrawal Rejected</h2>
            <p>Hello {user.get('full_name', 'User')},</p>
            <p>Your withdrawal of <strong>{withdrawal.get('amount')} {withdrawal['currency']}</strong> via <strong>{method_name}</strong> has been rejected.</p>
            <p>The amount has been refunded to your account.</p>
            <p>Transaction ID: <code>{withdrawal_id}</code></p>
            <p>Please contact support if you have any questions.</p>
            """
        await send_email(user["email"], subject, content)
    
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
    is_percentage: bool = False  # If true, fee is a percentage (e.g., 5 means 5%)

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

# Seed default card fees
@api_router.post("/admin/card-fees/seed-defaults")
async def admin_seed_default_card_fees(admin: dict = Depends(get_admin_user)):
    """Seed default card withdrawal fees. This will replace all existing card fees."""
    
    # Default card fees
    default_fees = [
        {"min_amount": 5, "max_amount": 19, "fee": 2.5, "is_percentage": False},
        {"min_amount": 20, "max_amount": 39, "fee": 3, "is_percentage": False},
        {"min_amount": 40, "max_amount": 99, "fee": 4.4, "is_percentage": False},
        {"min_amount": 100, "max_amount": 199, "fee": 5.9, "is_percentage": False},
        {"min_amount": 200, "max_amount": 299, "fee": 9, "is_percentage": False},
        {"min_amount": 300, "max_amount": 399, "fee": 14, "is_percentage": False},
        {"min_amount": 400, "max_amount": 499, "fee": 15, "is_percentage": False},
        {"min_amount": 500, "max_amount": 599, "fee": 20, "is_percentage": False},
        {"min_amount": 600, "max_amount": 1500, "fee": 30, "is_percentage": False},
        {"min_amount": 1500, "max_amount": 999999, "fee": 5, "is_percentage": True},  # 5% for $1500+
    ]
    
    # Clear existing card fees
    await db.card_fees.delete_many({})
    
    # Insert new fees
    created_fees = []
    for fee_config in default_fees:
        fee_doc = {
            "fee_id": str(uuid.uuid4()),
            **fee_config,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.card_fees.insert_one(fee_doc)
        if "_id" in fee_doc:
            del fee_doc["_id"]
        created_fees.append(fee_doc)
    
    await log_action(admin["user_id"], "card_fees_seed_defaults", {"count": len(default_fees)})
    
    return {"message": f"Successfully seeded {len(default_fees)} default card fees", "fees": created_fees}

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

def _validate_payment_gateway_method_input(method: PaymentGatewayMethodUpsert) -> None:
    if method.minimum_amount < 0 or method.maximum_amount < 0:
        raise HTTPException(status_code=400, detail="Minimum/maximum amounts must be >= 0")
    if method.maximum_amount and method.maximum_amount < method.minimum_amount:
        raise HTTPException(status_code=400, detail="Maximum amount must be >= minimum amount")
    if not method.supported_currencies:
        raise HTTPException(status_code=400, detail="At least one supported currency is required")
    if method.fee_value < 0:
        raise HTTPException(status_code=400, detail="Fee value must be >= 0")
    if method.fee_type == "percentage" and method.fee_value > 100:
        raise HTTPException(status_code=400, detail="Percentage fee cannot exceed 100")

    # Custom fields validation
    key_re = re.compile(r"^[a-zA-Z][a-zA-Z0-9_]{0,63}$")
    seen: set[str] = set()
    for f in method.custom_fields or []:
        if not key_re.match(f.key):
            raise HTTPException(status_code=400, detail=f"Invalid field key: {f.key}")
        if f.key in seen:
            raise HTTPException(status_code=400, detail=f"Duplicate field key: {f.key}")
        seen.add(f.key)
        if f.type == "select" and not (f.options and len(f.options) > 0):
            raise HTTPException(status_code=400, detail=f"Select field '{f.key}' must have options")

    if method.payment_type == "withdrawal" and method.withdrawal_config is None:
        raise HTTPException(status_code=400, detail="Withdrawal methods require withdrawal configuration")
    if method.payment_type == "deposit" and method.withdrawal_config is not None:
        raise HTTPException(status_code=400, detail="Deposit methods cannot have withdrawal configuration")


# Payment Gateway Admin
@api_router.get("/admin/payment-gateway/methods")
async def admin_get_payment_gateway_methods(
    payment_type: Optional[PaymentGatewayPaymentType] = None,
    admin: dict = Depends(get_admin_user),
):
    query: Dict[str, Any] = {}
    if payment_type:
        query["payment_type"] = payment_type
    methods = await db.payment_gateway_methods.find(query, {"_id": 0}).sort("payment_method_name", 1).to_list(500)
    return {"methods": methods}


@api_router.post("/admin/payment-gateway/methods")
async def admin_create_payment_gateway_method(
    method: PaymentGatewayMethodUpsert,
    admin: dict = Depends(get_admin_user),
):
    _validate_payment_gateway_method_input(method)

    doc = method.model_dump()
    doc.update(
        {
            "payment_method_id": str(uuid.uuid4()),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": admin["user_id"],
        }
    )

    await db.payment_gateway_methods.insert_one(doc)
    await log_action(admin["user_id"], "payment_gateway_method_create", {"payment_method_id": doc["payment_method_id"]})
    if "_id" in doc:
        del doc["_id"]
    return {"method": doc}


@api_router.put("/admin/payment-gateway/methods/{payment_method_id}")
async def admin_update_payment_gateway_method(
    payment_method_id: str,
    method: PaymentGatewayMethodUpsert,
    admin: dict = Depends(get_admin_user),
):
    _validate_payment_gateway_method_input(method)

    existing = await db.payment_gateway_methods.find_one({"payment_method_id": payment_method_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Payment gateway method not found")

    doc = method.model_dump()
    doc.update(
        {
            "payment_method_id": payment_method_id,
            "created_at": existing.get("created_at") or datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": admin["user_id"],
        }
    )

    await db.payment_gateway_methods.update_one({"payment_method_id": payment_method_id}, {"$set": doc})
    await log_action(admin["user_id"], "payment_gateway_method_update", {"payment_method_id": payment_method_id})
    return {"method": doc}


@api_router.delete("/admin/payment-gateway/methods/{payment_method_id}")
async def admin_delete_payment_gateway_method(
    payment_method_id: str,
    admin: dict = Depends(get_admin_user),
):
    result = await db.payment_gateway_methods.delete_one({"payment_method_id": payment_method_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Payment gateway method not found")
    await log_action(admin["user_id"], "payment_gateway_method_delete", {"payment_method_id": payment_method_id})
    return {"message": "Payment gateway method deleted"}


# Public endpoint for payment gateway methods (no auth required)
@api_router.get("/public/payment-gateway/methods")
async def get_public_payment_gateway_methods(
    payment_type: Optional[PaymentGatewayPaymentType] = None,
    currency: Optional[str] = None,
):
    query: Dict[str, Any] = {"status": "active"}
    if payment_type:
        query["payment_type"] = payment_type
    methods = await db.payment_gateway_methods.find(query, {"_id": 0}).sort("payment_method_name", 1).to_list(500)

    if currency:
        cur = currency.upper()
        methods = [m for m in methods if cur in (m.get("supported_currencies") or [])]

    return {
        "methods": methods
    }

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
            "plisio_secret_key": ""
        }
    return {"settings": settings}

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

# Public endpoint for app configuration (no auth required)
@api_router.get("/public/app-config")
async def get_public_app_config():
    """Get app configuration for public display (MonCash/NatCash numbers, etc.)"""
    settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
    if not settings:
        return {
            "moncash_enabled": False,
            "moncash_number": None,
            "moncash_name": None,
            "moncash_qr": None,
            "natcash_enabled": False,
            "natcash_number": None,
            "natcash_name": None,
            "natcash_qr": None,
            "zelle_email": "payments@kayicom.com",
            "zelle_name": "KAYICOM",
            "paypal_email": "payments@kayicom.com",
            "paypal_name": "KAYICOM",
            "card_order_fee_htg": 500
        }
    
    return {
        "moncash_enabled": settings.get("moncash_enabled", False),
        "moncash_number": settings.get("moncash_number") if settings.get("moncash_enabled") else None,
        "moncash_name": settings.get("moncash_name") if settings.get("moncash_enabled") else None,
        "moncash_qr": settings.get("moncash_qr") if settings.get("moncash_enabled") else None,
        "natcash_enabled": settings.get("natcash_enabled", False),
        "natcash_number": settings.get("natcash_number") if settings.get("natcash_enabled") else None,
        "natcash_name": settings.get("natcash_name") if settings.get("natcash_enabled") else None,
        "natcash_qr": settings.get("natcash_qr") if settings.get("natcash_enabled") else None,
        "zelle_email": settings.get("zelle_email", "payments@kayicom.com"),
        "zelle_name": settings.get("zelle_name", "KAYICOM"),
        "paypal_email": settings.get("paypal_email", "payments@kayicom.com"),
        "paypal_name": settings.get("paypal_name", "KAYICOM"),
        "card_order_fee_htg": settings.get("card_order_fee_htg", 500)
    }

@api_router.put("/admin/settings")
async def admin_update_settings(settings: AdminSettingsUpdate, admin: dict = Depends(get_admin_user)):
    try:
        # Convert empty strings to None for optional fields, but keep other values
        update_doc = {}
        for k, v in settings.model_dump().items():
            if v is not None:
                # Convert empty strings to None for string fields
                if isinstance(v, str) and v.strip() == "":
                    update_doc[k] = None
                else:
                    update_doc[k] = v
        
        update_doc["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        await db.settings.update_one(
            {"setting_id": "main"},
            {"$set": update_doc},
            upsert=True
        )
        
        await log_action(admin["user_id"], "settings_update", {"fields_updated": list(update_doc.keys())})
        
        return {"message": "Settings updated"}
    except Exception as e:
        logger.error(f"Error updating settings: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update settings: {str(e)}")

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

# Test Resend Email
class TestEmailRequest(BaseModel):
    email: Optional[str] = None

@api_router.post("/admin/test-email")
async def admin_test_email(
    request: TestEmailRequest,
    admin: dict = Depends(get_admin_user)
):
    """Test Resend email configuration"""
    test_email = request.email or admin.get("email")
    
    if not test_email:
        raise HTTPException(status_code=400, detail="Email address required")
    
    subject = "KAYICOM - Test Email"
    html_content = f"""
    <h2>Test Email from KAYICOM</h2>
    <p>Hello,</p>
    <p>This is a test email to verify that Resend email notifications are working correctly.</p>
    <p>If you received this email, your Resend configuration is successful!</p>
    <p>Sent at: {datetime.now(timezone.utc).isoformat()}</p>
    <p>Thank you for using KAYICOM!</p>
    """
    
    result = await send_email(test_email, subject, html_content)
    
    if result:
        await log_action(admin["user_id"], "test_email", {"email": test_email, "status": "success"})
        return {"message": f"Test email sent successfully to {test_email}"}
    else:
        await log_action(admin["user_id"], "test_email", {"email": test_email, "status": "failed"})
        raise HTTPException(status_code=500, detail="Failed to send test email. Check server logs for details.")

# Admin: Update card details (after approval)
@api_router.patch("/admin/virtual-card-orders/{order_id}/details")
async def admin_update_card_details(
    order_id: str,
    payload: CardDetailsPayload,
    admin: dict = Depends(get_admin_user)
):
    order = await db.virtual_card_orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    update_doc = {}
    if payload.card_brand:
        update_doc["card_brand"] = payload.card_brand
    if payload.card_type:
        update_doc["card_type"] = payload.card_type
    if payload.card_holder_name:
        update_doc["card_holder_name"] = payload.card_holder_name
    if payload.card_number:
        update_doc["card_number"] = payload.card_number
        update_doc["card_last4"] = payload.card_number[-4:]
    elif payload.card_last4:
        update_doc["card_last4"] = payload.card_last4
    if payload.card_expiry:
        update_doc["card_expiry"] = payload.card_expiry
    if payload.card_cvv:
        update_doc["card_cvv"] = payload.card_cvv
    if payload.billing_address:
        update_doc["billing_address"] = payload.billing_address
    if payload.billing_city:
        update_doc["billing_city"] = payload.billing_city
    if payload.billing_country:
        update_doc["billing_country"] = payload.billing_country
    if payload.billing_zip:
        update_doc["billing_zip"] = payload.billing_zip
    if payload.card_image:
        update_doc["card_image"] = payload.card_image
    if payload.admin_notes is not None:
        update_doc["admin_notes"] = payload.admin_notes
    
    if update_doc:
        await db.virtual_card_orders.update_one(
            {"order_id": order_id},
            {"$set": update_doc}
        )
    
    return {"message": "Card details updated"}

# Admin: Get all card top-up requests
@api_router.get("/admin/card-topups")
async def admin_get_card_topups(
    status: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    admin: dict = Depends(get_admin_user)
):
    query = {}
    if status:
        query["status"] = status
    
    deposits = await db.virtual_card_deposits.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"deposits": deposits}

# Admin: Process card top-up (approve/reject)
class CardTopUpProcessPayload(BaseModel):
    action: str  # approve or reject
    admin_notes: Optional[str] = None
    delivery_info: Optional[str] = None  # Confirmation of delivery to card

@api_router.patch("/admin/card-topups/{deposit_id}")
async def admin_process_card_topup(
    deposit_id: str,
    payload: CardTopUpProcessPayload,
    admin: dict = Depends(get_admin_user)
):
    deposit = await db.virtual_card_deposits.find_one({"deposit_id": deposit_id}, {"_id": 0})
    if not deposit:
        raise HTTPException(status_code=404, detail="Top-up request not found")
    
    if deposit["status"] != "pending":
        raise HTTPException(status_code=400, detail="Top-up already processed")
    
    if payload.action not in ["approve", "reject"]:
        raise HTTPException(status_code=400, detail="Invalid action")
    
    new_status = "approved" if payload.action == "approve" else "rejected"
    
    update_doc = {
        "status": new_status,
        "admin_notes": payload.admin_notes,
        "delivery_info": payload.delivery_info,
        "processed_at": datetime.now(timezone.utc).isoformat(),
        "processed_by": admin["user_id"]
    }
    
    await db.virtual_card_deposits.update_one(
        {"deposit_id": deposit_id},
        {"$set": update_doc}
    )
    
    # Update transaction status
    await db.transactions.update_one(
        {"reference_id": deposit_id},
        {"$set": {"status": "completed" if payload.action == "approve" else "refunded"}}
    )
    
    if payload.action == "reject":
        # Refund the amount to user's USD balance
        await db.users.update_one(
            {"user_id": deposit["user_id"]},
            {"$inc": {"wallet_usd": deposit["amount"]}}
        )
        
        # Create refund transaction
        await db.transactions.insert_one({
            "transaction_id": str(uuid.uuid4()),
            "user_id": deposit["user_id"],
            "type": "card_topup_refund",
            "amount": deposit["amount"],
            "currency": "USD",
            "status": "completed",
            "description": f"Card top-up refund (rejected)",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    await log_action(admin["user_id"], "card_topup_process", {"deposit_id": deposit_id, "action": payload.action})
    
    return {"message": f"Top-up {payload.action}d successfully"}

# Admin: Purge old records (older than X days)
@api_router.post("/admin/purge-old-records")
async def admin_purge_old_records(
    days: int = 7,
    admin: dict = Depends(get_admin_user)
):
    """Delete completed/rejected records older than X days"""
    cutoff_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    # Delete old agent deposits (keep pending ones)
    agent_result = await db.agent_deposits.delete_many({
        "status": {"$in": ["approved", "rejected"]},
        "created_at": {"$lt": cutoff_date}
    })
    
    # Delete old deposits (keep pending ones)
    deposits_result = await db.deposits.delete_many({
        "status": {"$in": ["completed", "rejected"]},
        "created_at": {"$lt": cutoff_date}
    })
    
    # Delete old withdrawals (keep pending ones)
    withdrawals_result = await db.withdrawals.delete_many({
        "status": {"$in": ["completed", "rejected"]},
        "created_at": {"$lt": cutoff_date}
    })
    
    # Delete old transactions
    transactions_result = await db.transactions.delete_many({
        "created_at": {"$lt": cutoff_date}
    })
    
    # Delete old logs
    logs_result = await db.logs.delete_many({
        "timestamp": {"$lt": cutoff_date}
    })
    
    await log_action(admin["user_id"], "purge_old_records", {
        "days": days,
        "deleted_agent_deposits": agent_result.deleted_count,
        "deleted_deposits": deposits_result.deleted_count,
        "deleted_withdrawals": withdrawals_result.deleted_count,
        "deleted_transactions": transactions_result.deleted_count,
        "deleted_logs": logs_result.deleted_count
    })
    
    return {
        "message": f"Purged records older than {days} days",
        "result": {
            "deleted_agent_deposits": agent_result.deleted_count,
            "deleted_deposits": deposits_result.deleted_count,
            "deleted_withdrawals": withdrawals_result.deleted_count,
            "deleted_transactions": transactions_result.deleted_count,
            "deleted_logs": logs_result.deleted_count
        }
    }

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

# ==================== WHATSAPP NOTIFICATIONS ====================

@api_router.get("/admin/whatsapp-notifications")
async def admin_get_whatsapp_notifications(
    status: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    admin: dict = Depends(get_admin_user)
):
    """Get WhatsApp notification history"""
    query = {}
    if status:
        query["status"] = status
    
    notifications = await db.whatsapp_notifications.find(
        query, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Get stats
    total = await db.whatsapp_notifications.count_documents({})
    sent = await db.whatsapp_notifications.count_documents({"status": "sent"})
    failed = await db.whatsapp_notifications.count_documents({"status": "failed"})
    pending = await db.whatsapp_notifications.count_documents({"status": "pending"})
    
    return {
        "notifications": notifications,
        "stats": {
            "total": total,
            "sent": sent,
            "failed": failed,
            "pending": pending
        }
    }

class TestWhatsAppRequest(BaseModel):
    phone_number: str
    message: str = "Tès notifikasyon WhatsApp depi KAYICOM"

@api_router.post("/admin/test-whatsapp")
async def admin_test_whatsapp(
    request: TestWhatsAppRequest,
    admin: dict = Depends(get_admin_user)
):
    """Test WhatsApp notification sending"""
    success = await send_whatsapp_notification(request.phone_number, request.message)
    
    # Log the test
    await db.logs.insert_one({
        "log_id": str(uuid.uuid4()),
        "user_id": admin["user_id"],
        "action": "whatsapp_test",
        "details": {
            "phone": request.phone_number,
            "success": success
        },
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    if success:
        return {"success": True, "message": "Mesaj WhatsApp voye avèk siksè"}
    else:
        return {"success": False, "message": "Echèk voye mesaj WhatsApp. Verifye konfigirasyon API a."}

class TestTelegramRequest(BaseModel):
    message: str = "🔔 Tès notifikasyon Telegram depi KAYICOM"

@api_router.post("/admin/test-telegram")
async def admin_test_telegram(
    request: TestTelegramRequest,
    admin: dict = Depends(get_admin_user)
):
    """Test Telegram notification sending"""
    success = await send_telegram_notification(request.message)
    
    # Log the test
    await db.logs.insert_one({
        "log_id": str(uuid.uuid4()),
        "user_id": admin["user_id"],
        "action": "telegram_test",
        "details": {"success": success},
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    if success:
        return {"success": True, "message": "Mesaj Telegram voye avèk siksè! ✅"}
    else:
        return {"success": False, "message": "Echèk voye mesaj Telegram. Verifye Bot Token ak Chat ID."}

@api_router.post("/admin/telegram/setup-webhook")
async def admin_setup_telegram_webhook(admin: dict = Depends(get_admin_user)):
    """Set up Telegram webhook URL for bot activation"""
    import httpx
    
    try:
        settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
        if not settings or not settings.get("telegram_enabled"):
            raise HTTPException(status_code=400, detail="Telegram not enabled in settings")
        
        bot_token = settings.get("telegram_bot_token")
        if not bot_token:
            raise HTTPException(status_code=400, detail="Telegram bot token not configured")
        
        # Get webhook URL from environment or construct it
        backend_url = os.environ.get("BACKEND_URL", "").rstrip("/")
        if not backend_url:
            raise HTTPException(status_code=400, detail="BACKEND_URL environment variable not set")
        
        webhook_url = f"{backend_url}/api/telegram/webhook"
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://api.telegram.org/bot{bot_token}/setWebhook",
                json={"url": webhook_url},
                timeout=30.0
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get("ok"):
                    await log_action(admin["user_id"], "telegram_webhook_setup", {"webhook_url": webhook_url})
                    return {
                        "success": True,
                        "message": "Webhook configured successfully",
                        "webhook_url": webhook_url,
                        "telegram_response": result
                    }
                else:
                    raise HTTPException(status_code=400, detail=f"Telegram API error: {result.get('description', 'Unknown error')}")
            else:
                raise HTTPException(status_code=400, detail=f"Failed to set webhook: {response.text}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting up Telegram webhook: {e}")
        raise HTTPException(status_code=500, detail=f"Error setting up webhook: {str(e)}")

# ==================== MAIN ROUTES ====================

@api_router.get("/")
async def root():
    return {"message": "KAYICOM Wallet API", "version": "1.0.0"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

@app.get("/")
async def health_check():
    return {"status": "online", "message": "Wisebond Backend API"}

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
    await db.users.create_index("phone")
    await db.users.create_index("is_agent")
    await db.transactions.create_index([("user_id", 1), ("created_at", -1)])
    await db.deposits.create_index([("user_id", 1), ("status", 1)])
    await db.withdrawals.create_index([("user_id", 1), ("status", 1)])
    await db.kyc.create_index("user_id", unique=True)
    await db.agent_deposits.create_index([("agent_id", 1), ("status", 1)])
    await db.agent_deposits.create_index([("client_user_id", 1)])
    await db.agent_requests.create_index([("user_id", 1)])
    await db.payment_gateway_methods.create_index("payment_method_id", unique=True)
    await db.payment_gateway_methods.create_index([("payment_type", 1), ("status", 1)])
    
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
            "updated_at": datetime.now(timezone.utc).isoformat()
        })

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
