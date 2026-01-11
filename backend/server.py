from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, Query, Request
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from pydantic.config import ConfigDict
from typing import Any, Dict, List, Literal, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
from jose import jwt, JWTError
import secrets
import base64
import binascii
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

# ==================== KYC IMAGE STORAGE (OPTIONAL CLOUDINARY) ====================

_DATA_URL_IMAGE_RE = re.compile(
    r"^data:(image/(?:png|jpe?g|webp));base64,(.+)$",
    flags=re.IGNORECASE | re.DOTALL,
)

def _cloudinary_creds(settings: Optional[dict]) -> Dict[str, Optional[str]]:
    """
    Prefer DB settings (admin-configured) over environment variables.
    This allows non-technical admins to configure KYC storage without redeploys.
    """
    s = settings or {}
    cloud_name = (s.get("cloudinary_cloud_name") or os.environ.get("CLOUDINARY_CLOUD_NAME") or "").strip() or None
    api_key = (s.get("cloudinary_api_key") or os.environ.get("CLOUDINARY_API_KEY") or "").strip() or None
    api_secret = (s.get("cloudinary_api_secret") or os.environ.get("CLOUDINARY_API_SECRET") or "").strip() or None
    folder = (s.get("cloudinary_folder") or os.environ.get("CLOUDINARY_FOLDER") or "kayicom/kyc").strip().strip("/") or "kayicom/kyc"
    return {"cloud_name": cloud_name, "api_key": api_key, "api_secret": api_secret, "folder": folder}


def _cloudinary_is_configured(settings: Optional[dict]) -> bool:
    c = _cloudinary_creds(settings)
    return bool(c.get("cloud_name") and c.get("api_key") and c.get("api_secret"))


def _cloudinary_setup(settings: Optional[dict]) -> bool:
    if not _cloudinary_is_configured(settings):
        return False
    # Lazy import so the backend still starts even if the dependency is missing locally.
    import cloudinary  # type: ignore
    c = _cloudinary_creds(settings)

    cloudinary.config(
        cloud_name=c["cloud_name"],
        api_key=c["api_key"],
        api_secret=c["api_secret"],
        secure=True,
    )
    return True


def _parse_image_data_url(value: str) -> Optional[Dict[str, Any]]:
    """
    Parse `data:image/...;base64,....` and return mime + bytes.
    Returns None if the input is not a data URL.
    """
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


async def _cloudinary_upload_data_url(*, settings: Optional[dict], data_url: str, folder: str, public_id: str) -> str:
    if not _cloudinary_setup(settings):
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
    settings: Optional[dict] = None,
) -> Dict[str, Any]:
    """
    Returns a dict:
      - value: stored string (URL or data URL)
      - meta: metadata for auditing
    """
    if not value:
        return {"value": value, "meta": None}

    parsed = _parse_image_data_url(value)
    if not parsed:
        # Already a URL or non-data string. Keep as-is.
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
    max_bytes = int((settings or {}).get("kyc_max_image_bytes") or os.environ.get("KYC_MAX_IMAGE_BYTES") or 5 * 1024 * 1024)
    if len(raw) > max_bytes:
        raise HTTPException(status_code=413, detail="Image too large")

    if mime not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=400, detail="Unsupported image type")

    # Prefer Cloudinary when configured; fall back to inline storage.
    if _cloudinary_is_configured(settings):
        folder = _cloudinary_creds(settings).get("folder") or "kayicom/kyc"
        public_id = f"{kyc_id}_{field_name}"
        try:
            url = await _cloudinary_upload_data_url(settings=settings, data_url=parsed["data_url"], folder=folder, public_id=public_id)
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

# ==================== STROWALLET (VIRTUAL CARDS) HELPERS ====================

def _env_bool(key: str, default: bool = False) -> bool:
    raw = (os.environ.get(key, "") or "").strip().lower()
    if raw in {"1", "true", "yes", "y", "on"}:
        return True
    if raw in {"0", "false", "no", "n", "off"}:
        return False
    return default

def _strowallet_enabled(settings: Optional[dict]) -> bool:
    if settings and isinstance(settings.get("strowallet_enabled"), bool):
        return bool(settings["strowallet_enabled"])
    return _env_bool("STROWALLET_ENABLED", False)

def _virtual_cards_enabled(settings: Optional[dict]) -> bool:
    """
    Customer-facing Virtual Cards feature flag.
    Requirement: if Strowallet automation is not enabled, the feature should not show for clients.
    """
    return _strowallet_enabled(settings)

def _strowallet_config(settings: Optional[dict]) -> Dict[str, str]:
    # Default to strowallet.com to avoid silent "enabled but no base_url" misconfig.
    base_url = ((settings or {}).get("strowallet_base_url") or os.environ.get("STROWALLET_BASE_URL") or "https://strowallet.com").strip()
    api_key = ((settings or {}).get("strowallet_api_key") or os.environ.get("STROWALLET_API_KEY") or "").strip()
    api_secret = ((settings or {}).get("strowallet_api_secret") or os.environ.get("STROWALLET_API_SECRET") or "").strip()
    brand_name = ((settings or {}).get("strowallet_brand_name") or os.environ.get("STROWALLET_BRAND_NAME") or "").strip()
    if not brand_name:
        brand_name = "KAYICOM"

    try:
        stw_amount = float((settings or {}).get("strowallet_create_card_amount_usd") or os.environ.get("STROWALLET_CREATE_CARD_AMOUNT_USD") or 5)
    except Exception:
        stw_amount = 5.0

    # Endpoint paths can vary by Strowallet plan; allow overrides.
    # Defaults tuned for Strowallet bitvcard endpoints.
    create_user_path = _normalize_strowallet_path(
        (settings or {}).get("strowallet_create_user_path") or os.environ.get("STROWALLET_CREATE_USER_PATH"),
        "/api/bitvcard/create-user/",
    )
    create_path = _normalize_strowallet_path(
        (settings or {}).get("strowallet_create_card_path") or os.environ.get("STROWALLET_CREATE_CARD_PATH"),
        "/api/bitvcard/create-card/",
    )
    fund_path = _normalize_strowallet_path(
        (settings or {}).get("strowallet_fund_card_path") or os.environ.get("STROWALLET_FUND_CARD_PATH"),
        "/api/bitvcard/fund-card/",
    )
    withdraw_path = _normalize_strowallet_path(
        (settings or {}).get("strowallet_withdraw_card_path") or os.environ.get("STROWALLET_WITHDRAW_CARD_PATH"),
        "",
    )
    fetch_detail_path = _normalize_strowallet_path(
        (settings or {}).get("strowallet_fetch_card_detail_path") or os.environ.get("STROWALLET_FETCH_CARD_DETAIL_PATH"),
        "/api/bitvcard/fetch-card-detail/",
    )
    card_tx_path = _normalize_strowallet_path(
        (settings or {}).get("strowallet_card_transactions_path") or os.environ.get("STROWALLET_CARD_TRANSACTIONS_PATH"),
        "/api/bitvcard/card-transactions/",
    )
    set_limit_path = _normalize_strowallet_path(
        (settings or {}).get("strowallet_set_limit_path") or os.environ.get("STROWALLET_SET_LIMIT_PATH"),
        "",
    )
    freeze_path = _normalize_strowallet_path(
        (settings or {}).get("strowallet_freeze_card_path") or os.environ.get("STROWALLET_FREEZE_CARD_PATH"),
        "",
    )
    unfreeze_path = _normalize_strowallet_path(
        (settings or {}).get("strowallet_unfreeze_card_path") or os.environ.get("STROWALLET_UNFREEZE_CARD_PATH"),
        "",
    )
    freeze_unfreeze_path = _normalize_strowallet_path(
        (settings or {}).get("strowallet_freeze_unfreeze_path") or os.environ.get("STROWALLET_FREEZE_UNFREEZE_PATH"),
        "",
    )
    full_history_path = _normalize_strowallet_path(
        (settings or {}).get("strowallet_full_card_history_path") or os.environ.get("STROWALLET_FULL_CARD_HISTORY_PATH"),
        "",
    )
    withdraw_status_path = _normalize_strowallet_path(
        (settings or {}).get("strowallet_withdraw_status_path") or os.environ.get("STROWALLET_WITHDRAW_STATUS_PATH"),
        "",
    )
    upgrade_limit_path = _normalize_strowallet_path(
        (settings or {}).get("strowallet_upgrade_limit_path") or os.environ.get("STROWALLET_UPGRADE_LIMIT_PATH"),
        "",
    )

    base_url = base_url.rstrip("/")
    # (paths already normalized)

    return {
        "base_url": base_url,
        "api_key": api_key,
        "api_secret": api_secret,
        "create_user_path": create_user_path,
        "create_path": create_path,
        "fund_path": fund_path,
        "withdraw_path": withdraw_path,
        "fetch_detail_path": fetch_detail_path,
        "card_tx_path": card_tx_path,
        "brand_name": brand_name,
        "create_card_amount_usd": stw_amount,
        "set_limit_path": set_limit_path,
        "freeze_path": freeze_path,
        "unfreeze_path": unfreeze_path,
        "freeze_unfreeze_path": freeze_unfreeze_path,
        "full_history_path": full_history_path,
        "withdraw_status_path": withdraw_status_path,
        "upgrade_limit_path": upgrade_limit_path,
    }

def _extract_first(d: Any, *paths: str) -> Optional[Any]:
    """
    Best-effort extractor for varying API responses.
    paths are dot-separated keys (e.g. 'data.card.id').
    """
    for path in paths:
        cur: Any = d
        ok = True
        for key in path.split("."):
            if isinstance(cur, dict) and key in cur:
                cur = cur[key]
                continue

            # Support providers that return arrays at intermediate nodes.
            # Examples:
            # - {"data": [{"card_id": "..."}]} with path "data.card_id"
            # - {"data": [{"card": {"id": "..."}}]} with path "data.card.id"
            if isinstance(cur, list):
                # Numeric index support: "data.0.card_id"
                if key.isdigit():
                    idx = int(key)
                    if 0 <= idx < len(cur):
                        cur = cur[idx]
                        continue
                    ok = False
                    break

                # Non-index key: find the first object containing that key.
                found = False
                for item in cur:
                    if isinstance(item, dict) and key in item and item[key] is not None:
                        cur = item[key]
                        found = True
                        break
                if found:
                    continue

            ok = False
            break
        if ok and cur is not None:
            return cur
    return None


def _mask_secret(value: Optional[str], *, keep_last: int = 4) -> str:
    """
    Mask a secret for UI display. Never returns the full value.
    """
    v = (value or "").strip()
    if not v:
        return ""
    if len(v) <= keep_last:
        return "*" * len(v)
    return ("*" * (len(v) - keep_last)) + v[-keep_last:]


_SENSITIVE_KEY_SUBSTRINGS = {
    "card_number",
    "pan",
    "cvv",
    "cvc",
    "security_code",
    "pin",
}

_SENSITIVE_KEY_EXACT = {
    # Some providers use generic key names for PAN/CVV
    "number",
    "cardnumber",
}


def _redact_sensitive_payload(obj: Any) -> Any:
    """
    Recursively redact common sensitive fields in provider payloads.
    SECURITY: this is best-effort; never rely on it as the only control.
    """
    if isinstance(obj, dict):
        out: Dict[str, Any] = {}
        for k, v in obj.items():
            kl = str(k).lower()
            if (kl in _SENSITIVE_KEY_EXACT) or any(s in kl for s in _SENSITIVE_KEY_SUBSTRINGS):
                # If it's a likely PAN, keep last 4 for debugging.
                if isinstance(v, str):
                    digits = "".join(ch for ch in v if ch.isdigit())
                    if 12 <= len(digits) <= 19:
                        out[k] = _mask_secret(digits, keep_last=4)
                    else:
                        out[k] = "***REDACTED***"
                else:
                    out[k] = "***REDACTED***"
            else:
                out[k] = _redact_sensitive_payload(v)
        return out
    if isinstance(obj, list):
        return [_redact_sensitive_payload(v) for v in obj]
    return obj


def _safe_float(v: Any) -> Optional[float]:
    try:
        if v is None:
            return None
        # Handle numeric strings with commas/spaces
        if isinstance(v, str):
            vv = v.strip().replace(",", "")
            if vv == "":
                return None
            return float(vv)
        return float(v)
    except Exception:
        return None


def _extract_float_first(d: Any, *paths: str) -> Optional[float]:
    """
    Best-effort numeric extractor for varying provider schemas.
    """
    raw = _extract_first(d, *paths)
    return _safe_float(raw)

def _with_aliases(payload: Dict[str, Any], key: str, *aliases: str) -> Dict[str, Any]:
    """
    Add common alias keys for a given payload field if present.
    Useful for provider APIs that vary in naming conventions.
    """
    if key not in payload or payload[key] in (None, ""):
        return payload
    v = payload[key]
    for a in aliases:
        if a and a not in payload:
            payload[a] = v
    return payload

def _normalize_strowallet_path(raw: Optional[str], default: str) -> str:
    """
    Normalize an endpoint path.
    Accepts a path ("/api/...") or full URL ("https://.../api/...") and returns a clean path.
    """
    import re
    from urllib.parse import urlparse

    v = (raw or "").strip()
    if not v:
        v = (default or "").strip()
    if not v:
        return ""

    if v.startswith("http://") or v.startswith("https://"):
        try:
            v = urlparse(v).path or ""
        except Exception:
            pass

    # If host got embedded into the path, strip it.
    if "strowallet.com" in v:
        idx = v.find("strowallet.com")
        tail = v[idx + len("strowallet.com") :]
        if tail.startswith("/"):
            v = tail

    v = v.strip()
    if not v:
        return ""
    if not v.startswith("/"):
        v = f"/{v}"

    # Collapse duplicate slashes
    v = re.sub(r"/{2,}", "/", v)
    return v

def _ensure_strowallet_auth_payload(payload: Dict[str, Any], cfg: Dict[str, str]) -> Dict[str, Any]:
    """
    Some Strowallet endpoints require auth keys inside the JSON body (e.g. `public_key`).
    Add common auth fields if missing (do not overwrite user-provided values).
    """
    if not isinstance(payload, dict):
        return payload
    api_key = (cfg.get("api_key") or "").strip()
    api_secret = (cfg.get("api_secret") or "").strip()

    if api_key:
        payload.setdefault("public_key", api_key)
        payload.setdefault("api_key", api_key)
        payload.setdefault("key", api_key)
    if api_secret:
        payload.setdefault("secret_key", api_secret)
        payload.setdefault("api_secret", api_secret)
        payload.setdefault("secret", api_secret)
    return payload

async def _strowallet_post(settings: Optional[dict], path: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    cfg = _strowallet_config(settings)
    if not cfg["base_url"] or not cfg["api_key"]:
        raise ValueError("Strowallet is enabled but STROWALLET_BASE_URL / STROWALLET_API_KEY is not configured")

    url = f"{cfg['base_url']}{path}"
    headers = {
        # Different Strowallet deployments use different auth schemes; send both.
        "Authorization": f"Bearer {cfg['api_key']}",
        "X-API-Key": cfg["api_key"],
        "x-api-key": cfg["api_key"],
        "api-key": cfg["api_key"],
        "public_key": cfg["api_key"],
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    # Optional extra secret header (some Strowallet setups require key + secret).
    if cfg.get("api_secret"):
        headers["X-API-Secret"] = cfg["api_secret"]
        headers["x-api-secret"] = cfg["api_secret"]
        headers["api-secret"] = cfg["api_secret"]
        headers["secret_key"] = cfg["api_secret"]

    # Also include auth keys in JSON body (many Strowallet endpoints require `public_key` field).
    payload = _ensure_strowallet_auth_payload(payload or {}, cfg)

    async with httpx.AsyncClient(timeout=httpx.Timeout(30.0)) as client:
        resp = await client.post(url, json=payload, headers=headers)
        try:
            data = resp.json()
        except Exception:
            data = {"raw": resp.text}

    if resp.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Strowallet API error ({resp.status_code}): {data}")

    # Some APIs return 200 with an error field; treat obvious failures as errors.
    success = _extract_first(data, "success", "status", "data.status")
    if isinstance(success, bool) and success is False:
        raise HTTPException(status_code=502, detail=f"Strowallet API error: {data}")
    if isinstance(success, str) and success.lower() in {"failed", "error", "false"}:
        raise HTTPException(status_code=502, detail=f"Strowallet API error: {data}")

    return data


async def _strowallet_get(settings: Optional[dict], path: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    cfg = _strowallet_config(settings)
    url = cfg["base_url"].rstrip("/") + "/" + str(path or "").lstrip("/")
    headers = {
        "x-api-key": cfg["api_key"],
        "api-key": cfg["api_key"],
        "public_key": cfg["api_key"],
        "Accept": "application/json",
    }
    if cfg.get("api_secret"):
        headers["X-API-Secret"] = cfg["api_secret"]
        headers["x-api-secret"] = cfg["api_secret"]
        headers["api-secret"] = cfg["api_secret"]
        headers["secret_key"] = cfg["api_secret"]

    async with httpx.AsyncClient(timeout=httpx.Timeout(30.0)) as client:
        resp = await client.get(url, params=(params or {}), headers=headers)
        try:
            data = resp.json()
        except Exception:
            data = {"raw": resp.text}

    if resp.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Strowallet API error ({resp.status_code}): {data}")

    success = _extract_first(data, "success", "status", "data.status")
    if isinstance(success, bool) and success is False:
        raise HTTPException(status_code=502, detail=f"Strowallet API error: {data}")
    if isinstance(success, str) and success.lower() in {"failed", "error", "false"}:
        raise HTTPException(status_code=502, detail=f"Strowallet API error: {data}")

    return data


def _stw_error_text(detail: Any) -> str:
    try:
        return str(detail or "").lower()
    except Exception:
        return ""


async def _strowallet_create_customer_id(
    *,
    settings: Optional[dict],
    cfg: Dict[str, str],
    user: Dict[str, Any],
    customer_email: Optional[str] = None,
    kyc: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Create (or fetch) a Strowallet customer/user id.
    Some Strowallet plans require this before card creation.
    Tries a small set of known endpoint variants and returns the discovered id.
    """
    # Strowallet create-user (bitvcard) often requires KYC + address fields.
    kyc = kyc or {}
    # Prefer KYC name when present (it tends to match ID documents).
    full_name = (kyc.get("full_name") or user.get("full_name") or "").strip()
    parts = [p for p in full_name.split(" ") if p]
    first_name = parts[0] if parts else full_name
    last_name = " ".join(parts[1:]) if len(parts) > 1 else ""
    # Strowallet validation typically requires both first + last name.
    if not last_name and first_name:
        last_name = first_name

    # Map our KYC fields to provider-required schema.
    # Provider-required (from diagnostics): customerEmail, idNumber, idType, firstName, lastName, phoneNumber,
    # city, state, country, zipCode, line1, houseNumber, idImage, userPhoto, dateOfBirth.
    address_line1 = (kyc.get("full_address") or "").strip()
    city = (kyc.get("city") or "").strip()
    state = (kyc.get("state") or "").strip()
    country = (kyc.get("country") or "").strip()
    id_number = (kyc.get("id_number") or "").strip()
    id_type = (kyc.get("id_type") or "").strip()
    id_image = (kyc.get("id_front_image") or "").strip()
    id_back_image = (kyc.get("id_back_image") or "").strip()
    user_photo = (kyc.get("selfie_with_id") or "").strip()
    date_of_birth = (kyc.get("date_of_birth") or "").strip()

    # Best-effort: infer missing city/state from address line.
    if address_line1 and (not city or not state):
        addr_parts = [p.strip() for p in re.split(r"[,\\n]", address_line1) if p and p.strip()]
        if not city and addr_parts:
            city = addr_parts[-1]
        if not state and len(addr_parts) >= 2:
            state = addr_parts[-2]

    # Provide conservative defaults.
    if not country:
        country = "Haiti"

    # Normalize idType to common provider values while also sending our raw value as aliases.
    id_type_norm = str(id_type or "").strip().lower()
    id_type_provider = {
        "id_card": "NIN",
        "national_id": "NIN",
        "passport": "PASSPORT",
        "driver_license": "DRIVERS_LICENSE",
        "drivers_license": "DRIVERS_LICENSE",
    }.get(id_type_norm, id_type)

    # Best-effort: parse house number / zip from full_address if present.
    house_number = ""
    zip_code = ""
    if address_line1:
        m_house = re.match(r"^\s*(\d+)\b", address_line1)
        if m_house:
            house_number = m_house.group(1)
        m_zip = re.search(r"(\d{4,6})(?!.*\d)", address_line1)
        if m_zip:
            zip_code = m_zip.group(1)

    # If still missing, use conservative placeholders (some countries don't use postal codes).
    # Admin can override by improving KYC address format.
    if not zip_code:
        zip_code = "00000"
    if not house_number:
        house_number = "1"

    customer_email_final = (customer_email or user.get("email") or "").strip()

    phone_number = (kyc.get("phone_number") or kyc.get("whatsapp_number") or user.get("phone") or "").strip()

    # Ensure KYC images are in a provider-friendly form. If Cloudinary is configured, this will
    # convert inline base64 (data URLs) into stable URLs; otherwise it keeps the original.
    async def _normalize_kyc_image(value: str, field_name: str) -> str:
        if not value:
            return value
        kyc_id = str(kyc.get("kyc_id") or f"kyc_{user.get('user_id') or 'unknown'}")
        try:
            stored = await _kyc_store_image_value(
                value,
                user_id=str(user.get("user_id") or ""),
                kyc_id=kyc_id,
                field_name=field_name,
                settings=settings,
            )
            new_val = str(stored.get("value") or "")
            if new_val and new_val != value and kyc.get("kyc_id"):
                # Best-effort persist so future calls reuse the URL.
                try:
                    meta = dict(kyc.get("image_meta") or {})
                    meta[field_name] = stored.get("meta")
                    await db.kyc.update_one(
                        {"kyc_id": kyc["kyc_id"]},
                        {"$set": {field_name: new_val, "image_meta": meta}},
                    )
                    kyc[field_name] = new_val
                    kyc["image_meta"] = meta
                except Exception:
                    pass
            return new_val or value
        except Exception:
            return value

    id_image = await _normalize_kyc_image(id_image, "id_front_image")
    id_back_image = await _normalize_kyc_image(id_back_image, "id_back_image")
    user_photo = await _normalize_kyc_image(user_photo, "selfie_with_id")

    # Optional: also include pure base64 without the data-url prefix (some provider deployments expect this).
    def _data_url_to_b64(val: str) -> Optional[str]:
        parsed = _parse_image_data_url(val)
        if not parsed:
            return None
        try:
            return val.split("base64,", 1)[1]
        except Exception:
            return None

    create_user_payload: Dict[str, Any] = {
        # Required field names (provider schema)
        "customerEmail": customer_email_final,
        "idNumber": id_number,
        "idType": id_type_provider,
        "firstName": first_name,
        "lastName": last_name,
        "phoneNumber": phone_number,
        "city": city,
        "state": state,
        "country": country,
        "zipCode": zip_code,
        "line1": address_line1,
        "houseNumber": house_number,
        "idImage": id_image,
        "idBackImage": id_back_image,
        "userPhoto": user_photo,
        "dateOfBirth": date_of_birth,
        # Common aliases across different Strowallet deployments (best-effort)
        "email": customer_email_final,
        "customer_email": customer_email_final,
        "id_number": id_number,
        "id_type": id_type,
        "first_name": first_name,
        "last_name": last_name,
        "phone": phone_number,
        "phone_number": phone_number,
        "address": address_line1,
        "full_address": address_line1,
        "addressLine1": address_line1,
        "house_number": house_number,
        "zip_code": zip_code,
        "dob": date_of_birth,
        "date_of_birth": date_of_birth,
        "nationality": (kyc.get("nationality") or "").strip(),
        "whatsapp_number": (kyc.get("whatsapp_number") or "").strip(),
        "id_image": id_image,
        "user_photo": user_photo,
        "id_image_b64": _data_url_to_b64(id_image) if isinstance(id_image, str) else None,
        "user_photo_b64": _data_url_to_b64(user_photo) if isinstance(user_photo, str) else None,
        # Helpful traceability (usually ignored by provider)
        "reference": user.get("user_id"),
        "customer_reference": user.get("user_id"),
    }
    # Drop empties so we can give a clean "missing fields" error locally (before calling provider).
    create_user_payload = {k: v for k, v in create_user_payload.items() if v not in (None, "")}

    # Fail fast if critical fields are missing (avoid confusing provider errors).
    required_keys = [
        "customerEmail",
        "idNumber",
        "idType",
        "firstName",
        "lastName",
        "phoneNumber",
        "city",
        "state",
        "country",
        "zipCode",
        "line1",
        "houseNumber",
        "idImage",
        "userPhoto",
        "dateOfBirth",
    ]
    missing = [k for k in required_keys if k not in create_user_payload]
    if missing:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Missing required fields for Strowallet create-user. Ensure user KYC includes these fields.",
                "missing": missing,
                "note": "This is required by your Strowallet plan before creating a card.",
            },
        )

    # Try configured path first, then common variants.
    candidates = [
        cfg.get("create_user_path") or "",
        "/api/bitvcard/create-user/",
        "/api/bitvcard/create-user",
    ]
    tried_paths: List[str] = []
    attempts: List[Dict[str, Any]] = []
    last_result: Any = None

    for raw in candidates:
        p = _normalize_strowallet_path(raw, "")
        if not p or p in tried_paths:
            continue
        tried_paths.append(p)
        try:
            resp = await _strowallet_post(settings, p, create_user_payload)
            attempts.append({"path": p, "ok": True, "response": resp})
        except HTTPException as e:
            # Continue trying other known endpoints; keep the last error for debugging.
            err = getattr(e, "detail", str(e))
            attempts.append({"path": p, "ok": False, "error": err})
            last_result = {"path": p, "error": err}
            continue
        except Exception as e:
            attempts.append({"path": p, "ok": False, "error": str(e)})
            last_result = {"path": p, "error": str(e)}
            continue

        customer_id = _extract_first(
            resp,
            "data.customer_id",
            "data.user_id",
            "data.card_user_id",
            "customer_id",
            "user_id",
            "card_user_id",
            "data.id",
            "id",
        )
        if customer_id:
            return str(customer_id)
        last_result = {"path": p, "response": resp}

    # Special-case: customer already exists at provider (email taken). Attempt to look up an existing customer id.
    last_err_text = ""
    try:
        last_err_text = str((last_result or {}).get("error") or "").lower()
    except Exception:
        last_err_text = ""
    email_taken = ("already been taken" in last_err_text) or ("email has already been taken" in last_err_text)
    if email_taken:
        lookup_candidates = [
            "/api/bitvcard/card-user",
            "/api/bitvcard/card-user/",
        ]
        for lp in lookup_candidates:
            try:
                resp = await _strowallet_get(
                    settings,
                    lp,
                    {"customerEmail": customer_email_final, "email": customer_email_final},
                )
                customer_id = _extract_first(
                    resp,
                    "data.customer_id",
                    "data.user_id",
                    "data.card_user_id",
                    "customer_id",
                    "user_id",
                    "card_user_id",
                    "data.id",
                    "id",
                )
                if customer_id:
                    return str(customer_id)
            except Exception:
                continue

        # If we cannot discover the id, allow caller to proceed without it.
        # Many Strowallet create-card setups accept customerEmail only.
        return ""

    raise HTTPException(
        status_code=502,
        detail={
            "message": "Strowallet create-user/customer failed; cannot proceed to create-card.",
            "tried_paths": tried_paths,
            "last_result": last_result,
            "attempts": attempts,
        },
    )


async def _strowallet_issue_card_for_order(
    *,
    settings: Optional[dict],
    order: Dict[str, Any],
    user: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Issue a Strowallet virtual card for a given order + user and return the DB update document.
    SECURITY: never store full PAN/CVV; only last4/expiry/name/brand/type + provider ids.
    """
    if not _strowallet_enabled(settings):
        raise HTTPException(status_code=400, detail="Strowallet is not enabled")

    cfg = _strowallet_config(settings)
    now = datetime.now(timezone.utc).isoformat()

    # Ensure (best-effort) provider customer id exists if required by plan.
    stw_customer_id = user.get("strowallet_customer_id") or user.get("strowallet_user_id")
    if not stw_customer_id and cfg.get("create_user_path"):
        kyc = await db.kyc.find_one(
            {"user_id": user.get("user_id"), "status": "approved"},
            {"_id": 0},
        )
        if not kyc:
            raise HTTPException(status_code=400, detail="User KYC must be approved before creating a Strowallet customer.")
        stw_customer_id = await _strowallet_create_customer_id(
            settings=settings,
            cfg=cfg,
            user=user,
            customer_email=(user.get("email") or ""),
            kyc=kyc,
        )
        if stw_customer_id and user.get("user_id"):
            await db.users.update_one(
                {"user_id": user["user_id"]},
                {"$set": {"strowallet_customer_id": stw_customer_id}},
            )

    create_payload: Dict[str, Any] = {
        "email": order.get("card_email") or user.get("email"),
        "card_email": order.get("card_email") or user.get("email"),
        "customerEmail": order.get("card_email") or user.get("email"),
        "name_on_card": (user.get("full_name") or "").upper(),
        "card_type": (order.get("card_type") or "visa"),
        "amount": str(cfg.get("create_card_amount_usd") or 5),
        "full_name": user.get("full_name"),
        "name": user.get("full_name"),
        "phone": user.get("phone"),
        "phone_number": user.get("phone"),
        "reference": order.get("order_id"),
        "customer_reference": user.get("user_id"),
    }
    if stw_customer_id:
        create_payload["customer_id"] = stw_customer_id
        create_payload["user_id"] = stw_customer_id
        create_payload["card_user_id"] = stw_customer_id

    create_payload = _with_aliases(create_payload, "phone", "mobile", "msisdn")
    create_payload = _with_aliases(create_payload, "customerEmail", "customer_email", "customeremail")
    create_payload = {k: v for k, v in create_payload.items() if v not in (None, "")}

    stw_resp = await _strowallet_post(settings, cfg["create_path"], create_payload)

    provider_card_id = _extract_first(
        stw_resp,
        "data.card.card_id",
        "data.card_id",
        "data.cardId",
        "data.id",
        "data.card.cardId",
        "card_id",
        "id",
        "data.card.id",
    )

    # Fetch detail best-effort (with retries) to populate last4/expiry/etc.
    stw_detail = await _strowallet_fetch_detail_with_retry(
        settings=settings,
        cfg=cfg,
        provider_card_id=str(provider_card_id),
        stw_customer_id=stw_customer_id,
        reference=f"detail-{order.get('order_id')}",
        attempts=4,
    )

    src = stw_detail or stw_resp
    card_number = _extract_first(src, "data.card_number", "data.number", "card_number", "number", "data.card.number", "data.card.card_number")
    card_expiry = _extract_first(src, "data.expiry", "data.expiry_date", "expiry", "expiry_date", "data.card.expiry", "data.card.expiry_date")
    card_type = _extract_first(src, "data.type", "type", "data.card.type")
    card_holder_name = _extract_first(src, "data.name_on_card", "data.card_name", "name_on_card", "card_name", "data.card.name_on_card")
    card_brand = _extract_first(src, "data.brand", "brand", "data.card.brand")
    card_balance = _extract_float_first(
        src,
        "data.balance",
        "data.available_balance",
        "data.availableBalance",
        "balance",
        "available_balance",
        "availableBalance",
        "data.card.balance",
        "data.card.available_balance",
        "data.card.availableBalance",
    )
    card_currency = _extract_first(src, "data.currency", "currency", "data.card.currency")

    update_doc: Dict[str, Any] = {
        "status": "approved",
        "processed_at": now,
        "processed_by": "system",
        "provider": "strowallet",
        "provider_card_id": str(provider_card_id) if provider_card_id else None,
        # Keep provider payloads redacted (do not store PAN/CVV).
        "provider_raw": _redact_sensitive_payload({"create": stw_resp, "detail": stw_detail} if stw_detail else {"create": stw_resp}),
        "card_status": "active",
        "failed_payment_count": int(order.get("failed_payment_count", 0) or 0),
        "spending_limit_usd": float(order.get("spending_limit_usd", 500.0) or 500.0),
        "spending_limit_period": str(order.get("spending_limit_period", "monthly") or "monthly"),
    }

    # Branding
    if cfg.get("brand_name"):
        update_doc["card_brand"] = cfg["brand_name"]
    elif card_brand:
        update_doc["card_brand"] = str(card_brand)
    else:
        update_doc["card_brand"] = "Virtual Card"

    if card_type:
        update_doc["card_type"] = str(card_type).lower()
    if card_holder_name:
        update_doc["card_holder_name"] = str(card_holder_name)
    elif user.get("full_name"):
        update_doc["card_holder_name"] = str(user["full_name"]).upper()

    if card_number:
        card_number_str = str(card_number).replace(" ", "")
        update_doc["card_last4"] = card_number_str[-4:]
    if card_expiry:
        update_doc["card_expiry"] = str(card_expiry)
    if card_balance is not None:
        update_doc["card_balance"] = float(card_balance)
    if card_currency:
        update_doc["card_currency"] = str(card_currency).upper()

    return update_doc


async def _strowallet_fetch_detail_with_retry(
    *,
    settings: Optional[dict],
    cfg: Dict[str, str],
    provider_card_id: str,
    stw_customer_id: Optional[str],
    reference: str,
    attempts: int = 4,
) -> Optional[Dict[str, Any]]:
    """
    Best-effort fetch-card-detail with short retries.
    Some providers need a few seconds after create-card before detail is available.
    """
    if not provider_card_id or not cfg.get("fetch_detail_path"):
        return None

    last_err: Optional[Exception] = None
    for i in range(max(1, int(attempts or 1))):
        try:
            detail_payload: Dict[str, Any] = {"card_id": provider_card_id, "reference": reference}
            if stw_customer_id:
                detail_payload["customer_id"] = stw_customer_id
                detail_payload["card_user_id"] = stw_customer_id
            detail_payload = _with_aliases(detail_payload, "card_id", "cardId", "id")
            return await _strowallet_post(settings, cfg["fetch_detail_path"], detail_payload)
        except Exception as e:
            last_err = e
            # Backoff: 0.6s, 1.2s, 2.4s, 4.8s (max ~9s)
            await asyncio.sleep(0.6 * (2**i))
            continue

    # Keep fully best-effort; caller should proceed with create response.
    return None

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

PaymentGatewayIntegrationProvider = Literal["plisio"]


class PaymentGatewayIntegrationConfig(BaseModel):
    provider: PaymentGatewayIntegrationProvider
    # For Plisio: if provided, which custom field contains the crypto/network selection.
    # Example: "network" with values like "usdt_trc20".
    network_field_key: Optional[str] = "network"


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
    # If enabled (withdrawal methods only), compute fee using the same tiered fee table used for virtual cards (`card_fees`).
    # This lets you activate "card-style fees" per payment method.
    use_card_fee_tiers: bool = False
    display: Optional[PaymentGatewayDisplayConfig] = None
    custom_fields: List[PaymentGatewayCustomField] = Field(default_factory=list)
    withdrawal_config: Optional[PaymentGatewayWithdrawalConfig] = None
    integration: Optional[PaymentGatewayIntegrationConfig] = None


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
    state: Optional[str] = None  # state/department/province
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

class TopUpFeeTier(BaseModel):
    min_amount: float
    max_amount: float
    fee_value: float
    is_percentage: bool = False

class AdminSettingsUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

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

    # Virtual Cards (Strowallet) - optional automation
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
    # White-label branding for automated cards (displayed in UI as card_brand)
    strowallet_brand_name: Optional[str] = None
    # Strowallet create-card options (some deployments require these)
    strowallet_mode: Optional[str] = None  # "live" | "sandbox" (provider-specific)
    strowallet_create_card_amount_usd: Optional[float] = None  # default initial amount (USD) for create-card
    # Optional Strowallet controls endpoints (plans vary)
    strowallet_set_limit_path: Optional[str] = None
    strowallet_freeze_card_path: Optional[str] = None
    strowallet_unfreeze_card_path: Optional[str] = None
    # Optional Strowallet advanced endpoints (plans vary)
    strowallet_freeze_unfreeze_path: Optional[str] = None
    strowallet_full_card_history_path: Optional[str] = None
    strowallet_withdraw_status_path: Optional[str] = None
    strowallet_upgrade_limit_path: Optional[str] = None

    # Fees & Affiliate (optional, UI-configurable)
    card_order_fee_htg: Optional[int] = None
    affiliate_reward_htg: Optional[int] = None
    affiliate_cards_required: Optional[int] = None
    card_background_image: Optional[str] = None
    topup_fee_tiers: Optional[List[TopUpFeeTier]] = None

    # Floating announcement (optional)
    announcement_enabled: Optional[bool] = None
    announcement_text_ht: Optional[str] = None
    announcement_text_fr: Optional[str] = None
    announcement_text_en: Optional[str] = None
    announcement_link: Optional[str] = None

    # KYC image storage (recommended)
    cloudinary_cloud_name: Optional[str] = None
    cloudinary_api_key: Optional[str] = None
    cloudinary_api_secret: Optional[str] = None
    cloudinary_folder: Optional[str] = None
    kyc_max_image_bytes: Optional[int] = None

class TeamMemberCreate(BaseModel):
    email: str
    password: str
    full_name: str
    phone: str
    role: Optional[str] = "admin"

class TeamMemberUpdate(BaseModel):
    is_active: bool

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
    # Optional for clients: if omitted, we default to the user's account email.
    card_email: Optional[str] = None

class TopUpOrder(BaseModel):
    country: str
    country_name: str
    phone_number: str
    # New flow: user provides an amount. (Legacy minutes/price still accepted for old clients.)
    amount: Optional[float] = None
    minutes: Optional[int] = None
    price: Optional[float] = None

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

class AgentPayoutProfileUpdate(BaseModel):
    payment_method_id: str
    field_values: Dict[str, Any] = Field(default_factory=dict)

class AgentCommissionWithdrawalCreate(BaseModel):
    amount: float
    payment_method_id: str
    field_values: Dict[str, Any] = Field(default_factory=dict)

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

def _normalize_admin_role(user: dict) -> str:
    if not user or not user.get("is_admin"):
        return ""
    role = str(user.get("admin_role") or "").strip().lower()
    return role or "admin"


def _rbac_is_allowed(*, role: str, path: str) -> bool:
    """
    Server-side RBAC for /api/admin/* endpoints.
    Keep frontend route/menu permissions aligned with this.
    """
    if not role:
        return False
    if role == "superadmin":
        return True

    # Allowed route prefixes per role.
    allow: Dict[str, List[str]] = {
        # Support: KYC + users + virtual cards operations (non-financial config)
        "support": [
            "/api/admin/dashboard",
            "/api/admin/users",
            "/api/admin/kyc",
            "/api/admin/kyc-image-storage-status",
            "/api/admin/virtual-card-orders",
            "/api/admin/card-topups",
            "/api/admin/topup-orders",
        ],
        # Finance: deposits/withdrawals + rates/fees + payment gateway + virtual card ops
        "finance": [
            "/api/admin/dashboard",
            "/api/admin/deposits",
            "/api/admin/withdrawals",
            "/api/admin/exchange-rates",
            "/api/admin/rates",
            "/api/admin/fees",
            "/api/admin/card-fees",
            "/api/admin/withdrawal-limits",
            "/api/admin/payment-gateway",
            "/api/admin/virtual-card-orders",
            "/api/admin/card-topups",
            "/api/admin/topup-orders",
            "/api/admin/agent-deposits",
            "/api/admin/agent-settings",
            "/api/admin/agent-commission-withdrawals",
            "/api/admin/agent-requests",
            "/api/admin/agents",
            "/api/admin/recharge-agent",
            "/api/admin/client-reports",
        ],
        # Manager: broad ops (no system-level settings/team)
        "manager": [
            "/api/admin/dashboard",
            "/api/admin/users",
            "/api/admin/kyc",
            "/api/admin/kyc-image-storage-status",
            "/api/admin/deposits",
            "/api/admin/withdrawals",
            "/api/admin/virtual-card-orders",
            "/api/admin/card-topups",
            "/api/admin/topup-orders",
            "/api/admin/bulk-email",
            "/api/admin/logs",
            "/api/admin/webhook-events",
            "/api/admin/payment-gateway",
            "/api/admin/agent-deposits",
            "/api/admin/agent-settings",
            "/api/admin/agent-commission-withdrawals",
            "/api/admin/agent-requests",
            "/api/admin/agents",
            "/api/admin/recharge-agent",
            "/api/admin/client-reports",
            "/api/admin/whatsapp-notifications",
            "/api/admin/test-whatsapp",
            "/api/admin/test-telegram",
            "/api/admin/telegram/setup-webhook",
        ],
        # Admin: broad ops (still blocked from system-level team/settings)
        "admin": [
            "/api/admin/dashboard",
            "/api/admin/users",
            "/api/admin/kyc",
            "/api/admin/kyc-image-storage-status",
            "/api/admin/deposits",
            "/api/admin/withdrawals",
            "/api/admin/exchange-rates",
            "/api/admin/rates",
            "/api/admin/fees",
            "/api/admin/card-fees",
            "/api/admin/withdrawal-limits",
            "/api/admin/payment-gateway",
            "/api/admin/settings",
            "/api/admin/virtual-card-orders",
            "/api/admin/card-topups",
            "/api/admin/topup-orders",
            "/api/admin/bulk-email",
            "/api/admin/logs",
            "/api/admin/webhook-events",
            "/api/admin/agent-deposits",
            "/api/admin/agent-settings",
            "/api/admin/agent-commission-withdrawals",
            "/api/admin/strowallet",
            "/api/admin/agent-requests",
            "/api/admin/agents",
            "/api/admin/recharge-agent",
            "/api/admin/client-reports",
            "/api/admin/whatsapp-notifications",
            "/api/admin/test-whatsapp",
            "/api/admin/test-telegram",
            "/api/admin/telegram/setup-webhook",
        ],
    }

    # Explicitly blocked paths for non-superadmin roles.
    blocked_prefixes = [
        "/api/admin/team",
        # Maintenance endpoints: superadmin only
        "/api/admin/purge-old-records",
    ]
    for bp in blocked_prefixes:
        if path.startswith(bp):
            return False

    prefixes = allow.get(role, [])
    # Only allow exact match or sub-paths (prefix + "/..."), never raw startswith(prefix)
    return any(path == p or path.startswith(p + "/") for p in prefixes)


async def get_admin_user(request: Request, current_user: dict = Depends(get_current_user)):
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    role = _normalize_admin_role(current_user)
    path = str(request.url.path or "")

    # Only enforce RBAC on /api/admin/*.
    if path.startswith("/api/admin"):
        if not _rbac_is_allowed(role=role, path=path):
            raise HTTPException(status_code=403, detail="Insufficient role permissions")

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


async def notify_admin(subject: str, html: str, telegram_message: Optional[str] = None):
    """
    Notify all active admins by email (Resend) and Telegram (settings.telegram_chat_id).
    """
    # Email admins
    try:
        admins = await db.users.find(
            {"is_admin": True, "is_active": True},
            {"_id": 0, "email": 1},
        ).to_list(50)
        for a in admins:
            if a.get("email"):
                await send_email(a["email"], subject, html)
    except Exception as e:
        logger.error(f"Admin email notify error: {e}")

    # Telegram admin channel/group
    if telegram_message:
        try:
            await send_telegram_notification(telegram_message)
        except Exception as e:
            logger.error(f"Admin telegram notify error: {e}")

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

def calculate_tiered_fee(amount: float, tiers: list) -> float:
    """Calculate a tiered fee (fixed or percentage) based on amount."""
    try:
        amt = float(amount)
    except Exception:
        return 0.0
    if amt <= 0:
        return 0.0

    for tier in tiers or []:
        try:
            min_a = float(tier.get("min_amount", 0))
            max_a = float(tier.get("max_amount", 0))
            fee_v = float(tier.get("fee_value", 0))
            is_pct = bool(tier.get("is_percentage", False))
        except Exception:
            continue

        if min_a <= amt <= max_a:
            if is_pct:
                return round(amt * (fee_v / 100.0), 2)
            return round(fee_v, 2)

    return 0.0

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
    # Fee is added on top: user pays (amount + fee), credited amount is `amount`
    net_amount = max(0.0, float(request.amount))
    total_amount = max(0.0, float(request.amount + fee))

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
        "total_amount": total_amount,
        "currency": currency,
        "field_values": submitted,
        "status": "pending",
        "provider": None,
        "provider_status": None,
        "plisio_invoice_id": None,
        "plisio_invoice_url": None,
        "plisio_currency": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    # Optional: Plisio integration (automatic crypto invoice)
    integration = method.get("integration") or {}
    if integration.get("provider") == "plisio":
        settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
        if not settings or not settings.get("plisio_enabled"):
            raise HTTPException(status_code=400, detail="Plisio is not enabled")

        # Plisio: by default we use a single key (settings.plisio_api_key).
        # If a second key exists (settings.plisio_secret_key), we will retry with api_secret for legacy setups.
        plisio_key = (settings.get("plisio_api_key") or "").strip()
        plisio_secret = (settings.get("plisio_secret_key") or "").strip()
        if not plisio_key:
            # Backward compatibility: allow the key stored in plisio_secret_key
            plisio_key = plisio_secret
            plisio_secret = ""
        if not plisio_key:
            raise HTTPException(status_code=400, detail="Plisio key is not configured in settings")

        network_field_key = integration.get("network_field_key") or "network"
        selected_network = str((submitted or {}).get(network_field_key) or "").strip()

        # Plisio currency codes vary by account and can change.
        # The most compatible value for USDT is usually "USDT" (network selection is handled internally by Plisio).
        network_map = {
            "usdt_trc20": "USDT",
            "usdt_erc20": "USDT",
            "usdt_bep20": "USDT",
            "usdt_polygon": "USDT",
            "usdt_arbitrum": "USDT",
            "USDTTRC20": "USDT",
            "USDTERC20": "USDT",
            "USDTBEP20": "USDT",
            "USDTPOLYGON": "USDT",
            "USDTARBITRUM": "USDT",
            "USDT": "USDT",
        }
        plisio_currency = network_map.get(selected_network, "USDT")

        backend_url = os.environ.get("BACKEND_URL", "https://wisebond.onrender.com").rstrip("/")
        # NOTE: Plisio may only allow verifying one domain. We keep Plisio return URLs on BACKEND_URL
        # and redirect users back to FRONTEND_URL from /api/plisio/return and /api/plisio/fail.

        payload = {
            "currency": plisio_currency,
            "source_currency": currency,
            "source_amount": float(total_amount),
            "order_name": f"Deposit {deposit_id}",
            "order_number": deposit_id,
            "callback_url": f"{backend_url}/api/deposits/plisio-webhook",
            "psys_callback_url": f"{backend_url}/api/deposits/plisio-webhook",
            "email": current_user.get("email", ""),
            "success_url": f"{backend_url}/api/plisio/return?deposit_id={deposit_id}&status=success",
            "fail_url": f"{backend_url}/api/plisio/fail?deposit_id={deposit_id}",
        }
        def _safe_err(text: str) -> str:
            # Avoid returning very large bodies to the client
            t = (text or "").strip()
            return t[:800] + ("..." if len(t) > 800 else "")

        async def _create_invoice(extra_params: Optional[Dict[str, Any]] = None):
            # Plisio expects invoice creation via query params (GET) and returns JSON on 422/200.
            params: Dict[str, Any] = {"api_key": plisio_key, **payload}
            if extra_params:
                params.update(extra_params)
            async with httpx.AsyncClient() as client_http:
                return await client_http.get(
                    "https://plisio.net/api/v1/invoices/new",
                    params=params,
                    headers={"Accept": "application/json"},
                    timeout=30.0,
                )

        try:
            resp = await _create_invoice()
            # If it fails and we have a secondary secret, retry once with api_secret for legacy setups.
            if resp.status_code != 200 and plisio_secret and plisio_secret != plisio_key:
                resp = await _create_invoice({"api_secret": plisio_secret})

            if resp.status_code != 200:
                # If Plisio returns JSON with an unsupported currency error, retry once with generic USDT.
                try:
                    j = resp.json()
                    if (
                        isinstance(j, dict)
                        and j.get("status") == "error"
                        and isinstance(j.get("data"), dict)
                        and j["data"].get("code") == 105
                        and plisio_currency != "USDT"
                    ):
                        plisio_currency = "USDT"
                        payload["currency"] = "USDT"
                        resp = await _create_invoice({"api_secret": plisio_secret} if (plisio_secret and plisio_secret != plisio_key) else None)
                except Exception:
                    pass

                body_snippet = _safe_err(resp.text)
                content_type = resp.headers.get("content-type", "")
                try:
                    from urllib.parse import urlparse, parse_qs
                    q = parse_qs(urlparse(str(resp.request.url)).query)
                    query_keys = sorted(list(q.keys()))
                except Exception:
                    query_keys = []
                logger.error(f"Plisio invoice create failed: {resp.status_code} ct={content_type} q={query_keys} body={body_snippet}")
                # Return a helpful (but truncated) message to admin/user to troubleshoot.
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Failed to create Plisio invoice: {resp.status_code} "
                        f"(content-type: {content_type or 'unknown'}, query: {query_keys}) - "
                        f"{body_snippet or 'No response body'}"
                    ),
                )

            # Prefer JSON; if Plisio returned HTML, raise a readable error.
            try:
                result = resp.json()
            except Exception:
                raise HTTPException(status_code=400, detail=f"Failed to create Plisio invoice: invalid response - {_safe_err(resp.text)}")
            if result.get("status") != "success" or not result.get("data"):
                logger.error(f"Plisio API error: {result}")
                raise HTTPException(status_code=400, detail=f"Plisio error: {result.get('message', 'Unknown error')}")

            invoice_data = result["data"]
            deposit["provider"] = "plisio"
            deposit["provider_status"] = invoice_data.get("status", "pending")
            deposit["plisio_invoice_id"] = invoice_data.get("txn_id") or invoice_data.get("id") or invoice_data.get("invoice_id")
            deposit["plisio_invoice_url"] = invoice_data.get("invoice_url") or invoice_data.get("url")
            deposit["plisio_currency"] = plisio_currency
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to create Plisio invoice: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to create Plisio invoice")

    await db.deposits.insert_one(deposit)

    # Notify admins (email + telegram)
    try:
        await notify_admin(
            subject="KAYICOM - New Deposit Request",
            html=f"""
            <h2>New Deposit Request</h2>
            <p><strong>Client:</strong> {current_user.get('full_name', '')} ({current_user.get('client_id', '')})</p>
            <p><strong>Amount:</strong> {deposit['amount']} {deposit['currency']}</p>
            <p><strong>Fee:</strong> {deposit.get('fee', 0)} {deposit['currency']}</p>
            <p><strong>Total to pay:</strong> {deposit.get('total_amount', (deposit.get('amount', 0) or 0) + (deposit.get('fee', 0) or 0))} {deposit['currency']}</p>
            <p><strong>Method:</strong> {deposit.get('payment_method_name') or deposit.get('payment_method_id')}</p>
            <p><strong>Status:</strong> pending</p>
            <p>Deposit ID: <code>{deposit['deposit_id']}</code></p>
            """,
            telegram_message=(
                f"💰 <b>New Deposit Request</b>\n"
                f"Client: <b>{current_user.get('full_name','')}</b> ({current_user.get('client_id','')})\n"
                f"Amount: <b>{deposit['amount']} {deposit['currency']}</b>\n"
                f"Fee: <b>{deposit.get('fee', 0)} {deposit['currency']}</b>\n"
                f"Total: <b>{deposit.get('total_amount', (deposit.get('amount', 0) or 0) + (deposit.get('fee', 0) or 0))} {deposit['currency']}</b>\n"
                f"Method: <b>{deposit.get('payment_method_name') or deposit.get('payment_method_id')}</b>\n"
                f"ID: <code>{deposit['deposit_id']}</code>"
            ),
        )
    except Exception as e:
        logger.error(f"Failed to notify admins for deposit: {e}")
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

async def _plisio_sync_deposit_by_id(deposit_id: str, processed_by: str) -> Optional[dict]:
    """
    Sync a Plisio deposit by deposit_id. If confirmed and still pending, auto-completes and credits wallet.
    Returns the updated deposit document (without _id) or None if not found.
    """
    deposit = await db.deposits.find_one({"deposit_id": deposit_id}, {"_id": 0})
    if not deposit:
        return None
    if deposit.get("provider") != "plisio" or not deposit.get("plisio_invoice_id"):
        return deposit

    settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
    plisio_key = (settings.get("plisio_api_key") or "").strip() if settings else ""
    plisio_secret = (settings.get("plisio_secret_key") or "").strip() if settings else ""
    if not plisio_key and plisio_secret:
        plisio_key = plisio_secret
        plisio_secret = ""
    if not settings or not settings.get("plisio_enabled") or not plisio_key:
        return deposit

    params = {"api_key": plisio_key}
    try:
        async with httpx.AsyncClient() as client_http:
            resp = await client_http.get(
                f"https://plisio.net/api/v1/operations/{deposit['plisio_invoice_id']}",
                params=params,
                headers={"Accept": "application/json"},
                timeout=30.0,
            )
        if resp.status_code != 200 and plisio_secret and plisio_secret != plisio_key:
            async with httpx.AsyncClient() as client_http:
                resp = await client_http.get(
                    f"https://plisio.net/api/v1/operations/{deposit['plisio_invoice_id']}",
                    params={**params, "api_secret": plisio_secret},
                    headers={"Accept": "application/json"},
                    timeout=30.0,
                )
        if resp.status_code != 200:
            return deposit

        result = resp.json()
        if result.get("status") != "success" or not result.get("data"):
            return deposit

        invoice_data = result["data"]
        new_status = invoice_data.get("status", deposit.get("provider_status", "pending"))

        update_data: Dict[str, Any] = {"provider_status": new_status}
        confirmed_statuses = {"completed", "confirmed", "mismatch", "paid"}
        if str(new_status).lower() in confirmed_statuses and deposit.get("status") == "pending":
            update_data["status"] = "completed"
            update_data["processed_at"] = datetime.now(timezone.utc).isoformat()
            update_data["processed_by"] = processed_by

            credit_amount = float(deposit.get("net_amount", deposit.get("amount", 0)) or 0)
            currency_key = f"wallet_{deposit['currency'].lower()}"
            await db.users.update_one({"user_id": deposit["user_id"]}, {"$inc": {currency_key: credit_amount}})

            await db.transactions.insert_one({
                "transaction_id": str(uuid.uuid4()),
                "user_id": deposit["user_id"],
                "type": "deposit",
                "amount": credit_amount,
                "currency": deposit["currency"],
                "reference_id": deposit_id,
                "status": "completed",
                "description": f"Deposit via {deposit.get('payment_method_name') or 'Plisio'} (auto-approved)",
                "created_at": datetime.now(timezone.utc).isoformat()
            })

            # Notify user by email
            user = await db.users.find_one({"user_id": deposit["user_id"]}, {"_id": 0, "email": 1, "full_name": 1})
            if user and user.get("email"):
                subject = "KAYICOM - Deposit Approved"
                content = f"""
                <h2>Deposit Approved</h2>
                <p>Hello {user.get('full_name', 'User')},</p>
                <p>Your deposit of <strong>{deposit.get('amount')} {deposit.get('currency')}</strong> has been approved.</p>
                <p>Fee: <strong>{deposit.get('fee', 0)} {deposit.get('currency')}</strong> | Total paid: <strong>{deposit.get('total_amount', (deposit.get('amount', 0) or 0) + (deposit.get('fee', 0) or 0))} {deposit.get('currency')}</strong></p>
                <p>Transaction ID: <code>{deposit_id}</code></p>
                <p>Thank you for using KAYICOM!</p>
                """
                await send_email(user["email"], subject, content)

        await db.deposits.update_one({"deposit_id": deposit_id}, {"$set": update_data})
        deposit = await db.deposits.find_one({"deposit_id": deposit_id}, {"_id": 0})
        return deposit
    except Exception as e:
        logger.error(f"Plisio sync error for deposit {deposit_id}: {e}", exc_info=True)
        return deposit


@api_router.get("/plisio/return")
async def plisio_return(deposit_id: Optional[str] = None, status: str = "success"):
    """
    User-facing return URL for Plisio.
    Plisio may require the return URL domain to be verified; we keep it on BACKEND_URL and redirect to FRONTEND_URL.
    """
    if deposit_id:
        # Attempt an automatic sync/credit on return (no auth required)
        await _plisio_sync_deposit_by_id(deposit_id, processed_by="plisio_return")
    frontend_url = os.environ.get("FRONTEND_URL", "https://wallet.kayicom.com").rstrip("/")
    qs = f"?status={status}"
    if deposit_id:
        qs += f"&deposit_id={deposit_id}"
    return RedirectResponse(url=f"{frontend_url}/deposit{qs}", status_code=302)


@api_router.get("/plisio/fail")
async def plisio_fail(deposit_id: Optional[str] = None):
    """User-facing fail URL for Plisio (redirects to frontend)."""
    frontend_url = os.environ.get("FRONTEND_URL", "https://wallet.kayicom.com").rstrip("/")
    qs = "?status=failed"
    if deposit_id:
        qs += f"&deposit_id={deposit_id}"
    return RedirectResponse(url=f"{frontend_url}/deposit{qs}", status_code=302)


@api_router.post("/deposits/{deposit_id}/sync")
async def sync_deposit_status(deposit_id: str, current_user: dict = Depends(get_current_user)):
    """Manually sync Plisio deposit status and auto-credit on confirmation."""
    existing = await db.deposits.find_one({"deposit_id": deposit_id, "user_id": current_user["user_id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Deposit not found")
    if existing.get("provider") != "plisio":
        raise HTTPException(status_code=400, detail="This deposit is not a Plisio deposit")

    updated = await _plisio_sync_deposit_by_id(deposit_id, processed_by="plisio_sync")
    if not updated:
        raise HTTPException(status_code=404, detail="Deposit not found")
    return {"deposit": updated}


@api_router.post("/deposits/plisio-webhook")
async def plisio_webhook(request: Request):
    """Webhook endpoint for Plisio to notify about payment status."""
    try:
        try:
            body = await request.json()
        except Exception:
            form_data = await request.form()
            body = dict(form_data)

        order_number = body.get("order_number") or body.get("orderNumber")
        if not order_number:
            return {"status": "error", "message": "Missing order_number"}

        deposit = await db.deposits.find_one({"deposit_id": order_number}, {"_id": 0})
        if not deposit:
            return {"status": "error", "message": "Deposit not found"}

        if deposit.get("provider") != "plisio":
            return {"status": "error", "message": "Not a Plisio deposit"}

        plisio_status = body.get("status") or body.get("Status") or body.get("invoice_status")
        txn_id = body.get("txn_id") or body.get("txnId") or body.get("txn")
        if not plisio_status:
            return {"status": "error", "message": "Missing status"}

        update_data: Dict[str, Any] = {
            "provider_status": plisio_status,
            "plisio_txn_id": txn_id,
        }

        confirmed_statuses = {"completed", "confirmed", "mismatch", "paid"}
        if str(plisio_status).lower() in confirmed_statuses and deposit.get("status") == "pending":
            update_data["status"] = "completed"
            update_data["processed_at"] = datetime.now(timezone.utc).isoformat()
            update_data["processed_by"] = "plisio_webhook"

            credit_amount = float(deposit.get("net_amount", deposit.get("amount", 0)) or 0)
            currency_key = f"wallet_{deposit['currency'].lower()}"
            await db.users.update_one({"user_id": deposit["user_id"]}, {"$inc": {currency_key: credit_amount}})

            await db.transactions.insert_one({
                "transaction_id": str(uuid.uuid4()),
                "user_id": deposit["user_id"],
                "type": "deposit",
                "amount": credit_amount,
                "currency": deposit["currency"],
                "reference_id": order_number,
                "status": "completed",
                "description": f"Deposit via {deposit.get('payment_method_name') or 'Plisio'} (auto-approved)",
                "created_at": datetime.now(timezone.utc).isoformat()
            })

        elif str(plisio_status).lower() in {"expired", "cancelled", "failed"} and deposit.get("status") == "pending":
            update_data["status"] = "rejected"
            update_data["processed_at"] = datetime.now(timezone.utc).isoformat()
            update_data["processed_by"] = "plisio_webhook"

        await db.deposits.update_one({"deposit_id": order_number}, {"$set": update_data})
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Plisio webhook error: {e}", exc_info=True)
        return {"status": "error", "message": "Webhook error"}

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
    fee_source = "method"

    # Optional: apply the same tiered fee table used for virtual cards (USD only).
    use_card_fee_tiers = bool(method.get("use_card_fee_tiers", False))
    fee = (request.amount * (fee_value / 100.0)) if fee_type == "percentage" else fee_value
    fee = max(0.0, float(fee))
    if use_card_fee_tiers and target_currency == "USD":
        card_fees = await db.card_fees.find({}, {"_id": 0}).sort("min_amount", 1).to_list(100)
        fee = max(0.0, float(_calculate_card_fee_usd(float(request.amount), card_fees)))
        fee_source = "card_fees"

    # Fee is added on top: user receives `amount`, wallet is charged (amount + fee)
    net_amount = max(0.0, float(request.amount))
    total_amount = max(0.0, float(request.amount + fee))

    # Determine source and target currencies (cross-currency withdrawals supported)
    source_currency = (request.source_currency or request.currency).upper()
    if source_currency not in ["HTG", "USD"]:
        raise HTTPException(status_code=400, detail="Invalid source currency")

    rates = await db.exchange_rates.find_one({"rate_id": "main"}, {"_id": 0})
    if not rates:
        rates = {"htg_to_usd": 0.0075, "usd_to_htg": 133.0}

    if source_currency == target_currency:
        amount_to_deduct = float(total_amount)
        exchange_rate_used = 1
    elif source_currency == "USD" and target_currency == "HTG":
        amount_to_deduct = float(total_amount) * float(rates["htg_to_usd"])
        exchange_rate_used = float(rates["htg_to_usd"])
    else:
        amount_to_deduct = float(total_amount) * float(rates["usd_to_htg"])
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
            "fee_source": fee_source,
            "use_card_fee_tiers": use_card_fee_tiers,
            "minimum_amount": min_amount,
            "maximum_amount": max_amount,
            "supported_currencies": method.get("supported_currencies", []),
            "withdrawal_config": withdrawal_cfg,
        },
        "amount": float(request.amount),
        "fee": fee,
        "net_amount": net_amount,
        "total_amount": total_amount,
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

    # Notify admins (email + telegram)
    try:
        await notify_admin(
            subject="KAYICOM - New Withdrawal Request",
            html=f"""
            <h2>New Withdrawal Request</h2>
            <p><strong>Client:</strong> {current_user.get('full_name', '')} ({current_user.get('client_id', '')})</p>
            <p><strong>Amount:</strong> {withdrawal['amount']} {withdrawal['currency']}</p>
            <p><strong>Fee:</strong> {withdrawal.get('fee', 0)} {withdrawal['currency']}</p>
            <p><strong>Total deducted:</strong> {withdrawal.get('total_amount', (withdrawal.get('amount', 0) or 0) + (withdrawal.get('fee', 0) or 0))} {withdrawal['currency']}</p>
            <p><strong>Method:</strong> {withdrawal.get('payment_method_name') or withdrawal.get('payment_method_id')}</p>
            <p><strong>Status:</strong> pending</p>
            <p>Withdrawal ID: <code>{withdrawal['withdrawal_id']}</code></p>
            """,
            telegram_message=(
                f"🏧 <b>New Withdrawal Request</b>\n"
                f"Client: <b>{current_user.get('full_name','')}</b> ({current_user.get('client_id','')})\n"
                f"Amount: <b>{withdrawal['amount']} {withdrawal['currency']}</b>\n"
                f"Fee: <b>{withdrawal.get('fee', 0)} {withdrawal['currency']}</b>\n"
                f"Total: <b>{withdrawal.get('total_amount', (withdrawal.get('amount', 0) or 0) + (withdrawal.get('fee', 0) or 0))} {withdrawal['currency']}</b>\n"
                f"Method: <b>{withdrawal.get('payment_method_name') or withdrawal.get('payment_method_id')}</b>\n"
                f"ID: <code>{withdrawal['withdrawal_id']}</code>"
            ),
        )
    except Exception as e:
        logger.error(f"Failed to notify admins for withdrawal: {e}")

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
    
    kyc_id = str(uuid.uuid4())
    settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})

    # Store images professionally (Cloudinary when configured). Keep backward-compatible field names.
    id_front = await _kyc_store_image_value(
        request.id_front_image,
        user_id=current_user["user_id"],
        kyc_id=kyc_id,
        field_name="id_front_image",
        settings=settings,
    )
    id_back = await _kyc_store_image_value(
        request.id_back_image,
        user_id=current_user["user_id"],
        kyc_id=kyc_id,
        field_name="id_back_image",
        settings=settings,
    )
    selfie = await _kyc_store_image_value(
        request.selfie_with_id,
        user_id=current_user["user_id"],
        kyc_id=kyc_id,
        field_name="selfie_with_id",
        settings=settings,
    )

    kyc_doc = {
        "kyc_id": kyc_id,
        "user_id": current_user["user_id"],
        "client_id": current_user["client_id"],
        "full_name": request.full_name,
        "date_of_birth": request.date_of_birth,
        "full_address": request.full_address,
        "city": request.city,
        "state": request.state,
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
CARD_BONUS_USD = 0  # Bonus removed (kept for backward compatibility)

def _calculate_card_fee_usd(amount: float, card_fees: List[Dict[str, Any]]) -> float:
    """
    Calculate fee (USD) using the same tiers used for card top-ups.
    card_fees docs: {min_amount, max_amount, fee, is_percentage}
    """
    try:
        amt = float(amount or 0)
    except Exception:
        return 0.0
    if amt <= 0 or not card_fees:
        return 0.0
    for fee_config in (card_fees or []):
        try:
            mn = float(fee_config.get("min_amount", 0) or 0)
            mx = float(fee_config.get("max_amount", 0) or 0)
            if amt < mn or amt > mx:
                continue
            fee_val = float(fee_config.get("fee", 0) or 0)
            if fee_config.get("is_percentage"):
                return round(amt * (fee_val / 100.0), 2)
            return round(fee_val, 2)
        except Exception:
            continue
    return 0.0

@api_router.get("/virtual-cards")
async def get_virtual_cards(current_user: dict = Depends(get_current_user)):
    settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
    # Read-only access should remain available even if virtual cards are temporarily disabled,
    # so customers can still see their previously issued cards/orders.
    cards = await db.virtual_cards.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0}
    ).to_list(10)
    return {"cards": cards}

@api_router.get("/virtual-cards/orders")
async def get_card_orders(
    current_user: dict = Depends(get_current_user),
    refresh: bool = Query(default=False),
):
    """
    Get user's virtual card orders.

    - Always hides admin/internal fields from customers.
    - When `refresh=1`, best-effort pulls fresh Strowallet card details (balance/status/etc)
      and persists safe fields for customer dashboard display.
    """
    settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})

    # Best-effort sync before returning, so the customer dashboard shows latest provider data.
    # Keep this guarded: only when feature enabled + refresh requested.
    if refresh and _virtual_cards_enabled(settings):
        cfg = _strowallet_config(settings)
        if cfg.get("fetch_detail_path"):
            # Fetch user strowallet customer id once (some deployments require it).
            u = await db.users.find_one(
                {"user_id": current_user["user_id"]},
                {"_id": 0, "strowallet_customer_id": 1, "strowallet_user_id": 1},
            )
            stw_customer_id = (u or {}).get("strowallet_customer_id") or (u or {}).get("strowallet_user_id")

            # Only refresh approved provider cards; cap to avoid hammering provider.
            candidates = await db.virtual_card_orders.find(
                {
                    "user_id": current_user["user_id"],
                    "status": "approved",
                    "provider": "strowallet",
                    "provider_card_id": {"$ne": None},
                },
                {"_id": 0, "order_id": 1, "provider_card_id": 1, "spending_limit_usd": 1, "spending_limit_period": 1, "card_status": 1},
            ).sort("created_at", -1).limit(5).to_list(5)

            sem = asyncio.Semaphore(2)

            async def _refresh_one(o: Dict[str, Any]) -> None:
                async with sem:
                    try:
                        payload: Dict[str, Any] = {
                            "card_id": o.get("provider_card_id"),
                            "reference": f"orders-refresh-{o.get('order_id')}",
                        }
                        if stw_customer_id:
                            payload["customer_id"] = stw_customer_id
                            payload["card_user_id"] = stw_customer_id
                        payload = _with_aliases(payload, "card_id", "cardId", "id")

                        stw_detail = await _strowallet_post(settings, cfg["fetch_detail_path"], payload)

                        # Extract safe fields only (never store PAN/CVV).
                        card_number = _extract_first(stw_detail, "data.card_number", "data.number", "card_number", "number", "data.card.number", "data.card.card_number")
                        card_expiry = _extract_first(stw_detail, "data.expiry", "data.expiry_date", "expiry", "expiry_date", "data.card.expiry", "data.card.expiry_date")
                        card_holder_name = _extract_first(stw_detail, "data.name_on_card", "data.card_name", "name_on_card", "card_name", "data.card.name_on_card")
                        card_brand = _extract_first(stw_detail, "data.brand", "brand", "data.card.brand")
                        card_type = _extract_first(stw_detail, "data.type", "type", "data.card.type")
                        card_balance = _extract_float_first(
                            stw_detail,
                            "data.balance",
                            "data.available_balance",
                            "data.availableBalance",
                            "balance",
                            "available_balance",
                            "availableBalance",
                            "data.card.balance",
                            "data.card.available_balance",
                            "data.card.availableBalance",
                        )
                        card_currency = _extract_first(stw_detail, "data.currency", "currency", "data.card.currency")
                        raw_status = _extract_first(
                            stw_detail,
                            "data.status",
                            "data.card_status",
                            "card_status",
                            "status",
                            "data.card.status",
                            "data.card.card_status",
                        )
                        raw_limit = _extract_float_first(
                            stw_detail,
                            "data.spending_limit",
                            "data.spendingLimit",
                            "spending_limit",
                            "spendingLimit",
                            "data.limit",
                            "limit",
                            "data.card.limit",
                            "data.card.spending_limit",
                        )
                        raw_period = _extract_first(
                            stw_detail,
                            "data.spending_limit_period",
                            "data.spendingLimitPeriod",
                            "spending_limit_period",
                            "spendingLimitPeriod",
                            "data.period",
                            "period",
                        )
                        raw_reason = _extract_first(
                            stw_detail,
                            "data.lock_reason",
                            "data.locked_reason",
                            "locked_reason",
                            "lock_reason",
                            "data.reason",
                            "reason",
                        )

                        update_doc: Dict[str, Any] = {}
                        if card_number:
                            card_number_str = str(card_number).replace(" ", "")
                            update_doc["card_last4"] = card_number_str[-4:]
                        if card_expiry:
                            update_doc["card_expiry"] = str(card_expiry)
                        if card_holder_name:
                            update_doc["card_holder_name"] = str(card_holder_name)
                        if card_brand:
                            update_doc["card_brand"] = str(card_brand)
                        if card_type:
                            update_doc["card_type"] = str(card_type).lower()
                        if card_balance is not None:
                            update_doc["card_balance"] = float(card_balance)
                        if card_currency:
                            update_doc["card_currency"] = str(card_currency).upper()

                        # Provider status -> normalize for dashboard ("active"/"locked") when possible.
                        if raw_status:
                            s = str(raw_status).strip().lower()
                            if any(x in s for x in ("lock", "freeze", "blocked", "suspend")):
                                update_doc["card_status"] = "locked"
                            elif any(x in s for x in ("active", "open", "unfreeze", "unlocked")):
                                update_doc["card_status"] = "active"

                        if raw_reason and isinstance(raw_reason, (str, int, float)):
                            update_doc["locked_reason"] = str(raw_reason)[:400]

                        # Provider spending limit (best-effort) -> keep within our policy bounds.
                        if raw_limit is not None:
                            lim = float(raw_limit)
                            if 0 < lim <= 5000:
                                update_doc["spending_limit_usd"] = round(lim, 2)
                        if raw_period:
                            p = str(raw_period).strip().lower()
                            if "day" in p:
                                update_doc["spending_limit_period"] = "daily"
                            elif "month" in p:
                                update_doc["spending_limit_period"] = "monthly"

                        if update_doc:
                            await db.virtual_card_orders.update_one(
                                {"order_id": o.get("order_id"), "user_id": current_user["user_id"]},
                                {"$set": update_doc},
                            )
                    except Exception:
                        # Fully best-effort: do not block the list page if provider errors.
                        return

            await asyncio.gather(*[_refresh_one(o) for o in (candidates or [])], return_exceptions=True)

    # Read-only access should remain available even if disabled (do not hide already-issued cards).
    # SECURITY: hide admin/internal identifiers from customers.
    orders = await db.virtual_card_orders.find(
        {"user_id": current_user["user_id"]},
        {
            "_id": 0,
            # Never expose sensitive card data to clients.
            "card_number": 0,
            "card_cvv": 0,
            "provider_raw": 0,
            # Never expose admin/internal fields to clients.
            "provider_card_id": 0,
            "admin_notes": 0,
            "processed_by": 0,
            "processed_at": 0,
            "user_id": 0,
            "client_id": 0,
        },
    ).sort("created_at", -1).to_list(50)
    return {"orders": orders}


@api_router.get("/virtual-cards/{order_id}/detail")
async def virtual_card_detail(
    order_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Fetch/refresh a user's card details (best-effort).
    We never return full card number/CVV to clients.
    """
    settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
    # Internal fetch (keep provider_card_id for refresh logic).
    order_full = await db.virtual_card_orders.find_one(
        {"order_id": order_id, "user_id": current_user["user_id"], "status": "approved"},
        {"_id": 0, "card_number": 0, "card_cvv": 0, "provider_raw": 0},
    )
    if not order_full:
        raise HTTPException(status_code=404, detail="Card not found or not approved")

    # If virtual cards are disabled, allow viewing stored details but don't call provider.
    if not _virtual_cards_enabled(settings):
        safe = await db.virtual_card_orders.find_one(
            {"order_id": order_id, "user_id": current_user["user_id"]},
            {
                "_id": 0,
                "card_number": 0,
                "card_cvv": 0,
                "provider_raw": 0,
                "provider_card_id": 0,
                "admin_notes": 0,
                "processed_by": 0,
                "processed_at": 0,
                "user_id": 0,
                "client_id": 0,
            },
        )
        return {"card": safe or {}, "note": "Virtual cards are currently disabled; provider refresh is unavailable."}

    # Only Strowallet cards support provider refresh at the moment.
    if order_full.get("provider") != "strowallet" or not order_full.get("provider_card_id"):
        safe = await db.virtual_card_orders.find_one(
            {"order_id": order_id, "user_id": current_user["user_id"]},
            {
                "_id": 0,
                "card_number": 0,
                "card_cvv": 0,
                "provider_raw": 0,
                "provider_card_id": 0,
                "admin_notes": 0,
                "processed_by": 0,
                "processed_at": 0,
                "user_id": 0,
                "client_id": 0,
            },
        )
        return {"card": safe or {}, "note": "No provider detail available for this card"}

    cfg = _strowallet_config(settings)
    if not cfg.get("fetch_detail_path"):
        return {"card": order, "note": "Provider card detail endpoint not configured"}

    # Try fetch detail from provider to populate last4/expiry/etc.
    payload: Dict[str, Any] = {
        "card_id": order_full.get("provider_card_id"),
        "reference": f"detail-{order_id}",
    }
    # Include customer id if present (some deployments require it).
    u = await db.users.find_one({"user_id": current_user["user_id"]}, {"_id": 0, "strowallet_customer_id": 1, "strowallet_user_id": 1})
    stw_customer_id = (u or {}).get("strowallet_customer_id") or (u or {}).get("strowallet_user_id")
    if stw_customer_id:
        payload["customer_id"] = stw_customer_id
        payload["card_user_id"] = stw_customer_id
    payload = _with_aliases(payload, "card_id", "cardId", "id")

    stw_detail = await _strowallet_post(settings, cfg["fetch_detail_path"], payload)
    card_number = _extract_first(stw_detail, "data.card_number", "data.number", "card_number", "number", "data.card.number", "data.card.card_number")
    card_expiry = _extract_first(stw_detail, "data.expiry", "data.expiry_date", "expiry", "expiry_date", "data.card.expiry", "data.card.expiry_date")
    card_holder_name = _extract_first(stw_detail, "data.name_on_card", "data.card_name", "name_on_card", "card_name", "data.card.name_on_card")
    card_brand = _extract_first(stw_detail, "data.brand", "brand", "data.card.brand")
    card_type = _extract_first(stw_detail, "data.type", "type", "data.card.type")
    card_balance = _extract_float_first(
        stw_detail,
        "data.balance",
        "data.available_balance",
        "data.availableBalance",
        "balance",
        "available_balance",
        "availableBalance",
        "data.card.balance",
        "data.card.available_balance",
        "data.card.availableBalance",
    )
    card_currency = _extract_first(
        stw_detail,
        "data.currency",
        "currency",
        "data.card.currency",
    )

    update_doc: Dict[str, Any] = {}
    if card_number:
        card_number_str = str(card_number).replace(" ", "")
        update_doc["card_last4"] = card_number_str[-4:]
    if card_expiry:
        update_doc["card_expiry"] = str(card_expiry)
    if card_holder_name:
        update_doc["card_holder_name"] = str(card_holder_name)
    if card_brand and not order.get("card_brand"):
        update_doc["card_brand"] = str(card_brand)
    if card_type and not order.get("card_type"):
        update_doc["card_type"] = str(card_type).lower()
    if card_balance is not None:
        update_doc["card_balance"] = float(card_balance)
    if card_currency and not order_full.get("card_currency"):
        update_doc["card_currency"] = str(card_currency).upper()

    # Extra provider fields (best-effort) for customer dashboard:
    raw_status = _extract_first(
        stw_detail,
        "data.status",
        "data.card_status",
        "card_status",
        "status",
        "data.card.status",
        "data.card.card_status",
    )
    raw_reason = _extract_first(
        stw_detail,
        "data.lock_reason",
        "data.locked_reason",
        "locked_reason",
        "lock_reason",
        "data.reason",
        "reason",
    )
    raw_limit = _extract_float_first(
        stw_detail,
        "data.spending_limit",
        "data.spendingLimit",
        "spending_limit",
        "spendingLimit",
        "data.limit",
        "limit",
        "data.card.limit",
        "data.card.spending_limit",
    )
    raw_period = _extract_first(
        stw_detail,
        "data.spending_limit_period",
        "data.spendingLimitPeriod",
        "spending_limit_period",
        "spendingLimitPeriod",
        "data.period",
        "period",
    )

    if raw_status:
        s = str(raw_status).strip().lower()
        if any(x in s for x in ("lock", "freeze", "blocked", "suspend")):
            update_doc["card_status"] = "locked"
        elif any(x in s for x in ("active", "open", "unfreeze", "unlocked")):
            update_doc["card_status"] = "active"

    if raw_reason and isinstance(raw_reason, (str, int, float)):
        update_doc["locked_reason"] = str(raw_reason)[:400]

    if raw_limit is not None:
        lim = float(raw_limit)
        if 0 < lim <= 5000:
            update_doc["spending_limit_usd"] = round(lim, 2)
    if raw_period:
        p = str(raw_period).strip().lower()
        if "day" in p:
            update_doc["spending_limit_period"] = "daily"
        elif "month" in p:
            update_doc["spending_limit_period"] = "monthly"

    if update_doc:
        await db.virtual_card_orders.update_one({"order_id": order_id}, {"$set": update_doc})
        order_full.update(update_doc)

    # Return sanitized document to customer (no provider_card_id/admin_notes/internal ids).
    safe = await db.virtual_card_orders.find_one(
        {"order_id": order_id, "user_id": current_user["user_id"]},
        {
            "_id": 0,
            "card_number": 0,
            "card_cvv": 0,
            "provider_raw": 0,
            "provider_card_id": 0,
            "admin_notes": 0,
            "processed_by": 0,
            "processed_at": 0,
            "user_id": 0,
            "client_id": 0,
        },
    )
    return {"provider": "strowallet", "card": safe or {}}

@api_router.get("/virtual-cards/deposits")
async def get_card_deposits(current_user: dict = Depends(get_current_user)):
    """Get user's card deposit history (deposits made to their virtual card)"""
    settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
    # Read-only access should remain available even if disabled.
    deposits = await db.virtual_card_deposits.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return {"deposits": deposits}

@api_router.post("/virtual-cards/order")
async def order_virtual_card(request: VirtualCardOrder, current_user: dict = Depends(get_current_user)):
    """Submit a card order request (auto-issue when Strowallet is enabled)."""
    settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
    if not _virtual_cards_enabled(settings):
        raise HTTPException(status_code=403, detail="Virtual cards are currently disabled")
    if current_user["kyc_status"] != "approved":
        raise HTTPException(status_code=403, detail="KYC verification required")
    
    # Get card fee from settings
    card_fee_htg = settings.get("card_order_fee_htg", CARD_FEE_HTG) if settings else CARD_FEE_HTG
    
    if current_user.get("wallet_htg", 0) < card_fee_htg:
        raise HTTPException(status_code=400, detail=f"Insufficient balance. Card fee is {card_fee_htg} HTG")
    
    # Deduct fee
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$inc": {"wallet_htg": -card_fee_htg}}
    )
    
    card_email = (request.card_email or current_user.get("email") or "").strip().lower()
    if not card_email:
        raise HTTPException(status_code=400, detail="Card email is required (missing user email)")

    # Create card order (manual process - admin will approve/reject)
    order = {
        "order_id": str(uuid.uuid4()),
        "user_id": current_user["user_id"],
        "client_id": current_user["client_id"],
        "card_email": card_email,
        "fee": card_fee_htg,
        "status": "pending",  # pending, approved, rejected
        "card_status": "pending",  # pending, active, locked
        "failed_payment_count": 0,
        "spending_limit_usd": 500.0,  # default limit (white-label program policy)
        "spending_limit_period": "monthly",  # daily|monthly
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

    # AUTO-ISSUE: If Strowallet is enabled, create the card immediately so it appears in the customer dashboard.
    # If issuance fails for any reason, keep order pending for admin follow-up (do not lose the order).
    msg = "Card order submitted successfully"
    try:
        if _strowallet_enabled(settings):
            user = await db.users.find_one({"user_id": current_user["user_id"]}, {"_id": 0})
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            issue_update = await _strowallet_issue_card_for_order(settings=settings, order=order, user=user)
            await db.virtual_card_orders.update_one({"order_id": order["order_id"]}, {"$set": issue_update})
            order.update(issue_update)
            msg = "Card created successfully"
    except HTTPException as e:
        # Keep it pending; store a useful note for admin.
        try:
            await db.virtual_card_orders.update_one(
                {"order_id": order["order_id"]},
                {"$set": {
                    "status": "pending",
                    "admin_notes": f"Auto-issue failed; needs admin review. {getattr(e, 'detail', str(e))}",
                    "processed_at": None,
                    "processed_by": None,
                }},
            )
        except Exception:
            pass
        msg = "Card order submitted successfully (pending provider issuance)"
    except Exception as e:
        try:
            await db.virtual_card_orders.update_one(
                {"order_id": order["order_id"]},
                {"$set": {
                    "status": "pending",
                    "admin_notes": f"Auto-issue failed; needs admin review. {str(e)}",
                    "processed_at": None,
                    "processed_by": None,
                }},
            )
        except Exception:
            pass
        msg = "Card order submitted successfully (pending provider issuance)"

    if "_id" in order:
        del order["_id"]
    return {"order": order, "message": msg}

class CardTopUpRequest(BaseModel):
    order_id: str
    amount: float

@api_router.post("/virtual-cards/top-up")
async def top_up_virtual_card(request: CardTopUpRequest, current_user: dict = Depends(get_current_user)):
    """Submit a card top-up request - deducts from USD balance, admin delivers to card"""
    settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
    if not _virtual_cards_enabled(settings):
        raise HTTPException(status_code=403, detail="Virtual cards are currently disabled")
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
    # Allow top-ups even if the card is locked/frozen, so users can fix insufficient funds.
    
    if request.amount < 5:
        raise HTTPException(status_code=400, detail="Minimum amount is $5")
    
    # Calculate fee based on card fees
    card_fees = await db.card_fees.find({}, {"_id": 0}).sort("min_amount", 1).to_list(100)
    fee = _calculate_card_fee_usd(float(request.amount), card_fees)
    
    # Fee is added on top: client receives `amount` on card, wallet is charged (amount + fee)
    total_deduction = round(float(request.amount) + float(fee or 0), 2)
    
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
        "net_amount": request.amount,
        "total_amount": total_deduction,
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
        "amount": -total_deduction,
        "currency": "USD",
        "status": "pending",
        "description": f"Card top-up to {card_order.get('card_email')} (pending) - amount ${float(request.amount):.2f} fee ${float(fee):.2f}",
        "reference_id": deposit["deposit_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    await log_action(current_user["user_id"], "card_topup", {"deposit_id": deposit["deposit_id"], "amount": request.amount, "fee": fee, "total": total_deduction})

    # If the card is a Strowallet-issued card and Strowallet automation is enabled,
    # try to deliver the top-up instantly.
    try:
        settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
        if _strowallet_enabled(settings) and (card_order.get("provider") == "strowallet") and card_order.get("provider_card_id"):
            cfg = _strowallet_config(settings)
            fund_payload: Dict[str, Any] = {
                "card_id": card_order.get("provider_card_id"),
                "amount": float(request.amount),
                "currency": "USD",
                "reference": deposit["deposit_id"],
            }
            fund_payload = _with_aliases(fund_payload, "card_id", "cardId", "id")
            fund_payload = _with_aliases(fund_payload, "amount", "fund_amount", "value")
            stw_resp = await _strowallet_post(settings, cfg["fund_path"], fund_payload)
            provider_txn_id = _extract_first(stw_resp, "data.transaction_id", "data.txn_id", "transaction_id", "txn_id", "id")

            await db.virtual_card_deposits.update_one(
                {"deposit_id": deposit["deposit_id"]},
                {"$set": {
                    "status": "approved",
                    "processed_at": datetime.now(timezone.utc).isoformat(),
                    "processed_by": "system",
                    "delivery_info": f"Auto delivered via Strowallet{(' (txn ' + str(provider_txn_id) + ')') if provider_txn_id else ''}",
                    "provider": "strowallet",
                    "provider_txn_id": provider_txn_id,
                    "provider_raw": _redact_sensitive_payload(stw_resp),
                }}
            )

            await db.transactions.update_one(
                {"reference_id": deposit["deposit_id"]},
                {"$set": {"status": "completed"}}
            )
    except Exception as e:
        # Keep the request pending for manual processing if Strowallet fails.
        logger.warning(f"Strowallet auto top-up failed for deposit {deposit.get('deposit_id')}: {e}")
    
    if "_id" in deposit:
        del deposit["_id"]
    return {"deposit": deposit, "message": "Top-up request submitted successfully"}

class CardWithdrawRequest(BaseModel):
    order_id: str
    amount: float

class CardControlsUpdate(BaseModel):
    spending_limit_usd: Optional[float] = None
    spending_limit_period: Optional[Literal["daily", "monthly"]] = None
    lock: Optional[bool] = None

@api_router.patch("/virtual-cards/{order_id}/controls")
async def update_virtual_card_controls(
    order_id: str,
    payload: CardControlsUpdate,
    current_user: dict = Depends(get_current_user),
):
    """
    Manage a Strowallet virtual card:
    - Set spending limit (white-label control)
    - Lock/unlock (unlock not allowed if card has 3+ failed payments)
    """
    settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
    if not _virtual_cards_enabled(settings):
        raise HTTPException(status_code=403, detail="Virtual cards are currently disabled")

    order = await db.virtual_card_orders.find_one({
        "order_id": order_id,
        "user_id": current_user["user_id"],
        "status": "approved",
    }, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Card not found or not approved")

    # Only automated (Strowallet) cards can be managed here.
    if order.get("provider") != "strowallet" or not order.get("provider_card_id"):
        raise HTTPException(status_code=400, detail="This card cannot be managed automatically")

    # We auto-freeze on first failure to prevent 3-fail hard blocks; do not hard-block unlocks.
    failed_count = int(order.get("failed_payment_count", 0) or 0)
    # Hard-block policy: after 3 failed payments, user must contact support to unlock.
    # (UI already enforces this; backend must enforce it too.)
    is_hard_blocked = failed_count >= 3

    update_doc: Dict[str, Any] = {}

    if payload.spending_limit_usd is not None:
        limit = float(payload.spending_limit_usd)
        if limit <= 0:
            raise HTTPException(status_code=400, detail="Spending limit must be greater than 0")
        if limit > 5000:
            raise HTTPException(status_code=400, detail="Spending limit too high")
        update_doc["spending_limit_usd"] = round(limit, 2)

    if payload.spending_limit_period is not None:
        update_doc["spending_limit_period"] = payload.spending_limit_period

    if payload.lock is not None:
        if payload.lock is False and is_hard_blocked:
            raise HTTPException(status_code=400, detail="Card is blocked. Contact support.")
        update_doc["card_status"] = "locked" if payload.lock else "active"

    if not update_doc:
        return {"message": "No changes", "card": order}

    # Try updating provider controls if configured.
    cfg = _strowallet_config(settings)
    try:
        if _strowallet_enabled(settings):
            if ("spending_limit_usd" in update_doc or "spending_limit_period" in update_doc) and cfg.get("set_limit_path"):
                await _strowallet_post(settings, cfg["set_limit_path"], {
                    "card_id": order.get("provider_card_id"),
                    "limit": float(update_doc.get("spending_limit_usd", order.get("spending_limit_usd", 500.0))),
                    "period": str(update_doc.get("spending_limit_period", order.get("spending_limit_period", "monthly"))),
                    "reference": f"limit-{order_id}",
                })
            if payload.lock is True and cfg.get("freeze_path"):
                await _strowallet_post(settings, cfg["freeze_path"], {
                    "card_id": order.get("provider_card_id"),
                    "reference": f"freeze-{order_id}",
                })
            if payload.lock is False and cfg.get("unfreeze_path"):
                await _strowallet_post(settings, cfg["unfreeze_path"], {
                    "card_id": order.get("provider_card_id"),
                    "reference": f"unfreeze-{order_id}",
                })
    except Exception as e:
        # Keep local state consistent; provider controls can be retried by admin if needed.
        logger.warning(f"Strowallet controls update failed for order {order_id}: {e}")

    await db.virtual_card_orders.update_one({"order_id": order_id}, {"$set": update_doc})
    updated = await db.virtual_card_orders.find_one({"order_id": order_id}, {"_id": 0})

    await log_action(current_user["user_id"], "card_controls_update", {"order_id": order_id, "changes": update_doc})
    return {"message": "Card updated", "card": updated}

@api_router.get("/virtual-cards/withdrawals")
async def get_card_withdrawals(current_user: dict = Depends(get_current_user)):
    """Get user's card withdrawal history (withdrawals from virtual card back to wallet)."""
    settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
    # Read-only access should remain available even if disabled.
    withdrawals = await db.virtual_card_withdrawals.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0},
    ).sort("created_at", -1).to_list(50)
    return {"withdrawals": withdrawals}

@api_router.post("/virtual-cards/withdraw")
async def withdraw_from_virtual_card(request: CardWithdrawRequest, current_user: dict = Depends(get_current_user)):
    """
    Withdraw funds from a Strowallet virtual card back to the user's wallet (USD).
    This requires Strowallet automation to be enabled and the card to have a provider_card_id.
    """
    settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
    if not _virtual_cards_enabled(settings):
        raise HTTPException(status_code=403, detail="Virtual cards are currently disabled")
    if current_user["kyc_status"] != "approved":
        raise HTTPException(status_code=403, detail="KYC verification required")

    card_order = await db.virtual_card_orders.find_one({
        "order_id": request.order_id,
        "user_id": current_user["user_id"],
        "status": "approved",
    }, {"_id": 0})
    if not card_order:
        raise HTTPException(status_code=404, detail="Card not found or not approved")

    amt = float(request.amount or 0)
    if amt < 5:
        raise HTTPException(status_code=400, detail="Minimum amount is $5")

    if not _strowallet_enabled(settings):
        raise HTTPException(status_code=400, detail="Card withdrawals are not enabled")
    if card_order.get("provider") != "strowallet" or not card_order.get("provider_card_id"):
        raise HTTPException(status_code=400, detail="This card is not eligible for automated withdrawals")
    # Allow withdrawals even if the card is locked/frozen.

    withdrawal_id = str(uuid.uuid4())
    cfg = _strowallet_config(settings)
    withdraw_payload: Dict[str, Any] = {
        "card_id": card_order.get("provider_card_id"),
        "amount": amt,
        "currency": "USD",
        "reference": withdrawal_id,
    }

    stw_resp = await _strowallet_post(settings, cfg["withdraw_path"], withdraw_payload)
    provider_txn_id = _extract_first(stw_resp, "data.transaction_id", "data.txn_id", "transaction_id", "txn_id", "id")

    record = {
        "withdrawal_id": withdrawal_id,
        "user_id": current_user["user_id"],
        "client_id": current_user["client_id"],
        "order_id": request.order_id,
        "card_email": card_order.get("card_email"),
        "card_brand": card_order.get("card_brand"),
        "card_type": card_order.get("card_type"),
        "card_last4": card_order.get("card_last4"),
        "amount": amt,
        "currency": "USD",
        "status": "approved",
        "provider": "strowallet",
        "provider_txn_id": provider_txn_id,
        "provider_raw": _redact_sensitive_payload(stw_resp),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "processed_at": datetime.now(timezone.utc).isoformat(),
        "processed_by": "system",
    }

    await db.virtual_card_withdrawals.insert_one(record)
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$inc": {"wallet_usd": amt}},
    )
    await db.transactions.insert_one({
        "transaction_id": str(uuid.uuid4()),
        "user_id": current_user["user_id"],
        "type": "card_withdrawal",
        "amount": amt,
        "currency": "USD",
        "status": "completed",
        "description": f"Card withdrawal from {card_order.get('card_email')} (Strowallet)",
        "reference_id": withdrawal_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await log_action(current_user["user_id"], "card_withdrawal", {"withdrawal_id": withdrawal_id, "amount": amt})

    if "_id" in record:
        del record["_id"]
    return {"withdrawal": record, "message": "Withdrawal processed successfully"}


@api_router.get("/virtual-cards/{order_id}/transactions")
async def virtual_card_transactions(
    order_id: str,
    page: int = Query(default=1, ge=1, le=10000),
    take: int = Query(default=50, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
):
    """
    Fetch Strowallet card transactions for a user's approved card.
    Requires provider card id and Strowallet automation enabled.
    """
    settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
    if not _virtual_cards_enabled(settings):
        raise HTTPException(status_code=403, detail="Virtual cards are currently disabled")

    order = await db.virtual_card_orders.find_one(
        {"order_id": order_id, "user_id": current_user["user_id"], "status": "approved"},
        {"_id": 0},
    )
    if not order:
        raise HTTPException(status_code=404, detail="Card not found or not approved")
    if order.get("provider") != "strowallet" or not order.get("provider_card_id"):
        raise HTTPException(status_code=400, detail="This card is not eligible for provider transactions")

    cfg = _strowallet_config(settings)
    if not cfg.get("card_tx_path"):
        raise HTTPException(status_code=400, detail="Card transactions endpoint not configured")

    payload: Dict[str, Any] = {
        "card_id": order.get("provider_card_id"),
        "page": str(page),
        "take": str(take),
        "reference": f"tx-{order_id}-{page}-{take}",
    }
    payload = _with_aliases(payload, "card_id", "cardId", "id")
    resp = await _strowallet_post(settings, cfg["card_tx_path"], payload)
    return {"provider": "strowallet", "order_id": order_id, "response": resp}


@api_router.get("/virtual-cards/{order_id}/history")
async def virtual_card_full_history(
    order_id: str,
    page: int = Query(default=1, ge=1, le=10000),
    take: int = Query(default=50, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
):
    """
    Fetch full card history if provider offers a dedicated endpoint.
    Falls back to transactions endpoint if not configured.
    """
    settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
    if not _virtual_cards_enabled(settings):
        raise HTTPException(status_code=403, detail="Virtual cards are currently disabled")

    order = await db.virtual_card_orders.find_one(
        {"order_id": order_id, "user_id": current_user["user_id"], "status": "approved"},
        {"_id": 0},
    )
    if not order:
        raise HTTPException(status_code=404, detail="Card not found or not approved")
    if order.get("provider") != "strowallet" or not order.get("provider_card_id"):
        raise HTTPException(status_code=400, detail="This card is not eligible for provider history")

    cfg = _strowallet_config(settings)
    path = cfg.get("full_history_path") or cfg.get("card_tx_path")
    if not path:
        raise HTTPException(status_code=400, detail="Card history endpoint not configured")

    payload: Dict[str, Any] = {
        "card_id": order.get("provider_card_id"),
        "page": str(page),
        "take": str(take),
        "reference": f"hist-{order_id}-{page}-{take}",
    }
    payload = _with_aliases(payload, "card_id", "cardId", "id")
    resp = await _strowallet_post(settings, path, payload)
    return {"provider": "strowallet", "order_id": order_id, "response": resp, "path_used": path}


class FreezeUnfreezeRequest(BaseModel):
    action: Literal["freeze", "unfreeze"]


@api_router.post("/virtual-cards/{order_id}/freezeunfreeze")
async def virtual_card_freezeunfreeze(
    order_id: str,
    payload: FreezeUnfreezeRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Freeze/unfreeze card. Supports either a single provider endpoint (freeze_unfreeze_path)
    or separate freeze/unfreeze paths.
    """
    settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
    if not _virtual_cards_enabled(settings):
        raise HTTPException(status_code=403, detail="Virtual cards are currently disabled")

    order = await db.virtual_card_orders.find_one(
        {"order_id": order_id, "user_id": current_user["user_id"], "status": "approved"},
        {"_id": 0},
    )
    if not order:
        raise HTTPException(status_code=404, detail="Card not found or not approved")
    if order.get("provider") != "strowallet" or not order.get("provider_card_id"):
        raise HTTPException(status_code=400, detail="This card cannot be managed automatically")

    cfg = _strowallet_config(settings)
    body: Dict[str, Any] = {"card_id": order.get("provider_card_id"), "action": payload.action, "reference": f"{payload.action}-{order_id}"}
    body = _with_aliases(body, "card_id", "cardId", "id")

    if cfg.get("freeze_unfreeze_path"):
        resp = await _strowallet_post(settings, cfg["freeze_unfreeze_path"], body)
    else:
        if payload.action == "freeze":
            if not cfg.get("freeze_path"):
                raise HTTPException(status_code=400, detail="Freeze endpoint not configured")
            resp = await _strowallet_post(settings, cfg["freeze_path"], body)
        else:
            if not cfg.get("unfreeze_path"):
                raise HTTPException(status_code=400, detail="Unfreeze endpoint not configured")
            resp = await _strowallet_post(settings, cfg["unfreeze_path"], body)

    return {"provider": "strowallet", "order_id": order_id, "action": payload.action, "response": resp}


@api_router.get("/virtual-cards/withdrawals/{withdrawal_id}/status")
async def virtual_card_withdraw_status(
    withdrawal_id: str,
    current_user: dict = Depends(get_current_user),
):
    settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
    if not _virtual_cards_enabled(settings):
        raise HTTPException(status_code=403, detail="Virtual cards are currently disabled")

    record = await db.virtual_card_withdrawals.find_one(
        {"withdrawal_id": withdrawal_id, "user_id": current_user["user_id"]},
        {"_id": 0},
    )
    if not record:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    if record.get("provider") != "strowallet":
        return {"provider": record.get("provider"), "withdrawal": record}

    cfg = _strowallet_config(settings)
    if not cfg.get("withdraw_status_path"):
        return {"provider": "strowallet", "withdrawal": record, "note": "Provider withdraw status endpoint not configured"}

    payload: Dict[str, Any] = {
        "reference": record.get("withdrawal_id"),
        "transactionReference": record.get("provider_txn_id"),
        "transaction_reference": record.get("provider_txn_id"),
    }
    resp = await _strowallet_post(settings, cfg["withdraw_status_path"], payload)
    return {"provider": "strowallet", "withdrawal": record, "response": resp}


class UpgradeLimitRequest(BaseModel):
    limit: Optional[float] = None
    period: Optional[Literal["daily", "monthly"]] = None


@api_router.post("/virtual-cards/{order_id}/upgrade-limit")
async def virtual_card_upgrade_limit(
    order_id: str,
    payload: UpgradeLimitRequest,
    current_user: dict = Depends(get_current_user),
):
    settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
    if not _virtual_cards_enabled(settings):
        raise HTTPException(status_code=403, detail="Virtual cards are currently disabled")

    order = await db.virtual_card_orders.find_one(
        {"order_id": order_id, "user_id": current_user["user_id"], "status": "approved"},
        {"_id": 0},
    )
    if not order:
        raise HTTPException(status_code=404, detail="Card not found or not approved")
    if order.get("provider") != "strowallet" or not order.get("provider_card_id"):
        raise HTTPException(status_code=400, detail="This card cannot be managed automatically")

    cfg = _strowallet_config(settings)
    if not cfg.get("upgrade_limit_path"):
        raise HTTPException(status_code=400, detail="Upgrade limit endpoint not configured")

    body: Dict[str, Any] = {
        "card_id": order.get("provider_card_id"),
        "limit": payload.limit,
        "period": payload.period,
        "reference": f"upgrade-{order_id}",
    }
    body = {k: v for k, v in body.items() if v not in (None, "")}
    body = _with_aliases(body, "card_id", "cardId", "id")
    resp = await _strowallet_post(settings, cfg["upgrade_limit_path"], body)
    return {"provider": "strowallet", "order_id": order_id, "response": resp}

# ==================== STROWALLET WEBHOOK (FAILED PAYMENTS AUTO-LOCK) ====================

@api_router.post("/strowallet/webhook")
async def strowallet_webhook(request: Request):
    """
    Generic webhook receiver for Strowallet events.
    If a card payment fails 3 times, we mark the card as locked (and freeze at provider if configured).

    Security: requires STROWALLET_WEBHOOK_SECRET and matching X-Webhook-Secret header (or ?secret=...).
    """
    secret = (os.environ.get("STROWALLET_WEBHOOK_SECRET") or "").strip()
    if secret:
        provided = (request.headers.get("X-Webhook-Secret") or request.query_params.get("secret") or "").strip()
        if provided != secret:
            raise HTTPException(status_code=401, detail="Invalid webhook secret")

    try:
        payload = await request.json()
    except Exception:
        payload = {}

    # Extract card_id + failure status (best-effort; Strowallet schemas vary).
    card_id = (
        _extract_first(payload, "card_id", "data.card_id", "data.card.id", "data.cardId", "cardId")
        or ""
    )
    status = str(_extract_first(payload, "status", "data.status", "data.transaction_status", "transaction_status") or "").lower()
    event_type = str(_extract_first(payload, "event", "type", "event_type", "data.type") or "").lower()

    is_failed = status in {"failed", "declined", "reversed", "error"}
    is_payment = ("payment" in event_type) or ("transaction" in event_type) or (event_type == "")

    if not card_id or not (is_failed and is_payment):
        return {"ok": True}

    order = await db.virtual_card_orders.find_one(
        {"provider": "strowallet", "provider_card_id": card_id},
        {"_id": 0},
    )
    if not order:
        return {"ok": True}

    # If the card is already locked/frozen, ignore further failed events.
    # Goal: auto-freeze on first failure to prevent the card reaching a "3 failures" hard-block state.
    if str(order.get("card_status") or "").lower() == "locked":
        return {"ok": True, "note": "Card already locked; ignoring failed-payment event"}

    # First failure -> set failed count to 1 and lock/freeze.
    await db.virtual_card_orders.update_one(
        {"order_id": order["order_id"]},
        {"$set": {"failed_payment_count": 1}},
    )
    updated = await db.virtual_card_orders.find_one({"order_id": order["order_id"]}, {"_id": 0})
    failed_count = int((updated or {}).get("failed_payment_count", 0) or 0)

    settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
    cfg = _strowallet_config(settings)

    # Auto-freeze on FIRST failed payment to prevent provider-side hard blocks.
    if failed_count >= 1:
        await db.virtual_card_orders.update_one(
            {"order_id": order["order_id"]},
            {"$set": {
                "card_status": "locked",
                "locked_reason": "Auto-frozen after first failed payment (to prevent 3-fail block)",
                "locked_at": datetime.now(timezone.utc).isoformat(),
            }}
        )
        try:
            if _strowallet_enabled(settings) and cfg.get("freeze_path"):
                await _strowallet_post(settings, cfg["freeze_path"], {"card_id": card_id, "reference": f"autofreeze-1-{order['order_id']}"})
        except Exception as e:
            logger.warning(f"Failed to freeze Strowallet card {card_id} after first failed payment: {e}")

    await log_action(order.get("user_id") or "system", "strowallet_failed_payment", {"order_id": order["order_id"], "card_id": card_id, "failed_count": failed_count})
    return {"ok": True, "failed_count": failed_count}

# Admin: Get all card orders
@api_router.get("/admin/virtual-card-orders")
async def admin_get_card_orders(
    status: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    admin: dict = Depends(get_admin_user)
):
    query = {}
    # Treat `all` as "no filter" sentinel for admin UI.
    if status and status != "all":
        query["status"] = status

    # Keep list response lightweight to avoid admin UI freezes (exclude heavy/sensitive fields).
    orders = await db.virtual_card_orders.find(
        query,
        {
            "_id": 0,
            "card_image": 0,  # can be large base64
            "card_number": 0,  # sensitive
            "card_cvv": 0,  # sensitive
            "provider_raw": 0,  # omit from list payload (even redacted it can be large)
        },
    ).sort("created_at", -1).limit(limit).to_list(limit)

    # Enrich with basic user info for admin UX (so admin can see who placed the order)
    user_ids = list({o.get("user_id") for o in orders if o.get("user_id")})
    users_by_id: Dict[str, Dict[str, Any]] = {}
    if user_ids:
        users = await db.users.find(
            {"user_id": {"$in": user_ids}},
            {"_id": 0, "user_id": 1, "full_name": 1, "email": 1},
        ).to_list(len(user_ids))
        users_by_id = {u["user_id"]: u for u in users if u.get("user_id")}

    for o in orders:
        u = users_by_id.get(o.get("user_id"))
        if u:
            o["user_full_name"] = u.get("full_name")
            o["user_email"] = u.get("email")

    return {"orders": orders}

# Admin: Delete a single virtual card order (dangerous)
@api_router.delete("/admin/virtual-card-orders/{order_id}")
async def admin_delete_virtual_card_order(
    order_id: str,
    admin: dict = Depends(get_admin_user),
):
    order = await db.virtual_card_orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    result = await db.virtual_card_orders.delete_one({"order_id": order_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")

    await log_action(admin["user_id"], "virtual_card_order_delete", {"order_id": order_id, "user_id": order.get("user_id"), "status": order.get("status")})
    return {"message": "Order deleted", "order_id": order_id}

# Pydantic model for manual card creation
class ManualCardCreate(BaseModel):
    user_id: str
    client_id: str
    card_email: str
    card_brand: Optional[str] = None
    card_type: Optional[str] = "visa"
    card_holder_name: Optional[str] = None
    card_last4: Optional[str] = None
    card_expiry: Optional[str] = None
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

    settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
    default_card_bg = settings.get("card_background_image") if settings else None
    card_image = payload.card_image or default_card_bg
    
    # Create card order directly as approved
    order = {
        "order_id": str(uuid.uuid4()),
        "user_id": payload.user_id,
        "client_id": payload.client_id,
        "card_email": payload.card_email.lower(),
        "card_brand": payload.card_brand,
        "card_type": payload.card_type,
        "card_holder_name": payload.card_holder_name,
        # SECURITY: store only last4 (never store full PAN / CVV).
        "card_last4": payload.card_last4,
        "card_expiry": payload.card_expiry,
        "billing_address": payload.billing_address,
        "billing_city": payload.billing_city,
        "billing_country": payload.billing_country,
        "billing_zip": payload.billing_zip,
        "card_image": card_image,
        "fee": 0,  # No fee for manual creation
        "status": "approved",  # Already approved
        "card_status": "active",
        "failed_payment_count": 0,
        "spending_limit_usd": 500.0,
        "spending_limit_period": "monthly",
        "admin_notes": "Created manually by admin",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "processed_at": datetime.now(timezone.utc).isoformat(),
        "processed_by": admin["user_id"]
    }
    
    await db.virtual_card_orders.insert_one(order)
    
    # If user was referred, count this approved card toward affiliate milestones
    if user.get("referred_by"):
        await process_card_affiliate_reward(user["referred_by"])
    
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
    # Optional: if a Strowallet card was already created outside/earlier, admin can link it here
    # to avoid issuing a duplicate card during approval.
    provider_card_id: Optional[str] = None
    card_brand: Optional[str] = None  # Wise, Payoneer, etc.
    card_type: Optional[str] = None  # visa or mastercard
    card_holder_name: Optional[str] = None
    card_last4: Optional[str] = None
    card_expiry: Optional[str] = None
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

    settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
    default_card_bg = settings.get("card_background_image") if settings else None
    
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
        # If Strowallet is enabled and admin didn't manually enter card details,
        # create the card automatically and store the returned details.
        manual_details_provided = any([
            payload.card_last4,
            payload.card_expiry,
        ])

        auto_created = False
        # Strowallet-first mode: if enabled, issuing should be automatic (no manual card details required).
        # Manual details (card_number/cvv/etc) are ignored when Strowallet automation is enabled.
        if _strowallet_enabled(settings):
            user = await db.users.find_one({"user_id": order["user_id"]}, {"_id": 0})
            if not user:
                raise HTTPException(status_code=404, detail="User not found")

            cfg = _strowallet_config(settings)

            # If admin provided a provider_card_id, link it instead of creating a new card.
            provided_provider_card_id = (payload.provider_card_id or "").strip()
            if provided_provider_card_id:
                provider_card_id = provided_provider_card_id
                update_doc["provider"] = "strowallet"
                update_doc["provider_card_id"] = provider_card_id
                update_doc["provider_raw"] = {"linked": True}

                # Best-effort pull details from provider so customer dashboard has info.
                if cfg.get("fetch_detail_path"):
                    try:
                        stw_customer_id = user.get("strowallet_customer_id") or user.get("strowallet_user_id")
                        stw_detail = await _strowallet_fetch_detail_with_retry(
                            settings=settings,
                            cfg=cfg,
                            provider_card_id=str(provider_card_id),
                            stw_customer_id=stw_customer_id,
                            reference=f"detail-{order_id}",
                            attempts=4,
                        )
                        if stw_detail:
                            update_doc["provider_raw"] = _redact_sensitive_payload({"linked": True, "detail": stw_detail})

                        card_number = _extract_first(stw_detail, "data.card_number", "data.number", "card_number", "number", "data.card.number", "data.card.card_number")
                        card_expiry = _extract_first(stw_detail, "data.expiry", "data.expiry_date", "expiry", "expiry_date", "data.card.expiry", "data.card.expiry_date")
                        card_brand = _extract_first(stw_detail, "data.brand", "brand", "data.card.brand")
                        card_type = _extract_first(stw_detail, "data.type", "type", "data.card.type")
                        card_holder_name = _extract_first(stw_detail, "data.name_on_card", "data.card_name", "name_on_card", "card_name", "data.card.name_on_card")
                        card_balance = _extract_float_first(
                            stw_detail,
                            "data.balance",
                            "data.available_balance",
                            "data.availableBalance",
                            "balance",
                            "available_balance",
                            "availableBalance",
                            "data.card.balance",
                            "data.card.available_balance",
                            "data.card.availableBalance",
                        )
                        card_currency = _extract_first(stw_detail, "data.currency", "currency", "data.card.currency")

                        if cfg.get("brand_name"):
                            update_doc["card_brand"] = cfg["brand_name"]
                        elif card_brand:
                            update_doc["card_brand"] = str(card_brand)
                        else:
                            update_doc["card_brand"] = "Virtual Card"

                        if card_type:
                            update_doc["card_type"] = str(card_type).lower()
                        if card_holder_name:
                            update_doc["card_holder_name"] = str(card_holder_name)
                        elif user.get("full_name"):
                            update_doc["card_holder_name"] = str(user["full_name"]).upper()

                        if card_number:
                            card_number_str = str(card_number).replace(" ", "")
                            update_doc["card_last4"] = card_number_str[-4:]
                        if card_expiry:
                            update_doc["card_expiry"] = str(card_expiry)
                        if card_balance is not None:
                            update_doc["card_balance"] = float(card_balance)
                        if card_currency:
                            update_doc["card_currency"] = str(card_currency).upper()
                    except Exception as e:
                        # Don't block approval if detail fetch fails; linking still helps show the card.
                        update_doc["provider_raw"] = {"linked": True, "detail_error": str(e)}

            else:
                # Some Strowallet APIs require creating a user/customer first (ex: /api/bitvcard/create-user/).
                # We store the returned customer/user id on our user record to reuse it.
                stw_customer_id = user.get("strowallet_customer_id") or user.get("strowallet_user_id")
                if not stw_customer_id and cfg.get("create_user_path"):
                    # Prefer approved KYC for provider onboarding requirements.
                    kyc = await db.kyc.find_one(
                        {"user_id": user["user_id"], "status": "approved"},
                        {"_id": 0},
                    )
                    if not kyc:
                        raise HTTPException(
                            status_code=400,
                            detail="User KYC must be approved before creating a Strowallet customer.",
                        )
                    stw_customer_id = await _strowallet_create_customer_id(
                        settings=settings,
                        cfg=cfg,
                        user=user,
                        # Use the user's actual email for provider customer identity (avoid collisions with card_email).
                        customer_email=(user.get("email") or ""),
                        kyc=kyc,
                    )
                    if stw_customer_id:
                        await db.users.update_one(
                            {"user_id": user["user_id"]},
                            {"$set": {"strowallet_customer_id": stw_customer_id}},
                        )

                # If customer id is still missing, continue best-effort.
                # Many Strowallet create-card setups accept customerEmail only.

                create_payload: Dict[str, Any] = {
                    # Common fields across many Strowallet deployments (best-effort).
                    "email": order.get("card_email") or user.get("email"),
                    "card_email": order.get("card_email") or user.get("email"),
                    # Strowallet bitvcard schema (per docs)
                    "customerEmail": order.get("card_email") or user.get("email"),
                    "name_on_card": (user.get("full_name") or "").upper(),
                    "card_type": (order.get("card_type") or "visa"),
                    "amount": str(cfg.get("create_card_amount_usd") or 5),
                    "full_name": user.get("full_name"),
                    "name": user.get("full_name"),
                    "phone": user.get("phone"),
                    "phone_number": user.get("phone"),
                    "reference": order_id,
                    "customer_reference": user.get("user_id"),
                }
                if stw_customer_id:
                    # Try common keys used by Strowallet deployments
                    create_payload["customer_id"] = stw_customer_id
                    create_payload["user_id"] = stw_customer_id
                    create_payload["card_user_id"] = stw_customer_id

                # Provide common aliases for provider schemas
                create_payload = _with_aliases(create_payload, "phone", "mobile", "msisdn")
                create_payload = _with_aliases(create_payload, "customerEmail", "customer_email", "customeremail")

                # Remove empty values to avoid API rejections.
                create_payload = {k: v for k, v in create_payload.items() if v not in (None, "")}

                # Strowallet bitvcard LIVE does NOT support a `mode` field.
                # Environment is inferred from the LIVE keys + LIVE endpoint URL.
                stw_resp = await _strowallet_post(settings, cfg["create_path"], create_payload)
                auto_created = True

                provider_card_id = _extract_first(
                    stw_resp,
                    "data.card.card_id",
                    "data.card_id",
                    "data.cardId",
                    "data.id",
                    "data.card.cardId",
                    "card_id",
                    "id",
                    "data.card.id",
                )

                # Persist provider metadata immediately so we don't lose it if a follow-up call fails.
                update_doc["provider"] = "strowallet"
                update_doc["provider_card_id"] = str(provider_card_id) if provider_card_id else None
                update_doc["provider_raw"] = _redact_sensitive_payload({"create": stw_resp})

                # If a fetch-card-detail endpoint is configured, use it to get full card details.
                # IMPORTANT: do not fail the approval flow if detail fetch fails; card might already be created.
                stw_detail = None
                stw_detail_error: Optional[str] = None
                if provider_card_id and cfg.get("fetch_detail_path"):
                    try:
                        stw_detail = await _strowallet_fetch_detail_with_retry(
                            settings=settings,
                            cfg=cfg,
                            provider_card_id=str(provider_card_id),
                            stw_customer_id=stw_customer_id,
                            reference=f"detail-{order_id}",
                            attempts=4,
                        )
                        if stw_detail:
                            update_doc["provider_raw"] = _redact_sensitive_payload({"create": stw_resp, "detail": stw_detail})
                    except Exception as e:
                        stw_detail_error = str(e)
                        update_doc["provider_raw"] = _redact_sensitive_payload({"create": stw_resp, "detail_error": stw_detail_error})

                src = stw_detail or stw_resp
                card_number = _extract_first(src, "data.card_number", "data.number", "card_number", "number", "data.card.number", "data.card.card_number")
                card_expiry = _extract_first(src, "data.expiry", "data.expiry_date", "expiry", "expiry_date", "data.card.expiry", "data.card.expiry_date")
                card_brand = _extract_first(src, "data.brand", "brand", "data.card.brand")
                card_type = _extract_first(src, "data.type", "type", "data.card.type")
                card_holder_name = _extract_first(src, "data.name_on_card", "data.card_name", "name_on_card", "card_name", "data.card.name_on_card")
                card_balance = _extract_float_first(
                    src,
                    "data.balance",
                    "data.available_balance",
                    "data.availableBalance",
                    "balance",
                    "available_balance",
                    "availableBalance",
                    "data.card.balance",
                    "data.card.available_balance",
                    "data.card.availableBalance",
                )
                card_currency = _extract_first(src, "data.currency", "currency", "data.card.currency")

                # If we couldn't extract provider_card_id, annotate admin notes for follow-up.
                if not provider_card_id:
                    update_doc["admin_notes"] = (
                        (payload.admin_notes or "")
                        + ("\n" if payload.admin_notes else "")
                        + "WARN: Strowallet card created but provider_card_id could not be extracted from response."
                    )

                # White-label: prefer configured brand name for UI display.
                if cfg.get("brand_name"):
                    update_doc["card_brand"] = cfg["brand_name"]
                elif card_brand:
                    update_doc["card_brand"] = str(card_brand)
                else:
                    update_doc["card_brand"] = "Virtual Card"

                if card_type:
                    update_doc["card_type"] = str(card_type).lower()

                if card_holder_name:
                    update_doc["card_holder_name"] = str(card_holder_name)
                elif user.get("full_name"):
                    update_doc["card_holder_name"] = str(user["full_name"]).upper()

                if card_number:
                    card_number_str = str(card_number).replace(" ", "")
                    update_doc["card_last4"] = card_number_str[-4:]
                if card_expiry:
                    update_doc["card_expiry"] = str(card_expiry)
                if card_balance is not None:
                    update_doc["card_balance"] = float(card_balance)
                if card_currency:
                    update_doc["card_currency"] = str(card_currency).upper()

        # Manual entry is only honored when Strowallet automation is NOT enabled.
        if not _strowallet_enabled(settings):
            if payload.card_brand:
                update_doc["card_brand"] = payload.card_brand
            if payload.card_type:
                update_doc["card_type"] = payload.card_type
            if payload.card_holder_name:
                update_doc["card_holder_name"] = payload.card_holder_name
            if payload.card_last4:
                update_doc["card_last4"] = payload.card_last4
            if payload.card_expiry:
                update_doc["card_expiry"] = payload.card_expiry
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
        elif not order.get("card_image") and default_card_bg:
            update_doc["card_image"] = default_card_bg

        # Card controls defaults (white-label policy)
        update_doc["card_status"] = "active"
        update_doc["failed_payment_count"] = int(order.get("failed_payment_count", 0) or 0)
        update_doc["spending_limit_usd"] = float(order.get("spending_limit_usd", 500.0) or 500.0)
        update_doc["spending_limit_period"] = str(order.get("spending_limit_period", "monthly") or "monthly")
    
    await db.virtual_card_orders.update_one(
        {"order_id": order_id},
        {"$set": update_doc}
    )
    
    if action == "approve":
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
            <p><strong>Brand:</strong> {update_doc.get('card_brand') or order.get('card_brand') or 'N/A'}</p>
            <p><strong>Type:</strong> {update_doc.get('card_type') or order.get('card_type') or 'N/A'}</p>
            <p><strong>Last 4:</strong> {update_doc.get('card_last4') or order.get('card_last4') or 'N/A'}</p>
            <p><strong>Expiry:</strong> {update_doc.get('card_expiry') or order.get('card_expiry') or 'N/A'}</p>
            <p>Order ID: <code>{order_id}</code></p>
            <p>You can now use your virtual card for transactions.</p>
            <p><em>Security note:</em> for your protection, we do not display full card number/CVV in the app.</p>
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
    """Process affiliate reward: configurable HTG reward for every N referrals who get a card approved."""
    referrer = await db.users.find_one({"affiliate_code": affiliate_code}, {"_id": 0})
    if not referrer:
        return

    settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
    cards_required = int(settings.get("affiliate_cards_required", 5)) if settings else 5
    reward_htg = int(settings.get("affiliate_reward_htg", 2000)) if settings else 2000
    if cards_required <= 0 or reward_htg <= 0:
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
    
    # Check if we've hit a new milestone of N
    rewarded_count = referrer.get("affiliate_cards_rewarded", 0)
    new_rewards = (cards_count // cards_required) - rewarded_count
    
    if new_rewards > 0:
        reward_amount = new_rewards * reward_htg  # HTG per milestone
        
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
            "description": f"Affiliate reward for {new_rewards * cards_required} approved referral cards",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        await log_action(referrer["user_id"], "affiliate_card_reward", {"amount": reward_amount})

# ==================== TOP-UP (International Minutes) ROUTES ====================

@api_router.post("/topup/order")
async def create_topup_order(request: TopUpOrder, current_user: dict = Depends(get_current_user)):
    """Create a manual top-up order for international minutes"""
    if current_user["kyc_status"] != "approved":
        raise HTTPException(status_code=403, detail="KYC verification required")
    
    # New flow: amount is required. Legacy clients may still send price.
    amount = request.amount if request.amount is not None else request.price
    if amount is None:
        raise HTTPException(status_code=400, detail="Amount is required")
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")

    # Fee tiers configured in admin settings
    settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
    tiers = settings.get("topup_fee_tiers", []) if settings else []
    fee = calculate_tiered_fee(amount, tiers)
    total = round(float(amount) + float(fee), 2)

    if current_user.get("wallet_usd", 0) < total:
        raise HTTPException(status_code=400, detail="Insufficient USD balance")
    
    # Deduct from wallet
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$inc": {"wallet_usd": -total}}
    )
    
    # Create order
    order = {
        "order_id": str(uuid.uuid4()),
        "user_id": current_user["user_id"],
        "client_id": current_user["client_id"],
        "country": request.country,
        "country_name": request.country_name,
        # Legacy fields (kept if provided)
        "minutes": request.minutes,
        "price": request.price,
        # New fields
        "amount": float(amount),
        "fee": float(fee),
        "total": float(total),
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
        "amount": -total,
        "currency": "USD",
        "status": "pending",
        "description": f"Top-up order: ${float(amount):.2f} for {request.country_name} (fee ${float(fee):.2f})",
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

# Admin: Purge old virtual card orders (dangerous)
@api_router.post("/admin/virtual-card-orders/purge")
async def admin_purge_virtual_card_orders(
    days: int = Query(default=30, ge=1, le=3650),
    status: Optional[str] = None,
    provider: Optional[str] = Query(default=None, description="Filter by provider: 'strowallet' or 'manual'"),
    admin: dict = Depends(get_admin_user),
):
    """
    Permanently deletes virtual card orders older than N days.
    Use with caution.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    query: Dict[str, Any] = {"created_at": {"$lt": cutoff.isoformat()}}
    if status:
        query["status"] = status
    if provider:
        p = str(provider).strip().lower()
        if p == "strowallet":
            query["provider"] = "strowallet"
        elif p == "manual":
            # manual = anything not issued by Strowallet (including missing provider field)
            query["provider"] = {"$ne": "strowallet"}
        else:
            raise HTTPException(status_code=400, detail="Invalid provider filter. Use 'strowallet' or 'manual'.")

    result = await db.virtual_card_orders.delete_many(query)
    await log_action(admin["user_id"], "virtual_card_orders_purge", {"days": days, "status": status, "provider": provider, "deleted": result.deleted_count})
    return {"deleted": result.deleted_count, "days": days, "status": status, "provider": provider}

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
        refund_total = float(order.get("total") or order.get("price") or 0)
        await db.users.update_one(
            {"user_id": order["user_id"]},
            {"$inc": {"wallet_usd": refund_total}}
        )
        
        await db.transactions.insert_one({
            "transaction_id": str(uuid.uuid4()),
            "user_id": order["user_id"],
            "type": "topup_refund",
            "amount": refund_total,
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

    # Notify admins (email + telegram)
    try:
        await notify_admin(
            subject="KAYICOM - New Agent Deposit Request",
            html=f"""
            <h2>New Agent Deposit Request</h2>
            <p><strong>Agent:</strong> {current_user.get('full_name','')} ({current_user.get('client_id','')})</p>
            <p><strong>Client:</strong> {client.get('full_name','')} ({client.get('client_id','')})</p>
            <p><strong>Amount USD:</strong> {request.amount_usd}</p>
            <p><strong>HTG Received:</strong> {request.amount_htg_received}</p>
            <p><strong>Commission:</strong> ${agent_deposit.get('commission_usd',0):.2f}</p>
            <p>Deposit ID: <code>{agent_deposit['deposit_id']}</code></p>
            """,
            telegram_message=(
                f"🧾 <b>New Agent Deposit</b>\n"
                f"Agent: <b>{current_user.get('full_name','')}</b> ({current_user.get('client_id','')})\n"
                f"Client: <b>{client.get('full_name','')}</b> ({client.get('client_id','')})\n"
                f"USD: <b>${request.amount_usd}</b> | HTG: <b>G {request.amount_htg_received}</b>\n"
                f"Commission: <b>${agent_deposit.get('commission_usd',0):.2f}</b>\n"
                f"ID: <code>{agent_deposit['deposit_id']}</code>"
            ),
        )
    except Exception as e:
        logger.error(f"Failed to notify admins for agent deposit: {e}")
    
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
    """
    Deprecated: previously transferred commission to main wallet.
    Now commissions must be withdrawn from the Agent space via payout methods.
    """
    raise HTTPException(status_code=400, detail="Use commission payout in Agent space")


@api_router.get("/agent/payout-profile")
async def agent_get_payout_profile(current_user: dict = Depends(get_agent_user)):
    profile = current_user.get("agent_payout_profile") or {}
    return {
        "full_name": current_user.get("full_name"),
        "payment_method_id": profile.get("payment_method_id"),
        "field_values": profile.get("field_values") or {},
    }


@api_router.put("/agent/payout-profile")
async def agent_update_payout_profile(payload: AgentPayoutProfileUpdate, current_user: dict = Depends(get_agent_user)):
    method = await db.payment_gateway_methods.find_one(
        {"payment_method_id": payload.payment_method_id, "payment_type": "withdrawal", "status": "active"},
        {"_id": 0},
    )
    if not method:
        raise HTTPException(status_code=400, detail="Selected withdrawal method is not available")
    if "USD" not in (method.get("supported_currencies") or []):
        raise HTTPException(status_code=400, detail="Selected withdrawal method does not support USD")

    submitted = payload.field_values or {}
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

    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$set": {"agent_payout_profile": {"payment_method_id": payload.payment_method_id, "field_values": submitted}}},
    )
    await log_action(current_user["user_id"], "agent_payout_profile_update", {"payment_method_id": payload.payment_method_id})
    return {"message": "Payout profile saved"}


@api_router.get("/agent/commission-withdrawals")
async def agent_get_commission_withdrawals(current_user: dict = Depends(get_agent_user)):
    items = await db.agent_commission_withdrawals.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0},
    ).sort("created_at", -1).to_list(100)
    return {"withdrawals": items}


@api_router.post("/agent/commission-withdrawals")
async def agent_create_commission_withdrawal(payload: AgentCommissionWithdrawalCreate, current_user: dict = Depends(get_agent_user)):
    amount = float(payload.amount or 0)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")

    agent_balance = float(current_user.get("agent_wallet_usd", 0) or 0)
    if amount > agent_balance:
        raise HTTPException(status_code=400, detail="Insufficient agent commission balance")

    method = await db.payment_gateway_methods.find_one(
        {"payment_method_id": payload.payment_method_id, "payment_type": "withdrawal", "status": "active"},
        {"_id": 0},
    )
    if not method:
        raise HTTPException(status_code=400, detail="Selected withdrawal method is not available")
    if "USD" not in (method.get("supported_currencies") or []):
        raise HTTPException(status_code=400, detail="Selected withdrawal method does not support USD")

    submitted = payload.field_values or {}
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
    fee = (amount * (fee_value / 100.0)) if fee_type == "percentage" else fee_value
    fee = max(0.0, float(fee))
    if fee >= amount:
        raise HTTPException(status_code=400, detail="Fee is greater than or equal to amount")
    net_amount = max(0.0, float(amount - fee))

    withdrawal_id = str(uuid.uuid4())
    doc = {
        "withdrawal_id": withdrawal_id,
        "user_id": current_user["user_id"],
        "client_id": current_user["client_id"],
        "full_name": current_user.get("full_name"),
        "currency": "USD",
        "amount": amount,
        "fee": fee,
        "net_amount": net_amount,
        "payment_method_id": payload.payment_method_id,
        "payment_method_name": method.get("payment_method_name"),
        "payment_method_snapshot": {
            "payment_method_id": method.get("payment_method_id"),
            "payment_method_name": method.get("payment_method_name"),
            "payment_type": "withdrawal",
            "fee_type": fee_type,
            "fee_value": fee_value,
            "supported_currencies": method.get("supported_currencies", []),
        },
        "field_values": submitted,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "processed_at": None,
        "processed_by": None,
        "admin_notes": None,
    }

    # Lock funds by deducting from agent wallet immediately
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$inc": {"agent_wallet_usd": -amount}},
    )
    await db.agent_commission_withdrawals.insert_one(doc)

    await db.transactions.insert_one({
        "transaction_id": str(uuid.uuid4()),
        "user_id": current_user["user_id"],
        "type": "agent_commission_payout_request",
        "amount": -amount,
        "currency": "USD",
        "status": "pending",
        "description": f"Agent commission payout request via {method.get('payment_method_name')}",
        "reference_id": withdrawal_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    await log_action(current_user["user_id"], "agent_commission_payout_request", {"withdrawal_id": withdrawal_id, "amount": amount})

    # Notify admins (email + telegram)
    try:
        await notify_admin(
            subject="KAYICOM - New Agent Commission Withdrawal",
            html=f"""
            <h2>New Agent Commission Withdrawal</h2>
            <p><strong>Agent:</strong> {current_user.get('full_name','')} ({current_user.get('client_id','')})</p>
            <p><strong>Amount:</strong> ${amount:.2f} USD</p>
            <p><strong>Fee:</strong> ${fee:.2f} USD</p>
            <p><strong>Net:</strong> ${net_amount:.2f} USD</p>
            <p><strong>Method:</strong> {method.get('payment_method_name')}</p>
            <p>Withdrawal ID: <code>{withdrawal_id}</code></p>
            """,
            telegram_message=(
                f"💸 <b>Agent Commission Withdrawal</b>\n"
                f"Agent: <b>{current_user.get('full_name','')}</b> ({current_user.get('client_id','')})\n"
                f"Amount: <b>${amount:.2f}</b> | Fee: <b>${fee:.2f}</b> | Net: <b>${net_amount:.2f}</b>\n"
                f"Method: <b>{method.get('payment_method_name')}</b>\n"
                f"ID: <code>{withdrawal_id}</code>"
            ),
        )
    except Exception as e:
        logger.error(f"Failed to notify admins for agent commission withdrawal: {e}")
    return {"withdrawal": doc}


@api_router.get("/admin/agent-commission-withdrawals")
async def admin_get_agent_commission_withdrawals(
    status: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    admin: dict = Depends(get_admin_user),
):
    query: Dict[str, Any] = {}
    if status:
        query["status"] = status
    items = await db.agent_commission_withdrawals.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"withdrawals": items}


@api_router.patch("/admin/agent-commission-withdrawals/{withdrawal_id}")
async def admin_process_agent_commission_withdrawal(
    withdrawal_id: str,
    action: str,
    admin_notes: Optional[str] = None,
    admin: dict = Depends(get_admin_user),
):
    w = await db.agent_commission_withdrawals.find_one({"withdrawal_id": withdrawal_id}, {"_id": 0})
    if not w:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    if w.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Already processed")
    if action not in ["approve", "reject"]:
        raise HTTPException(status_code=400, detail="Invalid action")

    new_status = "approved" if action == "approve" else "rejected"
    await db.agent_commission_withdrawals.update_one(
        {"withdrawal_id": withdrawal_id},
        {"$set": {
            "status": new_status,
            "admin_notes": admin_notes,
            "processed_at": datetime.now(timezone.utc).isoformat(),
            "processed_by": admin["user_id"],
        }},
    )

    await db.transactions.update_one(
        {"reference_id": withdrawal_id, "type": "agent_commission_payout_request"},
        {"$set": {"status": new_status}},
    )

    if action == "reject":
        # Refund locked amount back to agent wallet
        await db.users.update_one(
            {"user_id": w["user_id"]},
            {"$inc": {"agent_wallet_usd": float(w.get("amount") or 0)}},
        )
        await db.transactions.insert_one({
            "transaction_id": str(uuid.uuid4()),
            "user_id": w["user_id"],
            "type": "agent_commission_payout_refund",
            "amount": float(w.get("amount") or 0),
            "currency": "USD",
            "status": "completed",
            "description": "Agent commission payout request refund (rejected)",
            "reference_id": withdrawal_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    await log_action(admin["user_id"], "agent_commission_payout_process", {"withdrawal_id": withdrawal_id, "action": action})
    return {"message": f"Commission withdrawal {action}d"}

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
    page: int = Query(default=1, ge=1),
    q: Optional[str] = None,
    admin: dict = Depends(get_admin_user)
):
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
            "date_of_birth": 1,
            "full_address": 1,
            "city": 1,
            "state": 1,
            "country": 1,
            "nationality": 1,
            "id_type": 1,
            "phone_number": 1,
            "whatsapp_number": 1,
            "submitted_at": 1,
            "status": 1,
        },
    ).sort("submitted_at", -1).skip(skip).limit(limit).to_list(limit)

    # Enrich with user email (email isn't stored in KYC doc historically).
    user_ids = list({s.get("user_id") for s in submissions if s.get("user_id")})
    users_by_id: Dict[str, Dict[str, Any]] = {}
    if user_ids:
        users = await db.users.find(
            {"user_id": {"$in": user_ids}},
            {"_id": 0, "user_id": 1, "email": 1},
        ).to_list(len(user_ids))
        users_by_id = {u["user_id"]: u for u in users if u.get("user_id")}
    for s in submissions:
        u = users_by_id.get(s.get("user_id"))
        if u:
            s["user_email"] = u.get("email")
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
    kyc = await db.kyc.find_one({"kyc_id": kyc_id}, {"_id": 0})
    if not kyc:
        raise HTTPException(status_code=404, detail="KYC submission not found")
    # Enrich detail with user email (useful for admins).
    user = await db.users.find_one({"user_id": kyc.get("user_id")}, {"_id": 0, "email": 1})
    if user and user.get("email"):
        kyc["user_email"] = user["email"]
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
    
    # Update user with KYC status and contact details if available
    user_update = {"kyc_status": new_status}
    if action == "approve":
        if kyc.get("whatsapp_number"):
            user_update["whatsapp_number"] = kyc.get("whatsapp_number")
        # Keep a normalized phone on the user record (used by providers like Strowallet).
        if kyc.get("phone_number"):
            user_update["phone"] = kyc.get("phone_number")
    
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


class KYCReopenRequest(BaseModel):
    reason: Optional[str] = None


@api_router.post("/admin/kyc/{kyc_id}/reopen")
async def admin_reopen_kyc(
    kyc_id: str,
    payload: KYCReopenRequest,
    admin: dict = Depends(get_admin_user),
):
    """
    Re-open a KYC submission (set back to pending) so the user can resubmit.
    Useful when an approved KYC was incorrect and must be redone.
    """
    kyc = await db.kyc.find_one({"kyc_id": kyc_id}, {"_id": 0})
    if not kyc:
        raise HTTPException(status_code=404, detail="KYC submission not found")

    prev_status = str(kyc.get("status") or "pending")
    update_doc: Dict[str, Any] = {
        "status": "pending",
        "reviewed_at": None,
        "reviewed_by": None,
        "rejection_reason": None,
        "reopened_at": datetime.now(timezone.utc).isoformat(),
        "reopened_by": admin["user_id"],
        "reopened_from": prev_status,
        "reopened_reason": (payload.reason or "").strip() or None,
    }
    await db.kyc.update_one({"kyc_id": kyc_id}, {"$set": update_doc})
    await db.users.update_one({"user_id": kyc["user_id"]}, {"$set": {"kyc_status": "pending"}})
    await log_action(admin["user_id"], "kyc_reopen", {"kyc_id": kyc_id, "from": prev_status})

    # Optional: notify user (best-effort)
    try:
        user = await db.users.find_one({"user_id": kyc["user_id"]}, {"_id": 0, "email": 1, "full_name": 1})
        if user and user.get("email"):
            subject = "KAYICOM - KYC Re-opened"
            content = f"""
            <h2>KYC Re-opened</h2>
            <p>Hello {user.get('full_name', 'User')},</p>
            <p>Your KYC verification has been re-opened and is now pending. Please resubmit your KYC with the correct information.</p>
            {'<p><strong>Reason:</strong> ' + str(update_doc.get('reopened_reason')) + '</p>' if update_doc.get('reopened_reason') else ''}
            """
            await send_email(user["email"], subject, content)
    except Exception:
        # Do not block the admin action if email fails.
        pass

    return {"message": "KYC reopened", "kyc_id": kyc_id, "status": "pending"}


@api_router.post("/admin/kyc/migrate-images")
async def admin_migrate_kyc_images(
    limit: int = Query(default=25, le=100),
    dry_run: bool = Query(default=True),
    status: Optional[str] = None,
    admin: dict = Depends(get_admin_user),
):
    """
    Batch-migrate legacy base64 KYC images (data URLs) to Cloudinary URLs.
    Safe by default (dry_run=true). Run multiple times in small batches.
    """
    settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
    if not _cloudinary_is_configured(settings):
        raise HTTPException(status_code=400, detail="Cloudinary is not configured (set in Admin Settings or CLOUDINARY_* env vars)")

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
                stored = await _kyc_store_image_value(val, user_id=user_id, kyc_id=kyc_id, field_name=field_name, settings=settings)
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


@api_router.get("/admin/kyc-image-storage-status")
async def admin_kyc_image_storage_status(admin: dict = Depends(get_admin_user)):
    settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
    c = _cloudinary_creds(settings)
    source = "none"
    if settings and any((settings.get("cloudinary_cloud_name"), settings.get("cloudinary_api_key"), settings.get("cloudinary_api_secret"))):
        source = "settings"
    elif any((os.environ.get("CLOUDINARY_CLOUD_NAME"), os.environ.get("CLOUDINARY_API_KEY"), os.environ.get("CLOUDINARY_API_SECRET"))):
        source = "env"
    return {
        "cloudinary_configured": _cloudinary_is_configured(settings),
        "source": source,
        "cloudinary_folder": c.get("folder"),
        "kyc_max_image_bytes": int((settings or {}).get("kyc_max_image_bytes") or os.environ.get("KYC_MAX_IMAGE_BYTES") or 5242880),
    }

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
            <p>Fee: <strong>{deposit.get('fee', 0)} {deposit['currency']}</strong> | Total paid: <strong>{deposit.get('total_amount', (deposit.get('amount', 0) or 0) + (deposit.get('fee', 0) or 0))} {deposit['currency']}</strong></p>
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
            <p>Fee: <strong>{withdrawal.get('fee', 0)} {withdrawal['currency']}</strong> | Total deducted: <strong>{withdrawal.get('total_amount', (withdrawal.get('amount', 0) or 0) + (withdrawal.get('fee', 0) or 0))} {withdrawal['currency']}</strong></p>
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

    # use_card_fee_tiers is only applicable to withdrawals; ignore for deposits.
    if method.payment_type != "withdrawal" and getattr(method, "use_card_fee_tiers", False):
        raise HTTPException(status_code=400, detail="use_card_fee_tiers can only be enabled for withdrawal methods")

    if method.integration and method.integration.provider == "plisio":
        if method.payment_type != "deposit":
            raise HTTPException(status_code=400, detail="Plisio integration is only supported for deposit methods")
        # Plisio is used for crypto deposits; typically USD-only.
        if "USD" not in (method.supported_currencies or []):
            raise HTTPException(status_code=400, detail="Plisio deposit methods must support USD currency")


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

@api_router.get("/admin/team")
async def admin_get_team(admin: dict = Depends(get_admin_user)):
    """List admin/team users."""
    team = await db.users.find(
        {"is_admin": True},
        {"_id": 0, "user_id": 1, "client_id": 1, "full_name": 1, "email": 1, "phone": 1, "is_active": 1, "created_at": 1, "admin_role": 1},
    ).sort("created_at", -1).to_list(200)
    return {"team": team}


@api_router.post("/admin/team")
async def admin_create_team_member(payload: TeamMemberCreate, admin: dict = Depends(get_admin_user)):
    """Create an admin/team member user."""
    existing = await db.users.find_one({"email": payload.email.lower()}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_id = str(uuid.uuid4())
    client_id = generate_client_id()

    user_doc = {
        "user_id": user_id,
        "client_id": client_id,
        "email": payload.email.lower(),
        "password_hash": hash_password(payload.password),
        "full_name": payload.full_name,
        "phone": payload.phone,
        "language": "fr",
        "kyc_status": "approved",
        "wallet_htg": 0.0,
        "wallet_usd": 0.0,
        "affiliate_code": generate_affiliate_code(),
        "affiliate_earnings": 0.0,
        "referred_by": None,
        "is_active": True,
        "is_admin": True,
        "admin_role": (payload.role or "admin"),
        "two_factor_enabled": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.users.insert_one(user_doc)
    await log_action(admin["user_id"], "team_create", {"user_id": user_id, "email": user_doc["email"], "role": user_doc["admin_role"]})

    # Don't return password hash
    user_doc.pop("password_hash", None)
    if "_id" in user_doc:
        del user_doc["_id"]
    return {"member": user_doc}


@api_router.patch("/admin/team/{user_id}")
async def admin_update_team_member(user_id: str, payload: TeamMemberUpdate, admin: dict = Depends(get_admin_user)):
    """Activate/deactivate a team member."""
    target = await db.users.find_one({"user_id": user_id, "is_admin": True}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Team member not found")

    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"is_active": payload.is_active}},
    )
    await log_action(admin["user_id"], "team_update", {"user_id": user_id, "is_active": payload.is_active})
    return {"message": "Team member updated"}


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
    defaults = {
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
        "strowallet_enabled": False,
        "strowallet_base_url": os.environ.get("STROWALLET_BASE_URL", "") or "https://strowallet.com",
        "strowallet_api_key": "",
        "strowallet_api_secret": "",
        "strowallet_create_user_path": os.environ.get("STROWALLET_CREATE_USER_PATH", "") or "/api/bitvcard/create-user/",
        "strowallet_create_card_path": os.environ.get("STROWALLET_CREATE_CARD_PATH", "") or "/api/bitvcard/create-card/",
        "strowallet_fund_card_path": os.environ.get("STROWALLET_FUND_CARD_PATH", "") or "/api/bitvcard/fund-card/",
        "strowallet_withdraw_card_path": os.environ.get("STROWALLET_WITHDRAW_CARD_PATH", "") or "",
        "strowallet_fetch_card_detail_path": os.environ.get("STROWALLET_FETCH_CARD_DETAIL_PATH", "") or "/api/bitvcard/fetch-card-detail/",
        "strowallet_card_transactions_path": os.environ.get("STROWALLET_CARD_TRANSACTIONS_PATH", "") or "/api/bitvcard/card-transactions/",
        "strowallet_brand_name": os.environ.get("STROWALLET_BRAND_NAME", "") or "KAYICOM",
        "strowallet_mode": os.environ.get("STROWALLET_MODE", "") or "live",
        "strowallet_create_card_amount_usd": float(os.environ.get("STROWALLET_CREATE_CARD_AMOUNT_USD", "5") or "5"),
        "strowallet_set_limit_path": os.environ.get("STROWALLET_SET_LIMIT_PATH", ""),
        "strowallet_freeze_card_path": os.environ.get("STROWALLET_FREEZE_CARD_PATH", ""),
        "strowallet_unfreeze_card_path": os.environ.get("STROWALLET_UNFREEZE_CARD_PATH", ""),
        "strowallet_freeze_unfreeze_path": os.environ.get("STROWALLET_FREEZE_UNFREEZE_PATH", ""),
        "strowallet_full_card_history_path": os.environ.get("STROWALLET_FULL_CARD_HISTORY_PATH", ""),
        "strowallet_withdraw_status_path": os.environ.get("STROWALLET_WITHDRAW_STATUS_PATH", ""),
        "strowallet_upgrade_limit_path": os.environ.get("STROWALLET_UPGRADE_LIMIT_PATH", ""),
        "telegram_enabled": False,
        "telegram_bot_token": "",
        "telegram_chat_id": "",
        "card_order_fee_htg": 500,
        "affiliate_reward_htg": 2000,
        "affiliate_cards_required": 5,
        "card_background_image": None,
        "topup_fee_tiers": [],
        "announcement_enabled": False,
        "announcement_text_ht": None,
        "announcement_text_fr": None,
        "announcement_text_en": None,
        "announcement_link": None,

        # KYC image storage (recommended)
        "cloudinary_cloud_name": os.environ.get("CLOUDINARY_CLOUD_NAME", "") or "",
        "cloudinary_api_key": "",
        "cloudinary_api_secret": "",
        "cloudinary_folder": os.environ.get("CLOUDINARY_FOLDER", "") or "kayicom/kyc",
        "kyc_max_image_bytes": int(os.environ.get("KYC_MAX_IMAGE_BYTES", "5242880") or "5242880"),
    }

    # If settings exist already, non-destructively backfill any new keys.
    if settings:
        for k, v in defaults.items():
            if k not in settings:
                settings[k] = v
    else:
        settings = defaults

    # SECURITY: never return raw Strowallet secrets to the browser (even in admin UI).
    # Admin can still UPDATE them via PUT /admin/settings, but GET will only show masked hints.
    try:
        cfg = _strowallet_config(settings)
        settings["strowallet_api_key_masked"] = _mask_secret(cfg.get("api_key"))
        settings["strowallet_api_secret_masked"] = _mask_secret(cfg.get("api_secret"))
        settings["strowallet_has_keys"] = bool(cfg.get("api_key") and cfg.get("api_secret"))
    except Exception:
        settings["strowallet_api_key_masked"] = ""
        settings["strowallet_api_secret_masked"] = ""
        settings["strowallet_has_keys"] = False

    settings["strowallet_api_key"] = ""
    settings["strowallet_api_secret"] = ""
    return {"settings": settings}


async def _strowallet_probe(
    settings: Optional[dict],
    path: str,
    payload: Optional[Dict[str, Any]] = None,
    *,
    method: str = "POST",
) -> Dict[str, Any]:
    """
    Send a raw probe request to Strowallet and return status + body (no secrets).
    We intentionally do NOT raise on 4xx so admin can see if it's auth/path/payload.
    """
    cfg = _strowallet_config(settings)
    url = f"{cfg['base_url'].rstrip('/')}{path}"
    headers = {
        "Authorization": f"Bearer {cfg['api_key']}" if cfg.get("api_key") else "",
        "X-API-Key": cfg.get("api_key", ""),
        "x-api-key": cfg.get("api_key", ""),
        "api-key": cfg.get("api_key", ""),
        "public_key": cfg.get("api_key", ""),
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    if cfg.get("api_secret"):
        headers["X-API-Secret"] = cfg["api_secret"]
        headers["x-api-secret"] = cfg["api_secret"]
        headers["api-secret"] = cfg["api_secret"]
        headers["secret_key"] = cfg["api_secret"]

    async with httpx.AsyncClient(timeout=httpx.Timeout(20.0)) as client:
        try:
            m = (method or "POST").strip().upper()
            if m == "GET":
                # Never send secrets in querystring for probes.
                resp = await client.get(url, headers=headers)
            elif m == "HEAD":
                resp = await client.head(url, headers=headers)
            else:
                resp = await client.post(url, json=(payload or {}), headers=headers)
            try:
                body: Any = resp.json()
            except Exception:
                body = {"raw": (resp.text or "")[:3000]}
            return {"url": url, "method": m, "status_code": resp.status_code, "body": body}
        except Exception as e:
            return {"url": url, "method": (method or "POST").strip().upper(), "status_code": None, "error": str(e)}


@api_router.get("/admin/strowallet/diagnostics")
async def admin_strowallet_diagnostics(admin: dict = Depends(get_admin_user)):
    """
    Diagnostics endpoint to validate Strowallet connectivity/config.
    It performs non-destructive probes that should NOT create cards/users:
    it sends intentionally incomplete payloads and returns the response codes.
    """
    settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
    cfg = _strowallet_config(settings)

    # Config summary (redacted)
    summary = {
        "enabled": _strowallet_enabled(settings),
        "base_url": cfg.get("base_url"),
        "has_api_key": bool(cfg.get("api_key")),
        "has_api_secret": bool(cfg.get("api_secret")),
        "brand_name": cfg.get("brand_name"),
        "paths": {
            "create_user_path": cfg.get("create_user_path"),
            "create_card_path": cfg.get("create_path"),
            "fund_card_path": cfg.get("fund_path"),
            "fetch_detail_path": cfg.get("fetch_detail_path"),
        },
    }

    # If disabled, don't probe.
    if not _strowallet_enabled(settings):
        return {"summary": summary, "probes": [], "note": "Strowallet is disabled in settings."}

    probes = []
    # Probe with auth-only payload to avoid creating resources, but still validate auth mechanism.
    auth_only: Dict[str, Any] = {}
    if cfg.get("api_key"):
        auth_only["public_key"] = cfg["api_key"]
    if cfg.get("api_secret"):
        auth_only["secret_key"] = cfg["api_secret"]

    # Probe create-user/customer endpoint (should return 400/422 if reachable+authed; 401/403 if auth; 404 if path)
    if cfg.get("create_user_path"):
        create_user_post = await _strowallet_probe(settings, cfg["create_user_path"], dict(auth_only), method="POST")
        probes.append({"name": "create_user_probe", "result": create_user_post})
        # If we hit a method mismatch, also try GET (without secrets in URL/body) to confirm endpoint behavior.
        if create_user_post.get("status_code") == 405:
            probes.append(
                {
                    "name": "create_user_probe_get",
                    "result": await _strowallet_probe(settings, cfg["create_user_path"], None, method="GET"),
                }
            )
    # Probe create-card endpoint with auth-only payload
    if cfg.get("create_path"):
        probes.append({"name": "create_card_probe", "result": await _strowallet_probe(settings, cfg["create_path"], dict(auth_only), method="POST")})
    # Probe fetch detail with dummy card_id (should fail validation but confirms path/auth)
    if cfg.get("fetch_detail_path"):
        probes.append(
            {
                "name": "fetch_detail_probe",
                "result": await _strowallet_probe(settings, cfg["fetch_detail_path"], {"card_id": "TEST", **auth_only}, method="POST"),
            }
        )

    # Interpret common failures for admin readability
    def classify(status_code: Optional[int]) -> str:
        if status_code is None:
            return "network_error"
        if status_code in (401, 403):
            return "auth_error"
        if status_code == 404:
            return "wrong_path_or_base_url"
        if status_code == 405:
            return "method_not_allowed (check endpoint path)"
        if status_code in (400, 422):
            return "reachable_but_bad_payload (usually OK for auth/path)"
        if 200 <= status_code < 300:
            return "ok"
        if 500 <= status_code:
            return "provider_error"
        return "unexpected"

    for p in probes:
        res = p.get("result") or {}
        sc = res.get("status_code")
        cls = classify(sc)

        # Some providers return HTTP 200 with success=false for auth issues.
        body = res.get("body")
        if cls == "ok" and isinstance(body, dict):
            success = body.get("success")
            if success is False:
                # Treat validation-style payload errors as "reachable but bad payload".
                msg_val = body.get("message")
                if isinstance(body.get("errors"), dict) or isinstance(msg_val, (dict, list)):
                    cls = "reachable_but_bad_payload (usually OK for auth/path)"
                else:
                    msg = str(msg_val or body.get("error") or "").lower()
                    if "validation" in msg:
                        cls = "reachable_but_bad_payload (usually OK for auth/path)"
                    elif "not found" in msg:
                        # Expected for probes that use dummy identifiers (e.g. fetch-card-detail with TEST id).
                        cls = "reachable_but_bad_payload (usually OK for auth/path)"
                    elif "invalid public key" in msg or "invalid key" in msg or "unauthorized" in msg:
                        cls = "auth_error"
                    else:
                        cls = "provider_error"

        p["classification"] = cls

    return {"summary": summary, "probes": probes}


@api_router.post("/admin/strowallet/apply-default-endpoints")
async def admin_strowallet_apply_default_endpoints(admin: dict = Depends(get_admin_user)):
    """
    Force-set canonical Strowallet bitvcard endpoints in settings.
    This helps recover from typos like 'card-userrd-user' or duplicated path segments.
    """
    defaults = {
        "strowallet_base_url": "https://strowallet.com",
        "strowallet_create_user_path": "/api/bitvcard/create-user/",
        "strowallet_create_card_path": "/api/bitvcard/create-card/",
        "strowallet_fund_card_path": "/api/bitvcard/fund-card/",
        "strowallet_fetch_card_detail_path": "/api/bitvcard/fetch-card-detail/",
        "strowallet_card_transactions_path": "/api/bitvcard/card-transactions/",
        "strowallet_create_card_amount_usd": 5.0,
        # Advanced endpoints vary by plan; keep empty so admin can fill in if provided by Strowallet.
        "strowallet_freeze_unfreeze_path": "",
        "strowallet_full_card_history_path": "",
        "strowallet_withdraw_status_path": "",
        "strowallet_upgrade_limit_path": "",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.settings.update_one(
        {"setting_id": "main"},
        {"$set": defaults},
        upsert=True,
    )

    settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
    return {"message": "Default Strowallet endpoints applied", "settings": settings}


class AdminStrowalletFetchCardDetail(BaseModel):
    card_id: str = Field(min_length=1)
    user_id: Optional[str] = None  # optional: use stored strowallet_customer_id if present
    customer_id: Optional[str] = None  # optional override for some provider setups
    reference: Optional[str] = None


@api_router.post("/admin/strowallet/fetch-card-detail")
async def admin_strowallet_fetch_card_detail(
    payload: AdminStrowalletFetchCardDetail,
    admin: dict = Depends(get_admin_user),
):
    """
    Admin-only: fetch full provider card detail on-demand.
    SECURITY: response may contain sensitive fields (PAN/CVV) depending on provider.
    We do NOT store the provider response in DB.
    """
    settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
    if not _strowallet_enabled(settings):
        raise HTTPException(status_code=400, detail="Strowallet is disabled")

    cfg = _strowallet_config(settings)
    if not cfg.get("fetch_detail_path"):
        raise HTTPException(status_code=400, detail="Strowallet fetch detail endpoint not configured")

    card_id = str(payload.card_id).strip()
    if not card_id:
        raise HTTPException(status_code=400, detail="card_id is required")

    stw_customer_id: Optional[str] = (payload.customer_id or "").strip() or None
    if not stw_customer_id and payload.user_id:
        u = await db.users.find_one({"user_id": str(payload.user_id).strip()}, {"_id": 0})
        if u:
            stw_customer_id = (u.get("strowallet_customer_id") or u.get("strowallet_user_id") or "").strip() or None

    ref = (payload.reference or "").strip() or f"admin-fetch-{uuid.uuid4()}"
    req: Dict[str, Any] = {"card_id": card_id, "reference": ref}
    if stw_customer_id:
        req["customer_id"] = stw_customer_id
        req["card_user_id"] = stw_customer_id
    req = _with_aliases(req, "card_id", "cardId", "id")

    detail = await _strowallet_post(settings, cfg["fetch_detail_path"], req)
    return {
        "warning": "Sensitive data may be present in this response. Do not copy/share it.",
        "detail": detail,
    }


@api_router.post("/admin/strowallet/sync-user-cards")
async def admin_strowallet_sync_user_cards(
    email: Optional[str] = Query(default=None, description="User email to sync cards for"),
    user_id: Optional[str] = Query(default=None, description="User id to sync cards for"),
    admin: dict = Depends(get_admin_user),
):
    """
    Admin utility: refresh Strowallet card details (last4/expiry/name/brand/type) for a user.
    This fixes cases where cards exist at provider but our dashboard is missing details.
    """
    settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
    if not _strowallet_enabled(settings):
        raise HTTPException(status_code=400, detail="Strowallet is disabled")

    if not email and not user_id:
        raise HTTPException(status_code=400, detail="Provide email or user_id")

    q_user: Dict[str, Any] = {}
    if user_id:
        q_user["user_id"] = str(user_id).strip()
    if email:
        q_user["email"] = str(email).strip().lower()

    user = await db.users.find_one(q_user, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    cfg = _strowallet_config(settings)
    if not cfg.get("fetch_detail_path"):
        raise HTTPException(status_code=400, detail="Provider card detail endpoint not configured")

    orders = await db.virtual_card_orders.find(
        {"user_id": user["user_id"], "status": "approved", "provider": "strowallet"},
        {"_id": 0},
    ).to_list(200)

    updated: List[Dict[str, Any]] = []
    skipped: List[Dict[str, Any]] = []
    stw_customer_id = user.get("strowallet_customer_id") or user.get("strowallet_user_id")

    for o in orders:
        oid = o.get("order_id")
        provider_card_id = o.get("provider_card_id")
        if not provider_card_id:
            skipped.append({"order_id": oid, "reason": "missing_provider_card_id"})
            continue

        payload: Dict[str, Any] = {"card_id": provider_card_id, "reference": f"admin-sync-{oid}"}
        if stw_customer_id:
            payload["customer_id"] = stw_customer_id
            payload["card_user_id"] = stw_customer_id
        payload = _with_aliases(payload, "card_id", "cardId", "id")

        try:
            stw_detail = await _strowallet_post(settings, cfg["fetch_detail_path"], payload)
        except Exception as e:
            skipped.append({"order_id": oid, "reason": f"fetch_failed: {e}"})
            continue

        card_number = _extract_first(stw_detail, "data.card_number", "data.number", "card_number", "number", "data.card.number", "data.card.card_number")
        card_expiry = _extract_first(stw_detail, "data.expiry", "data.expiry_date", "expiry", "expiry_date", "data.card.expiry", "data.card.expiry_date")
        card_holder_name = _extract_first(stw_detail, "data.name_on_card", "data.card_name", "name_on_card", "card_name", "data.card.name_on_card")
        card_brand = _extract_first(stw_detail, "data.brand", "brand", "data.card.brand")
        card_type = _extract_first(stw_detail, "data.type", "type", "data.card.type")

        update_doc: Dict[str, Any] = {
            "provider": "strowallet",
            "provider_card_id": str(provider_card_id),
            "provider_raw": _redact_sensitive_payload({"detail": stw_detail}),
        }

        if card_number:
            card_number_str = str(card_number).replace(" ", "")
            update_doc["card_last4"] = card_number_str[-4:]
        if card_expiry:
            update_doc["card_expiry"] = str(card_expiry)
        if card_holder_name:
            update_doc["card_holder_name"] = str(card_holder_name)
        if cfg.get("brand_name"):
            update_doc["card_brand"] = cfg["brand_name"]
        elif card_brand:
            update_doc["card_brand"] = str(card_brand)
        if card_type:
            update_doc["card_type"] = str(card_type).lower()

        await db.virtual_card_orders.update_one({"order_id": oid}, {"$set": update_doc})
        updated.append({"order_id": oid, "provider_card_id": str(provider_card_id)})

    await log_action(
        admin["user_id"],
        "strowallet_sync_user_cards",
        {"user_id": user["user_id"], "email": user.get("email"), "updated": len(updated), "skipped": len(skipped)},
    )

    return {
        "user_id": user["user_id"],
        "email": user.get("email"),
        "updated": updated,
        "skipped": skipped,
        "note": "Sensitive PAN/CVV are never stored; we store only last4/expiry/name/brand/type.",
    }

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
    """Get app configuration for public display (non-payment settings)."""
    settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
    if not settings:
        return {
            "virtual_cards_enabled": False,
            "card_order_fee_htg": 500,
            "card_background_image": None,
            "topup_fee_tiers": [],
            "announcement_enabled": False,
            "announcement_text_ht": None,
            "announcement_text_fr": None,
            "announcement_text_en": None,
            "announcement_link": None,
            "updated_at": None,
        }
    
    return {
        "virtual_cards_enabled": _virtual_cards_enabled(settings),
        "card_order_fee_htg": settings.get("card_order_fee_htg", 500),
        "card_background_image": settings.get("card_background_image"),
        "topup_fee_tiers": settings.get("topup_fee_tiers", []),
        "announcement_enabled": settings.get("announcement_enabled", False),
        "announcement_text_ht": settings.get("announcement_text_ht"),
        "announcement_text_fr": settings.get("announcement_text_fr"),
        "announcement_text_en": settings.get("announcement_text_en"),
        "announcement_link": settings.get("announcement_link"),
        "updated_at": settings.get("updated_at"),
    }

@api_router.put("/admin/settings")
async def admin_update_settings(settings: AdminSettingsUpdate, admin: dict = Depends(get_admin_user)):
    try:
        # Convert empty strings to None for optional fields, but keep other values
        update_doc = {}
        # Do not allow accidental clearing of secrets by sending empty strings from the UI.
        # (Admin settings GET intentionally redacts these fields.)
        no_clear_on_empty = {
            "strowallet_api_key",
            "strowallet_api_secret",
        }
        for k, v in settings.model_dump().items():
            if v is not None:
                # Convert empty strings to None for string fields
                if isinstance(v, str) and v.strip() == "":
                    if k in no_clear_on_empty:
                        continue
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

    settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
    default_card_bg = settings.get("card_background_image") if settings else None
    
    update_doc = {}
    if payload.card_brand:
        update_doc["card_brand"] = payload.card_brand
    if payload.card_type:
        update_doc["card_type"] = payload.card_type
    if payload.card_holder_name:
        update_doc["card_holder_name"] = payload.card_holder_name
    if payload.card_last4:
        update_doc["card_last4"] = payload.card_last4
    if payload.card_expiry:
        update_doc["card_expiry"] = payload.card_expiry
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
    elif not order.get("card_image") and default_card_bg:
        update_doc["card_image"] = default_card_bg
    if payload.admin_notes is not None:
        update_doc["admin_notes"] = payload.admin_notes
    
    if update_doc:
        await db.virtual_card_orders.update_one(
            {"order_id": order_id},
            {"$set": update_doc}
        )
    
    return {"message": "Card details updated"}


@api_router.post("/admin/virtual-card-orders/{order_id}/auto-issue")
async def admin_auto_issue_virtual_card_order(
    order_id: str,
    admin: dict = Depends(get_admin_user),
):
    """
    Admin recovery tool: issue/sync a Strowallet card for an order that didn't reach the customer dashboard.
    - If order is pending, we will issue and mark approved.
    - If order is approved but missing provider details, we will re-issue detail sync best-effort.
    """
    settings = await db.settings.find_one({"setting_id": "main"}, {"_id": 0})
    if not _strowallet_enabled(settings):
        raise HTTPException(status_code=400, detail="Strowallet is disabled")

    order = await db.virtual_card_orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    user = await db.users.find_one({"user_id": order.get("user_id")}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # If already issued, just refresh provider detail best-effort.
    if order.get("provider") == "strowallet" and order.get("provider_card_id"):
        # Reuse the existing customer detail endpoint logic by calling provider directly
        cfg = _strowallet_config(settings)
        stw_customer_id = user.get("strowallet_customer_id") or user.get("strowallet_user_id")
        stw_detail = await _strowallet_fetch_detail_with_retry(
            settings=settings,
            cfg=cfg,
            provider_card_id=str(order.get("provider_card_id")),
            stw_customer_id=stw_customer_id,
            reference=f"admin-auto-issue-sync-{order_id}",
            attempts=4,
        )
        if stw_detail:
            # Apply same extraction rules used elsewhere.
            card_number = _extract_first(stw_detail, "data.card_number", "data.number", "card_number", "number", "data.card.number", "data.card.card_number")
            card_expiry = _extract_first(stw_detail, "data.expiry", "data.expiry_date", "expiry", "expiry_date", "data.card.expiry", "data.card.expiry_date")
            card_holder_name = _extract_first(stw_detail, "data.name_on_card", "data.card_name", "name_on_card", "card_name", "data.card.name_on_card")
            card_brand = _extract_first(stw_detail, "data.brand", "brand", "data.card.brand")
            card_type = _extract_first(stw_detail, "data.type", "type", "data.card.type")
            card_balance = _extract_float_first(
                stw_detail,
                "data.balance",
                "data.available_balance",
                "data.availableBalance",
                "balance",
                "available_balance",
                "availableBalance",
                "data.card.balance",
                "data.card.available_balance",
                "data.card.availableBalance",
            )
            card_currency = _extract_first(stw_detail, "data.currency", "currency", "data.card.currency")

            update_doc: Dict[str, Any] = {"provider_raw": _redact_sensitive_payload({"detail": stw_detail})}
            if card_number:
                card_number_str = str(card_number).replace(" ", "")
                update_doc["card_last4"] = card_number_str[-4:]
            if card_expiry:
                update_doc["card_expiry"] = str(card_expiry)
            if card_holder_name:
                update_doc["card_holder_name"] = str(card_holder_name)
            if cfg.get("brand_name"):
                update_doc["card_brand"] = cfg["brand_name"]
            elif card_brand:
                update_doc["card_brand"] = str(card_brand)
            if card_type:
                update_doc["card_type"] = str(card_type).lower()
            if card_balance is not None:
                update_doc["card_balance"] = float(card_balance)
            if card_currency:
                update_doc["card_currency"] = str(card_currency).upper()

            await db.virtual_card_orders.update_one({"order_id": order_id}, {"$set": update_doc})

        updated = await db.virtual_card_orders.find_one({"order_id": order_id}, {"_id": 0, "card_number": 0, "card_cvv": 0})
        await log_action(admin["user_id"], "admin_auto_issue_card_sync", {"order_id": order_id})
        return {"order": updated, "note": "Synced existing provider card details"}

    # Otherwise, issue it now.
    issue_update = await _strowallet_issue_card_for_order(settings=settings, order=order, user=user)
    await db.virtual_card_orders.update_one({"order_id": order_id}, {"$set": issue_update})
    updated = await db.virtual_card_orders.find_one({"order_id": order_id}, {"_id": 0, "card_number": 0, "card_cvv": 0})

    await log_action(admin["user_id"], "admin_auto_issue_card", {"order_id": order_id, "provider_card_id": issue_update.get("provider_card_id")})
    return {"order": updated, "message": "Card issued/synced successfully"}

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
        # Refund the total charged amount (amount + fee) to user's USD balance
        refund_amount = float(deposit.get("total_amount", deposit.get("amount", 0)) or 0)
        await db.users.update_one(
            {"user_id": deposit["user_id"]},
            {"$inc": {"wallet_usd": refund_amount}}
        )
        
        # Create refund transaction
        await db.transactions.insert_one({
            "transaction_id": str(uuid.uuid4()),
            "user_id": deposit["user_id"],
            "type": "card_topup_refund",
            "amount": refund_amount,
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


# Webhook Events Admin (Strowallet + related account providers)
@api_router.get("/admin/webhook-events")
async def admin_get_webhook_events(
    provider: Optional[str] = None,
    limit: int = Query(default=100, le=500),
    admin: dict = Depends(get_admin_user),
):
    query: Dict[str, Any] = {}
    if provider:
        query["provider"] = str(provider).strip().lower()

    events = await db.webhook_events.find(
        query,
        # Don't return full headers/payload for list view; use detail endpoint for full body.
        {"_id": 0, "event_id": 1, "provider": 1, "received_at": 1, "payload": 1},
    ).sort("received_at", -1).limit(limit).to_list(limit)

    # Provide a small extracted summary field for quick scanning.
    for e in events:
        p = e.get("payload") if isinstance(e.get("payload"), dict) else {}
        e["summary"] = _extract_first(
            p,
            "event",
            "type",
            "action",
            "data.event",
            "data.type",
            "data.action",
            "message",
        )
        # Prevent massive payloads in the list response
        if isinstance(e.get("payload"), dict):
            # Keep only a small subset in list response
            e["payload"] = {
                k: e["payload"].get(k)
                for k in ("event", "type", "action", "status", "message", "reference", "data")
                if k in e["payload"]
            }
        else:
            e["payload"] = None

    return {"events": events}


@api_router.get("/admin/webhook-events/{event_id}")
async def admin_get_webhook_event_detail(
    event_id: str,
    admin: dict = Depends(get_admin_user),
):
    ev = await db.webhook_events.find_one({"event_id": event_id}, {"_id": 0})
    if not ev:
        raise HTTPException(status_code=404, detail="Webhook event not found")
    return {"event": ev}

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

@api_router.post("/webhooks/strowallet")
async def strowallet_webhook(request: Request):
    """
    Strowallet card issuing webhook receiver.
    We accept JSON payloads and store them for audit/debugging. This endpoint is intentionally
    tolerant: it returns 200 even if we don't recognize the event yet, so Strowallet won't retry forever.
    """
    try:
        body = await request.json()
    except Exception:
        body = {"raw": (await request.body()).decode("utf-8", "replace")}

    # Store event for debugging/audit (best-effort).
    try:
        await db.webhook_events.insert_one({
            "event_id": str(uuid.uuid4()),
            "provider": "strowallet",
            "received_at": datetime.now(timezone.utc).isoformat(),
            "headers": {k.lower(): v for k, v in request.headers.items()},
            "payload": body,
        })
    except Exception as e:
        logger.warning(f"Failed to store strowallet webhook event: {e}")

    return {"ok": True}


async def _generic_account_webhook(provider: str, request: Request):
    """
    Generic webhook receiver for external account providers referenced by Strowallet UI.
    We store payloads for audit/debugging. Provider is stored for filtering.
    """
    try:
        body = await request.json()
    except Exception:
        body = {"raw": (await request.body()).decode("utf-8", "replace")}

    try:
        await db.webhook_events.insert_one({
            "event_id": str(uuid.uuid4()),
            "provider": provider,
            "received_at": datetime.now(timezone.utc).isoformat(),
            "headers": {k.lower(): v for k, v in request.headers.items()},
            "payload": body,
        })
    except Exception as e:
        logger.warning(f"Failed to store {provider} webhook event: {e}")

    return {"ok": True}


@api_router.post("/webhooks/amucha")
async def amucha_account_webhook(request: Request):
    return await _generic_account_webhook("amucha", request)


@api_router.post("/webhooks/bankly")
async def bankly_account_webhook(request: Request):
    return await _generic_account_webhook("bankly", request)


@api_router.post("/webhooks/paga")
async def paga_account_webhook(request: Request):
    return await _generic_account_webhook("paga", request)


@api_router.post("/webhooks/safe-haven")
async def safe_haven_account_webhook(request: Request):
    return await _generic_account_webhook("safe-haven", request)

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
    await db.kyc.create_index([("status", 1), ("submitted_at", -1)])
    await db.kyc.create_index([("submitted_at", -1)])
    await db.kyc.create_index("client_id")
    await db.agent_deposits.create_index([("agent_id", 1), ("status", 1)])
    await db.agent_deposits.create_index([("client_user_id", 1)])
    await db.agent_requests.create_index([("user_id", 1)])
    await db.payment_gateway_methods.create_index("payment_method_id", unique=True)
    await db.payment_gateway_methods.create_index([("payment_type", 1), ("status", 1)])
    await db.webhook_events.create_index([("provider", 1), ("received_at", -1)])
    
    # Optional: create a first admin via env (disabled by default).
    # SECURITY: never ship hardcoded default credentials.
    if _env_bool("CREATE_DEFAULT_ADMIN", False):
        existing_admin = await db.users.find_one({"is_admin": True}, {"_id": 0})
        if not existing_admin:
            email = (os.environ.get("DEFAULT_ADMIN_EMAIL") or "").strip().lower()
            password = (os.environ.get("DEFAULT_ADMIN_PASSWORD") or "").strip()
            if not email or not password:
                logger.warning("CREATE_DEFAULT_ADMIN is true but DEFAULT_ADMIN_EMAIL/DEFAULT_ADMIN_PASSWORD not set; skipping admin creation")
            else:
                admin_doc = {
                    "user_id": str(uuid.uuid4()),
                    "client_id": "KCADMIN001",
                    "email": email,
                    "password_hash": hash_password(password),
                    "full_name": "System Admin",
                    "phone": "+509 0000 0000",
                    "language": "fr",
                    "kyc_status": "approved",
                    "wallet_htg": 0.0,
                    "wallet_usd": 0.0,
                    "affiliate_code": generate_affiliate_code(),
                    "affiliate_earnings": 0.0,
                    "referred_by": None,
                    "is_active": True,
                    "is_admin": True,
                    "two_factor_enabled": False,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
                await db.users.insert_one(admin_doc)
                logger.info("Default admin created via DEFAULT_ADMIN_EMAIL (password not logged)")
    
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
