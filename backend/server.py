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
from typing import List, Optional, Dict, Any, Literal
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
from jose import jwt, JWTError
import secrets
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

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

    # Live Chat (Crisp)
    crisp_enabled: Optional[bool] = None
    crisp_website_id: Optional[str] = None

    # WhatsApp
    whatsapp_enabled: Optional[bool] = None
    whatsapp_number: Optional[str] = None

    # USDT (Plisio) - demo credentials (optional)
    plisio_enabled: Optional[bool] = None
    plisio_api_key: Optional[str] = None
    plisio_secret_key: Optional[str] = None

    # Business config
    card_order_fee_htg: Optional[int] = None
    card_bonus_usd: Optional[float] = None
    affiliate_reward_htg: Optional[int] = None
    affiliate_cards_required: Optional[int] = None


class PaymentMethodUpsert(BaseModel):
    method_id: str = Field(..., description="Unique id like 'moncash', 'zelle', 'usdt_trc20'")
    flow: Literal["deposit", "withdrawal"]
    currencies: List[Literal["HTG", "USD"]] = Field(default_factory=list)
    display_name: str
    enabled: bool = True
    sort_order: int = 0
    # What the user should see (instructions, recipient address/number/email, etc.)
    public: Dict[str, Any] = Field(default_factory=dict)
    # Secrets/admin-only credentials (API keys, logins, etc.)
    private: Dict[str, Any] = Field(default_factory=dict)


class PaymentMethodPublicResponse(BaseModel):
    method_id: str
    flow: Literal["deposit", "withdrawal"]
    currencies: List[Literal["HTG", "USD"]]
    display_name: str
    enabled: bool
    sort_order: int
    public: Dict[str, Any]


class TeamMemberCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: str
    role: Optional[str] = "admin"


class TeamMemberUpdate(BaseModel):
    is_active: Optional[bool] = None
    role: Optional[str] = None

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

async def get_main_settings() -> dict:
    settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
    return settings or {}

def setting_bool(settings: dict, key: str, default: bool = False) -> bool:
    value = settings.get(key, default)
    return bool(value)

async def send_email(to_email: str, subject: str, html_content: str):
    try:
        settings = await get_main_settings()
        if settings and not setting_bool(settings, "resend_enabled", False):
            logger.info("Email sending disabled in settings")
            return False

        resend_key = settings.get("resend_api_key") or os.environ.get("RESEND_API_KEY")
        sender = settings.get("sender_email") or os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
        
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
    if request.method == "card":
        # Card withdrawal fees are configured in /admin/card-fees (range based)
        if target_currency != "USD":
            raise HTTPException(status_code=400, detail="Card withdrawals are only available in USD")
        card_fee_doc = await db.card_fees.find_one(
            {"min_amount": {"$lte": request.amount}, "max_amount": {"$gte": request.amount}},
            {"_id": 0}
        )
        if card_fee_doc:
            fee = float(card_fee_doc.get("fee", 0))
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
    
    return {
        "affiliate_code": current_user["affiliate_code"],
        "affiliate_link": f"{os.environ.get('FRONTEND_URL', 'http://localhost:3000')}/register?ref={current_user['affiliate_code']}",
        "earnings": current_user.get("affiliate_earnings", 0),
        "referrals": enriched_referrals,
        "referrals_with_cards": referrals_with_cards
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

# Defaults; real values can be overridden in /admin/settings
DEFAULT_CARD_FEE_HTG = 500
DEFAULT_CARD_BONUS_USD = 5

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
    
    settings = await get_main_settings()
    card_fee_htg = int(settings.get("card_order_fee_htg", DEFAULT_CARD_FEE_HTG))

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
        settings = await get_main_settings()
        card_bonus_usd = float(settings.get("card_bonus_usd", DEFAULT_CARD_BONUS_USD))
        # Add $5 USD bonus to user's wallet
        await db.users.update_one(
            {"user_id": order["user_id"]},
            {"$inc": {"wallet_usd": card_bonus_usd}}
        )
        
        # Create bonus transaction
        await db.transactions.insert_one({
            "transaction_id": str(uuid.uuid4()),
            "user_id": order["user_id"],
            "type": "card_bonus",
            "amount": card_bonus_usd,
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
        await db.users.update_one(
            {"user_id": order["user_id"]},
            {"$inc": {"wallet_htg": float(order.get("fee", DEFAULT_CARD_FEE_HTG))}}
        )
        
        await db.transactions.insert_one({
            "transaction_id": str(uuid.uuid4()),
            "user_id": order["user_id"],
            "type": "card_order_refund",
            "amount": float(order.get("fee", DEFAULT_CARD_FEE_HTG)),
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

    settings = await get_main_settings()
    cards_required = int(settings.get("affiliate_cards_required", 5))
    reward_unit_htg = int(settings.get("affiliate_reward_htg", 2000))
    
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
    milestones = (cards_count // max(cards_required, 1))
    new_rewards = milestones - rewarded_count
    
    if new_rewards > 0:
        reward_amount = new_rewards * reward_unit_htg  # HTG per milestone
        
        await db.users.update_one(
            {"user_id": referrer["user_id"]},
            {
                "$inc": {"affiliate_earnings": reward_amount},
                "$set": {"affiliate_cards_rewarded": milestones}
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
            "description": f"Affiliate reward for {new_rewards * max(cards_required, 1)} card orders",
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
    
    deposits = await db.deposits.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"deposits": deposits}

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
        # Refund the amount
        refund_currency = (withdrawal.get("source_currency") or withdrawal.get("currency") or "usd").lower()
        currency_key = f"wallet_{refund_currency}"
        refund_amount = float(withdrawal.get("amount_deducted", withdrawal.get("amount", 0)))
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
    defaults = {
        "setting_id": "main",
        # Email (Resend)
        "resend_enabled": False,
        "resend_api_key": "",
        "sender_email": "",
        # Live Chat (Crisp)
        "crisp_enabled": False,
        "crisp_website_id": "",
        # WhatsApp
        "whatsapp_enabled": False,
        "whatsapp_number": "",
        # USDT (Plisio)
        "plisio_enabled": False,
        "plisio_api_key": "",
        "plisio_secret_key": "",
        # Business config
        "card_order_fee_htg": 500,
        "card_bonus_usd": 5,
        "affiliate_reward_htg": 2000,
        "affiliate_cards_required": 5,
    }
    stored = await get_main_settings()
    settings = {**defaults, **stored}
    return {"settings": settings}

# Public endpoint for chat settings (no auth required)
@api_router.get("/public/chat-settings")
async def get_public_chat_settings():
    """Get chat settings for public display (Crisp/WhatsApp)"""
    settings = await get_main_settings()
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

# Public app config (no auth required) - safe values only
@api_router.get("/public/app-config")
async def get_public_app_config():
    settings = await get_main_settings()
    return {
        "card_order_fee_htg": int(settings.get("card_order_fee_htg", 500)),
        "card_bonus_usd": float(settings.get("card_bonus_usd", 5)),
        "affiliate_reward_htg": int(settings.get("affiliate_reward_htg", 2000)),
        "affiliate_cards_required": int(settings.get("affiliate_cards_required", 5)),
    }

@api_router.put("/admin/settings")
async def admin_update_settings(settings: AdminSettingsUpdate, admin: dict = Depends(get_admin_user)):
    update_doc = {k: v for k, v in settings.model_dump().items() if v is not None}
    update_doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.settings.update_one(
        {"setting_id": "main"},
        {"$set": update_doc},
        upsert=True
    )
    
    await log_action(admin["user_id"], "settings_update", {"fields_updated": list(update_doc.keys())})
    
    return {"message": "Settings updated"}

# ==================== PAYMENT METHODS (Admin + Public) ====================

@api_router.get("/admin/payment-methods")
async def admin_get_payment_methods(
    flow: Optional[str] = None,
    admin: dict = Depends(get_admin_user)
):
    query: Dict[str, Any] = {}
    if flow:
        query["flow"] = flow
    methods = await db.payment_methods.find(query, {"_id": 0}).sort([("flow", 1), ("sort_order", 1), ("display_name", 1)]).to_list(500)
    return {"methods": methods}

@api_router.put("/admin/payment-methods")
async def admin_upsert_payment_method(method: PaymentMethodUpsert, admin: dict = Depends(get_admin_user)):
    doc = method.model_dump()
    now = datetime.now(timezone.utc).isoformat()
    doc["updated_at"] = now
    doc["updated_by"] = admin["user_id"]
    await db.payment_methods.update_one(
        {"flow": doc["flow"], "method_id": doc["method_id"]},
        {"$set": doc, "$setOnInsert": {"created_at": now}},
        upsert=True
    )
    saved = await db.payment_methods.find_one({"flow": doc["flow"], "method_id": doc["method_id"]}, {"_id": 0})
    await log_action(admin["user_id"], "payment_method_upsert", {"flow": doc["flow"], "method_id": doc["method_id"]})
    return {"method": saved}

@api_router.delete("/admin/payment-methods/{flow}/{method_id}")
async def admin_delete_payment_method(flow: str, method_id: str, admin: dict = Depends(get_admin_user)):
    result = await db.payment_methods.delete_one({"flow": flow, "method_id": method_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Payment method not found")
    await log_action(admin["user_id"], "payment_method_delete", {"flow": flow, "method_id": method_id})
    return {"message": "Payment method deleted"}

@api_router.post("/admin/payment-methods/seed")
async def admin_seed_payment_methods(admin: dict = Depends(get_admin_user)):
    """Create/update a default demo set of payment methods."""
    now = datetime.now(timezone.utc).isoformat()
    defaults: List[dict] = [
        # Deposits - HTG
        {
            "flow": "deposit",
            "method_id": "moncash",
            "display_name": "MonCash",
            "currencies": ["HTG"],
            "enabled": True,
            "sort_order": 10,
            "public": {
                "recipient": "+509 0000 0000",
                "instructions": "Voye montan an sou MonCash epi telechaje prèv peman an."
            },
            "private": {}
        },
        {
            "flow": "deposit",
            "method_id": "natcash",
            "display_name": "NatCash",
            "currencies": ["HTG"],
            "enabled": True,
            "sort_order": 20,
            "public": {
                "recipient": "+509 0000 0000",
                "instructions": "Voye montan an sou NatCash epi telechaje prèv peman an."
            },
            "private": {}
        },
        # Deposits - USD
        {
            "flow": "deposit",
            "method_id": "zelle",
            "display_name": "Zelle",
            "currencies": ["USD"],
            "enabled": True,
            "sort_order": 30,
            "public": {
                "recipient": "payments@kayicom.com",
                "instructions": "Voye peman an via Zelle sou adrès sa a epi telechaje prèv peman an."
            },
            "private": {}
        },
        {
            "flow": "deposit",
            "method_id": "paypal",
            "display_name": "PayPal",
            "currencies": ["USD"],
            "enabled": True,
            "sort_order": 40,
            "public": {
                "recipient": "payments@kayicom.com",
                "instructions": "Voye peman an via PayPal sou email sa a epi telechaje prèv peman an."
            },
            "private": {}
        },
        {
            "flow": "deposit",
            "method_id": "usdt_trc20",
            "display_name": "USDT (TRC-20)",
            "currencies": ["USD"],
            "enabled": True,
            "sort_order": 50,
            "public": {
                "network": "TRC-20",
                "address": "TRx1234567890abcdefghijklmnop",
                "instructions": "Voye USDT sou adrès sa a sou rezo TRC-20."
            },
            "private": {}
        },
        {
            "flow": "deposit",
            "method_id": "usdt_erc20",
            "display_name": "USDT (ERC-20)",
            "currencies": ["USD"],
            "enabled": True,
            "sort_order": 60,
            "public": {
                "network": "ERC-20",
                "address": "0x1234567890abcdef1234567890abcdef12345678",
                "instructions": "Voye USDT sou adrès sa a sou rezo ERC-20."
            },
            "private": {}
        },
        # Withdrawals
        {
            "flow": "withdrawal",
            "method_id": "moncash",
            "display_name": "MonCash",
            "currencies": ["HTG"],
            "enabled": True,
            "sort_order": 10,
            "public": {"placeholder": "Nimewo telefòn MonCash"},
            "private": {}
        },
        {
            "flow": "withdrawal",
            "method_id": "natcash",
            "display_name": "NatCash",
            "currencies": ["HTG"],
            "enabled": True,
            "sort_order": 20,
            "public": {"placeholder": "Nimewo telefòn NatCash"},
            "private": {}
        },
        {
            "flow": "withdrawal",
            "method_id": "card",
            "display_name": "Kat Vityèl",
            "currencies": ["USD"],
            "enabled": True,
            "sort_order": 25,
            "public": {"placeholder": "Email kat vityèl ou", "onlyField": "email"},
            "private": {}
        },
        {
            "flow": "withdrawal",
            "method_id": "zelle",
            "display_name": "Zelle",
            "currencies": ["USD"],
            "enabled": True,
            "sort_order": 30,
            "public": {"placeholder": "Email ou telefòn Zelle"},
            "private": {}
        },
        {
            "flow": "withdrawal",
            "method_id": "paypal",
            "display_name": "PayPal",
            "currencies": ["USD"],
            "enabled": True,
            "sort_order": 40,
            "public": {"placeholder": "Email PayPal"},
            "private": {}
        },
        {
            "flow": "withdrawal",
            "method_id": "usdt",
            "display_name": "USDT",
            "currencies": ["USD"],
            "enabled": True,
            "sort_order": 50,
            "public": {"placeholder": "Adrès USDT (TRC-20 ou ERC-20)"},
            "private": {}
        },
        {
            "flow": "withdrawal",
            "method_id": "bank_usa",
            "display_name": "Bank USA",
            "currencies": ["USD"],
            "enabled": True,
            "sort_order": 60,
            "public": {"placeholder": "Routing + Account Number"},
            "private": {}
        },
    ]

    upserted = 0
    for d in defaults:
        d["enabled"] = bool(d.get("enabled", True))
        d["updated_at"] = now
        d["updated_by"] = admin["user_id"]
        await db.payment_methods.update_one(
            {"flow": d["flow"], "method_id": d["method_id"]},
            {"$set": d, "$setOnInsert": {"created_at": now}},
            upsert=True
        )
        upserted += 1

    await log_action(admin["user_id"], "payment_method_seed", {"count": upserted})
    return {"message": f"Seeded {upserted} payment methods"}

@api_router.get("/public/payment-methods", response_model=List[PaymentMethodPublicResponse])
async def public_get_payment_methods(
    flow: str = Query(..., description="deposit|withdrawal"),
    currency: Optional[str] = Query(default=None, description="HTG|USD")
):
    query: Dict[str, Any] = {"flow": flow, "enabled": True}
    if currency:
        query["currencies"] = currency.upper()
    docs = await db.payment_methods.find(query, {"_id": 0, "private": 0}).sort([("sort_order", 1), ("display_name", 1)]).to_list(200)
    normalized: List[PaymentMethodPublicResponse] = []
    for d in docs:
        d.setdefault("sort_order", 0)
        d.setdefault("public", {})
        d.setdefault("currencies", [])
        d.setdefault("enabled", True)
        normalized.append(PaymentMethodPublicResponse(**d))
    return normalized

# ==================== TEAM (Admin Users) ====================

@api_router.get("/admin/team")
async def admin_get_team(admin: dict = Depends(get_admin_user)):
    team = await db.users.find({"is_admin": True}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(200)
    return {"team": team}

@api_router.post("/admin/team")
async def admin_create_team_member(member: TeamMemberCreate, admin: dict = Depends(get_admin_user)):
    existing = await db.users.find_one({"email": member.email.lower()}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_id = str(uuid.uuid4())
    admin_doc = {
        "user_id": user_id,
        "client_id": generate_client_id(),
        "email": member.email.lower(),
        "password_hash": hash_password(member.password),
        "full_name": member.full_name,
        "phone": member.phone,
        "language": "fr",
        "kyc_status": "approved",
        "wallet_htg": 0.0,
        "wallet_usd": 0.0,
        "affiliate_code": generate_affiliate_code(),
        "affiliate_earnings": 0.0,
        "referred_by": None,
        "is_active": True,
        "is_admin": True,
        "admin_role": member.role or "admin",
        "two_factor_enabled": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(admin_doc)
    await log_action(admin["user_id"], "team_create", {"user_id": user_id, "email": member.email.lower(), "role": member.role})
    admin_doc.pop("password_hash", None)
    return {"member": admin_doc}

@api_router.patch("/admin/team/{user_id}")
async def admin_update_team_member(user_id: str, update: TeamMemberUpdate, admin: dict = Depends(get_admin_user)):
    target = await db.users.find_one({"user_id": user_id, "is_admin": True}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Team member not found")

    update_doc: Dict[str, Any] = {}
    if update.is_active is not None:
        update_doc["is_active"] = update.is_active
    if update.role is not None:
        update_doc["admin_role"] = update.role
    if not update_doc:
        return {"message": "No changes"}

    await db.users.update_one({"user_id": user_id}, {"$set": update_doc})
    await log_action(admin["user_id"], "team_update", {"user_id": user_id, **update_doc})
    saved = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    return {"member": saved}

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
    await db.payment_methods.create_index([("flow", 1), ("method_id", 1)], unique=True)
    
    # Create default admin if not exists
    admin = await db.users.find_one({"is_admin": True}, {"_id": 0})
    if not admin:
        admin_doc = {
            "user_id": str(uuid.uuid4()),
            "client_id": "KCADMIN001",
            "email": "graciaemmanuel509@gmail.com",
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
        logger.info("Default admin created: graciaemmanuel509@gmail.com / Admin123!")
    
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
