import os
import asyncio
import builtins
import json
import re
import base64
import hashlib
import secrets
import tempfile
import time
import io
import logging
import uuid
import threading
from collections import defaultdict, deque
from datetime import datetime, timezone
from urllib.parse import urlencode

from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi import Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from typing import Literal, Any, cast
from openai import OpenAI
from faster_whisper import WhisperModel
import jwt
from jwt import PyJWKClient
import httpx
import av


# ============================================================
# ENVIRONMENT
# ============================================================

load_dotenv()

logger = logging.getLogger("resolveai")

API_KEY = os.getenv("OPENROUTER_API_KEY")

if not API_KEY:
    raise RuntimeError(
        "OPENROUTER_API_KEY is missing from .env"
    )


# ============================================================
# OPENROUTER
# ============================================================

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=API_KEY,
)


# ============================================================
# WHISPER
# ============================================================

print("================================")
print("ResolveAI Voice Engine")
print("================================")
print("Loading multilingual Whisper model...")

WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "small")
GNANI_API_KEY = os.getenv("GNANI_API_KEY", "").strip()
GNANI_STT_ENABLED = os.getenv("GNANI_STT_ENABLED", "false").lower() == "true"
GNANI_TTS_ENABLED = os.getenv("GNANI_TTS_ENABLED", "false").lower() == "true"

whisper_model = WhisperModel(
    WHISPER_MODEL_SIZE,
    device="cpu",
    compute_type="int8",
)

print("Whisper model loaded successfully.")


# ============================================================
# FASTAPI
# ============================================================

app = FastAPI(
    title="ResolveAI Backend"
)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "ResolveAI Backend"}


@app.get("/api/voice/config")
def voice_config():
    """Expose feature availability without ever exposing provider credentials."""
    return {
        "stt_provider": "gnani" if GNANI_STT_ENABLED and GNANI_API_KEY else "local",
        "tts_enabled": GNANI_TTS_ENABLED and bool(GNANI_API_KEY),
    }


# ============================================================
# SWIGGY MCP (OAuth 2.1 + PKCE)
# ============================================================

SWIGGY_BASE_URL = "https://mcp.swiggy.com"
SWIGGY_REDIRECT_URI = os.getenv(
    "SWIGGY_REDIRECT_URI",
    "http://localhost:8000/api/swiggy/callback",
)
SWIGGY_CLIENT_ID = os.getenv("SWIGGY_CLIENT_ID")
SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
SWIGGY_TOKEN_ENCRYPTION_KEY = os.getenv("SWIGGY_TOKEN_ENCRYPTION_KEY", "").strip()
SUPABASE_JWKS = (
    PyJWKClient(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json", cache_keys=True)
    if SUPABASE_URL
    else None
)
bearer_scheme = HTTPBearer(auto_error=False)
_rate_limit_buckets: dict[str, deque[float]] = defaultdict(deque)
_rate_limit_lock = threading.Lock()


def enforce_user_rate_limit(user_id: str, scope: str, limit: int, window_seconds: int = 60):
    """Apply a small per-account abuse limit to expensive authenticated operations."""
    now = time.monotonic()
    key = f"{user_id}:{scope}"
    with _rate_limit_lock:
        bucket = _rate_limit_buckets[key]
        while bucket and bucket[0] <= now - window_seconds:
            bucket.popleft()
        if len(bucket) >= limit:
            retry_after = max(1, int(window_seconds - (now - bucket[0])))
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please wait a moment and try again.",
                headers={"Retry-After": str(retry_after)},
            )
        bucket.append(now)
        if len(_rate_limit_buckets) > 10000:
            expired = [
                bucket_key
                for bucket_key, values in _rate_limit_buckets.items()
                if not values or values[0] <= now - window_seconds
            ]
            for bucket_key in expired:
                _rate_limit_buckets.pop(bucket_key, None)


def require_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
):
    if not SUPABASE_URL or SUPABASE_JWKS is None:
        raise HTTPException(status_code=503, detail="Authentication is not configured.")
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Sign in to continue.")
    try:
        signing_key = SUPABASE_JWKS.get_signing_key_from_jwt(credentials.credentials)
        claims = jwt.decode(
            credentials.credentials,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
            issuer=f"{SUPABASE_URL}/auth/v1",
            options={"require": ["exp", "iss", "sub", "aud"]},
        )
        return {"id": str(uuid.UUID(claims["sub"]))}
    except (jwt.PyJWTError, ValueError, KeyError):
        raise HTTPException(status_code=401, detail="Your session is invalid or expired. Sign in again.")


def _supabase_headers(prefer: str | None = None) -> dict[str, str]:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=503, detail="Account storage is not configured.")
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    return headers


async def _supabase_request(method: str, path: str, **kwargs):
    try:
        async with httpx.AsyncClient(timeout=10) as supabase_client:
            response = await supabase_client.request(
                method,
                f"{SUPABASE_URL}/rest/v1/{path}",
                headers=_supabase_headers(kwargs.pop("prefer", None)),
                **kwargs,
            )
        response.raise_for_status()
        return response.json() if response.content else None
    except HTTPException:
        raise
    except (httpx.HTTPError, ValueError) as error:
        logger.warning("Account storage request failed (%s)", type(error).__name__)
        raise HTTPException(status_code=503, detail="Account storage is temporarily unavailable.") from error


def _encrypt_swiggy_secret(value: str) -> str:
    if not SWIGGY_TOKEN_ENCRYPTION_KEY:
        raise HTTPException(status_code=503, detail="Swiggy token encryption is not configured.")
    try:
        from cryptography.fernet import Fernet
        return Fernet(SWIGGY_TOKEN_ENCRYPTION_KEY.encode("ascii")).encrypt(value.encode()).decode()
    except (ValueError, UnicodeError) as error:
        logger.error("Swiggy token encryption key is invalid")
        raise HTTPException(status_code=503, detail="Swiggy token encryption is not configured correctly.") from error


def _decrypt_swiggy_secret(value: str) -> str:
    if not SWIGGY_TOKEN_ENCRYPTION_KEY:
        raise HTTPException(status_code=503, detail="Swiggy token encryption is not configured.")
    try:
        from cryptography.fernet import Fernet, InvalidToken
        return Fernet(SWIGGY_TOKEN_ENCRYPTION_KEY.encode("ascii")).decrypt(value.encode()).decode()
    except (ValueError, UnicodeError, InvalidToken) as error:
        logger.error("Swiggy token decryption failed")
        raise HTTPException(status_code=503, detail="Swiggy authorization needs to be refreshed.") from error


async def _load_swiggy_session(user_id: str):
    rows = await _supabase_request(
        "GET",
        "resolveai_swiggy_tokens",
        params={"user_id": f"eq.{user_id}", "select": "access_token_ciphertext,expires_at", "limit": "1"},
    )
    if not rows:
        return None
    row = rows[0]
    expires_at = datetime.fromisoformat(row["expires_at"].replace("Z", "+00:00")).timestamp()
    if expires_at <= time.time():
        await _supabase_request("DELETE", "resolveai_swiggy_tokens", params={"user_id": f"eq.{user_id}"})
        return None
    return _decrypt_swiggy_secret(row["access_token_ciphertext"]), expires_at


async def _store_swiggy_session(user_id: str, access_token: str, expires_in: int):
    expires_at = datetime.fromtimestamp(time.time() + max(60, min(expires_in, 30 * 86400)), timezone.utc).isoformat()
    await _supabase_request(
        "POST",
        "resolveai_swiggy_tokens?on_conflict=user_id",
        json={"user_id": user_id, "access_token_ciphertext": _encrypt_swiggy_secret(access_token), "expires_at": expires_at},
        prefer="resolution=merge-duplicates,return=minimal",
    )


async def _clear_swiggy_session(user_id: str):
    await _supabase_request("DELETE", "resolveai_swiggy_tokens", params={"user_id": f"eq.{user_id}"})


def _base64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


async def _register_swiggy_client() -> str:
    """Register this local app using Swiggy's OAuth Dynamic Client Registration."""
    global SWIGGY_CLIENT_ID
    if SWIGGY_CLIENT_ID:
        return SWIGGY_CLIENT_ID

    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            f"{SWIGGY_BASE_URL}/auth/register",
            json={
                "client_name": "ResolveAI",
                "redirect_uris": [SWIGGY_REDIRECT_URI],
                "grant_types": ["authorization_code"],
                "response_types": ["code"],
                "token_endpoint_auth_method": "none",
            },
        )
    if response.is_error:
        raise HTTPException(
            status_code=503,
            detail=(
                "Swiggy client registration is unavailable for this redirect. "
                "The redirect URI may need to be allowlisted by Swiggy Builders Club."
            ),
        )
    registration = response.json()
    client_id = registration.get("client_id")
    if not client_id:
        raise HTTPException(status_code=502, detail="Swiggy did not return an OAuth client ID.")
    SWIGGY_CLIENT_ID = client_id
    return client_id
async def _mcp_call(tool_name: str, arguments: dict, user_id: str) -> dict:
    """
    Call a Swiggy MCP tool.

    Handles:
    - normal JSON-RPC responses
    - structuredContent
    - content[].text JSON
    - content[].text containing JSON/code fences
    - direct result objects
    - SSE/data responses
    """

    session = await _load_swiggy_session(user_id)
    if not session:
        raise HTTPException(
            status_code=401,
            detail="Swiggy authorization required. Please connect again.",
        )

    async with httpx.AsyncClient(timeout=30) as client:

        response = await client.post(
            f"{SWIGGY_BASE_URL}/food",

            headers={
                "Authorization": f"Bearer {session[0]}",
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream",
            },

            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "tools/call",
                "params": {
                    "name": tool_name,
                    "arguments": arguments,
                },
            },
        )

    # ============================================================
    # AUTH
    # ============================================================

    if response.status_code in (401, 419):

        await _clear_swiggy_session(user_id)

        raise HTTPException(
            status_code=401,
            detail="Swiggy authorization expired. Please connect again.",
        )

    if response.is_error:

        print(
            "SWIGGY MCP HTTP ERROR:",
            response.status_code,
        )

        raise HTTPException(
            status_code=502,
            detail="Swiggy could not retrieve this information right now.",
        )

    # ============================================================
    # READ RESPONSE
    # ============================================================

    payload = None

    # First try normal JSON.
    try:

        payload = response.json()

    except ValueError:

        # ========================================================
        # SSE / STREAMABLE HTTP
        # ========================================================

        for line in response.text.splitlines():

            line = line.strip()

            if not line.startswith("data:"):
                continue

            raw = line[5:].strip()

            if not raw:
                continue

            try:

                candidate = json.loads(raw)

                if isinstance(candidate, dict):
                    payload = candidate
                    break

            except (TypeError, ValueError):
                continue

    if not isinstance(payload, dict):

        print(
            "SWIGGY MCP INVALID RESPONSE:",
            {
                "status": response.status_code,
                "content_type": response.headers.get(
                    "content-type"
                ),
                "body_length": len(response.text),
            },
        )

        raise HTTPException(
            status_code=502,
            detail="Swiggy returned an unreadable MCP response.",
        )

    # ============================================================
    # JSON-RPC RESULT
    # ============================================================

    result = payload.get(
        "result",
        payload,
    )

    if not isinstance(result, dict):

        raise HTTPException(
            status_code=502,
            detail="Swiggy returned an invalid MCP result.",
        )

    # ============================================================
    # JSON-RPC ERROR
    # ============================================================

    if payload.get("error"):

        print(
            "SWIGGY MCP JSON-RPC ERROR:",
            {
                "has_error": True,
            },
        )

        raise HTTPException(
            status_code=502,
            detail="Swiggy could not complete the requested operation.",
        )

    if result.get("isError") is True:

        raise HTTPException(
            status_code=502,
            detail="Swiggy could not complete the requested operation.",
        )

    # ============================================================
    # STRUCTURED CONTENT
    # ============================================================

    structured = result.get(
        "structuredContent"
    )

    if isinstance(structured, dict) and structured:

        return structured

    # ============================================================
    # CONTENT
    # ============================================================

    content = result.get(
        "content",
        []
    )

    if isinstance(content, list):

        for item in content:

            if not isinstance(item, dict):
                continue

            item_type = item.get("type")

            # ----------------------------------------------------
            # TEXT CONTENT
            # ----------------------------------------------------

            if item_type == "text":

                text_value = item.get(
                    "text",
                    ""
                )

                if not isinstance(
                    text_value,
                    str,
                ):
                    continue

                text_value = text_value.strip()

                if not text_value:
                    continue

                # ------------------------------------------------
                # Direct JSON
                # ------------------------------------------------

                try:

                    parsed = json.loads(
                        text_value
                    )

                    if isinstance(
                        parsed,
                        dict,
                    ):
                        return parsed

                except (
                    TypeError,
                    ValueError,
                ):
                    pass

                # ------------------------------------------------
                # JSON inside markdown code fence
                # ------------------------------------------------

                cleaned = (
                    text_value
                    .replace(
                        "```json",
                        ""
                    )
                    .replace(
                        "```",
                        ""
                    )
                    .strip()
                )

                try:

                    parsed = json.loads(
                        cleaned
                    )

                    if isinstance(
                        parsed,
                        dict,
                    ):
                        return parsed

                except (
                    TypeError,
                    ValueError,
                ):
                    pass

                # ------------------------------------------------
                # Find JSON object inside text
                # ------------------------------------------------

                start = text_value.find("{")
                end = text_value.rfind("}")

                if (
                    start != -1
                    and end != -1
                    and end > start
                ):

                    possible_json = (
                        text_value[
                            start:end + 1
                        ]
                    )

                    try:

                        parsed = json.loads(
                            possible_json
                        )

                        if isinstance(
                            parsed,
                            dict,
                        ):
                            return parsed

                    except (
                        TypeError,
                        ValueError,
                    ):
                        pass

            # ----------------------------------------------------
            # JSON CONTENT
            # ----------------------------------------------------

            if item_type in {
                "json",
                "application/json",
            }:

                item_data = item.get(
                    "data"
                )

                if isinstance(
                    item_data,
                    dict,
                ):

                    return item_data

    # ============================================================
    # DIRECT SWIGGY ENVELOPE
    # ============================================================

    if (
        "data" in result
        or "success" in result
        or "message" in result
    ):

        return result

    # ============================================================
    # IMPORTANT FALLBACK
    #
    # Do NOT throw "unsupported MCP response" here.
    #
    # Return the complete RESULT structure so the order parser
    # can recursively inspect it.
    # ============================================================

    print(
        "SWIGGY MCP FALLBACK:",
        {
            "result_keys": list(
                result.keys()
            ),
            "content_count": (
                len(content)
                if isinstance(
                    content,
                    list,
                )
                else 0
            ),
            "tool": tool_name,
        },
    )

    return result

# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip().rstrip("/")
        for origin in os.getenv(
            "FRONTEND_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,https://resolveai-frontend.onrender.com",
        ).split(",")
        if origin.strip()
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Cross-Origin-Resource-Policy", "same-site")
    return response


# ============================================================
# REQUEST MODEL
# ============================================================

class ConversationTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=2000)


class ComplaintRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    conversation: list[ConversationTurn] = Field(default_factory=list, max_length=20)
    requested_action: str | None = Field(default=None, max_length=32)


# ============================================================
# AI SYSTEM INSTRUCTIONS
# ============================================================

SYSTEM_INSTRUCTIONS = """
You are the JSON classification engine for ResolveAI.

You are NOT a tool-calling agent.

DO NOT call tools.
DO NOT generate tool calls.
DO NOT output:
<|tool_call_start|>
<|tool_call_end|>

Your ONLY job is to understand the user's complaint
and return one valid JSON object.

Return JSON only.

You are the AI understanding layer of ResolveAI.

ResolveAI helps people explain problems with online orders
and digital services.

The user may communicate in:

- English
- Hindi
- Hinglish
- Kannada
- Tamil
- Telugu
- Malayalam
- Marathi
- Bengali
- Gujarati
- Punjabi
- Urdu
- or mixed languages.

You must understand the user's meaning regardless of language.

Do NOT ask the user to select a language.

Extract the following fields:

language
platform
issue
product
requested_action
order_reference
confidence
reply
missing_fields
clarification_question

SUPPORTED PLATFORMS:

- swiggy
- zomato
- amazon
- flipkart
- myntra
- meesho
- unknown

SUPPORTED ISSUES:

- missing_item
- wrong_item
- damaged_item
- late_delivery
- cancelled_order
- payment_problem
- refund_problem
- delivery_problem
- account_problem
- other
- unknown

Use "unknown" when the user has not explained the problem. Use "other" only
when the user described a specific issue that does not fit the listed issues.

SUPPORTED REQUESTED ACTIONS:

- refund
- replacement
- reorder
- cancellation
- status_check
- information
- unknown

IMPORTANT TRUST RULES:

Never invent:

- order IDs
- products
- prices
- dates
- restaurant names
- delivery details
- customer details

Only extract information that the user actually provided.

PLATFORM CONTEXT RULE:

ResolveAI may have a real platform account connected.

If Swiggy is connected and the user describes an
online food-order complaint without naming another
platform, use:

platform = "swiggy"

Do NOT ask the user which app they used.

The application will verify the complaint against
the user's real Swiggy order history.

Never invent an order, order ID, product, restaurant,
price, date, or customer information.

- platform: which app or service, if unknown
- issue: what happened, if unknown
- product: which item, for product-specific issues such as missing, wrong,
  or damaged item
- requested_action: what outcome the user wants, if unknown

Use missing_fields as an array containing only applicable field names from
platform, issue, product, requested_action. Set clarification_question to
null when none are missing. ORDER IDENTIFICATION RULE:

Never ask the user for an order ID or order reference as the normal
first step.

If the platform is Swiggy and the user's account is connected, ResolveAI
will retrieve the user's real Swiggy order history separately and match
the complaint against those orders.

The user should normally only describe what went wrong in natural language.

For example:

User: "Mera Chicken Nuggets nahi aaya, refund chahiye."

You must NOT ask:
"Please provide your order ID."

Instead extract:
platform = swiggy
issue = missing_item
product = Chicken Nuggets
requested_action = refund

The application will search the connected Swiggy orders automatically.

Only use order_reference when the user explicitly provides an order ID,
order number, or reference in their message.

Only consider asking the user to distinguish between orders when the
application has already searched the connected order history and found
multiple plausible matching orders that cannot be safely distinguished. 

LANGUAGE RULE:

The "language" field should describe the actual language
or dominant language of the user's message.

Examples:

Hindi
English
Hinglish
Kannada
Tamil
Telugu
Malayalam
Marathi
Bengali

If the message mixes languages, use the dominant language
or "Hinglish" where appropriate.

Hindi detection:
- Text written in Devanagari with Hindi wording is Hindi, even
  when it contains a few English words or product names.
- Use Hinglish only when Hindi is written mainly in Latin letters
  (for example, "mera order late hai") or when Hindi and English
  are genuinely mixed at similar levels.
- Do not label Devanagari Hindi as English just because it includes
  English brand names or borrowed words.

RETURN FORMAT:

Return ONLY a valid JSON object.

Do not write explanations before or after the JSON.

Use exactly these fields:

{
  "language": "...",
  "platform": "...",
  "issue": "...",
  "product": null,
  "requested_action": "...",
  "order_reference": null,
  "confidence": 0.0,
  "reply": "...",
  "missing_fields": [],
  "clarification_question": null
}

confidence must be a number between 0 and 1.

The "reply" must be a short, natural acknowledgment written in the
same language and writing system as the user's message. Do not translate
the user's message into English. If the user wrote Hindi in Devanagari,
reply in Devanagari; if they used Hinglish in Latin letters, reply in
Hinglish using Latin letters. Keep product and platform names as written.
"""


# ============================================================
# JSON CLEANING
# ============================================================

def clean_json_output(text: str):

    text = text.strip()

    text = re.sub(
        r"```json",
        "",
        text,
        flags=re.IGNORECASE
    )

    text = re.sub(
        r"```",
        "",
        text
    )

    text = text.strip()

    start = text.find("{")
    end = text.rfind("}")

    if start == -1 or end == -1 or end <= start:
        raise ValueError(
            f"AI did not return valid JSON. "
            f"AI response was: {text}"
        )

    return text[start:end + 1]


# ============================================================
# OPENROUTER ANALYSIS
# ============================================================

def analyze_with_ai(
    message: str,
    conversation=None,
    swiggy_connected: bool = False,
):
    conversation = conversation or []

    # ========================================================
    # CONNECTED PLATFORM CONTEXT
    # ========================================================

    connected_context = ""

    if swiggy_connected:

        connected_context = """
IMPORTANT APPLICATION CONTEXT:

A real Swiggy account is currently connected.

If the user describes an online food-order complaint
without naming another platform, use:

platform = "swiggy"

Do NOT ask:
"Which app was this on?"

ResolveAI will automatically search the connected
Swiggy account and match the complaint against real
orders.

Do not invent an order, order ID, price, restaurant,
or product.

Only the real Swiggy API can establish that an order
exists.
"""

    # ========================================================
    # MODEL MESSAGES
    # ========================================================

    model_messages = [
        {
            "role": "system",
            "content": (
                SYSTEM_INSTRUCTIONS
                + "\n\n"
                + connected_context
            ),
        }
    ]

    model_messages.extend(
        [
            {
                "role": turn.role,
                "content": turn.content,
            }
            for turn in conversation[-8:]
        ]
    )

    model_messages.append(
        {
            "role": "user",
            "content": message,
        }
    )

    # ========================================================
    # OPENROUTER
    # ========================================================

    # ============================================================
    # AI REQUEST
    # ============================================================

    response = client.chat.completions.create(
       model="openrouter/free",
       messages=cast(Any, model_messages),
       temperature=0,
   )

    raw_content = (
        response
        .choices[0]
        .message
        .content
        or ""
    ).strip()

    # ============================================================
    # SOME FREE MODELS MAY RETURN A TOOL-CALL MARKER
    # INSTEAD OF THE REQUIRED JSON.
    #
    # Retry once with an extremely strict JSON-only prompt.
    # ============================================================

    if (
        not raw_content
        or raw_content.startswith("<|tool_call_start|>")
        or "<|tool_call_start|>" in raw_content
        or "<|tool_call_end|>" in raw_content
    ):

        print(
            "AI returned a tool-call marker instead of JSON."
        )

        retry_messages = [
            {
                "role": "system",
                "content": """
    You are the complaint classification engine for ResolveAI.

    IMPORTANT:
    You MUST NOT call any tools.
    You MUST NOT output tool-call syntax.
    You MUST NOT output markdown.
    You MUST NOT explain anything.

Return ONLY ONE valid JSON object.

The JSON must contain exactly these fields:

{
  "language": "English",
  "platform": "swiggy",
  "issue": "missing_item",
  "product": "Crispy Masala",
  "requested_action": "refund",
  "order_reference": null,
  "confidence": 0.95,
  "reply": "I understand. I will verify the order and check the available resolution."
}

Allowed platform values:
swiggy, zomato, amazon, flipkart, myntra, meesho, unknown

Allowed issue values:
missing_item, wrong_item, damaged_item, late_delivery,
cancelled_order, payment_problem, refund_problem,
delivery_problem, account_problem, other, unknown

Allowed requested_action values:
refund, replacement, reorder, cancellation,
status_check, information, unknown

If Swiggy is connected, food-order complaints should use
platform "swiggy" unless the user explicitly names another platform.

Never invent an order ID.
Never claim that a refund has already happened.

    Return JSON only.
    """,
            },
            {
                "role": "user",
                "content": message,
            },
        ]

        retry_response = client.chat.completions.create(
            model="openrouter/free",
            messages=cast(
                Any,
                retry_messages,
            ),
            temperature=0,
        )

        raw_content = (
            retry_response
            .choices[0]
            .message
            .content
            or ""
        ).strip()

    # ============================================================
    # VALIDATE AI OUTPUT
    # ============================================================

    if not raw_content:
        raise ValueError(
            "AI returned an empty response."
        )

    if (
        "<|tool_call_start|>" in raw_content
        or "<|tool_call_end|>" in raw_content
    ):
        raise ValueError(
            "AI returned tool-call syntax instead of JSON."
        )

    cleaned_output = clean_json_output(
        raw_content
    )

    try:
        result = json.loads(
            cleaned_output
        )
    except json.JSONDecodeError as exc:
        raise ValueError(
            "AI did not return valid JSON."
        ) from exc

    # ========================================================
    # LANGUAGE
    # ========================================================

    has_devanagari = any(
        "\u0900" <= character <= "\u097f"
        for character in message
    )

    language = str(
        result.get(
            "language",
            ""
        )
    ).strip().casefold()

    if (
        has_devanagari
        and language
        in {
            "",
            "unknown",
            "english",
            "hinglish",
            "hindi/english",
        }
    ):

        result["language"] = "Hindi"

    # ========================================================
    # SUPPORTED VALUES
    # ========================================================

    supported_platforms = {
        "swiggy",
        "zomato",
        "amazon",
        "flipkart",
        "myntra",
        "meesho",
    }

    supported_issues = {
        "missing_item",
        "wrong_item",
        "damaged_item",
        "late_delivery",
        "cancelled_order",
        "payment_problem",
        "refund_problem",
        "delivery_problem",
        "account_problem",
        "other",
    }

    supported_actions = {
        "refund",
        "replacement",
        "reorder",
        "cancellation",
        "status_check",
        "information",
    }

    platform = str(
        result.get(
            "platform",
            "unknown"
        )
    ).strip().casefold()

    issue = str(
        result.get(
            "issue",
            "unknown"
        )
    ).strip().casefold()

    requested_action = str(
        result.get(
            "requested_action",
            "unknown"
        )
    ).strip().casefold()

    # ========================================================
    # PLATFORM
    # ========================================================

    if platform not in supported_platforms:
        if swiggy_connected:
            platform = "swiggy"
        else:
            platform = "unknown"

    result["platform"] = platform

    # ========================================================
    # ISSUE
    # ========================================================

    if issue not in supported_issues:
        issue = "unknown"

    result["issue"] = issue

    # ========================================================
    # ACTION FROM CONVERSATION
    # ========================================================

    if requested_action not in supported_actions:
        previous_user_text = " ".join(
            turn.content
            for turn in conversation[-8:]
            if turn.role == "user"
        ).casefold()

        combined_text = (
            previous_user_text
            + " "
            + message.casefold()
        )

        action_phrases = {
            "refund": (
                "refund",
                "money back",
                "paisa wapas",
                "paise wapas",
                "पैसे वापस",
                "रिफंड",
            ),
            "replacement": (
                "replacement",
                "replace",
                "badal",
                "बदल",
                "रिप्लेसमेंट",
            ),
            "reorder": (
                "reorder",
                "order again",
                "phir se mang",
                "फिर से मंग",
            ),
            "cancellation": (
                "cancel",
                "cancellation",
                "रद्द",
            ),
            "status_check": (
                "track",
                "tracking",
                "status",
                "where is",
                "kahan hai",
                "कहाँ है",
            ),
            "information": (
                "information",
                "tell me",
                "jaankari",
                "जानकारी",
            ),
        }

        for action, phrases in action_phrases.items():
            if any(
                phrase in combined_text
                for phrase in phrases
            ):
                requested_action = action
                break

    if requested_action not in supported_actions:
        requested_action = "unknown"

    result["requested_action"] = requested_action

    # ========================================================
    # MISSING FIELDS
    # ========================================================

    missing_fields = []

    if result.get("platform") == "unknown":
        missing_fields.append("platform")

    if result.get("issue") == "unknown":
        missing_fields.append("issue")

    if (
        result.get("issue")
        in {
            "missing_item",
            "wrong_item",
            "damaged_item",
        }
        and not result.get("product")
    ):
        missing_fields.append("product")

    if result.get("requested_action") == "unknown":
        missing_fields.append("requested_action")

    result["missing_fields"] = missing_fields

    # ========================================================
    # CLARIFICATION
    # ========================================================

    if not missing_fields:
        result["clarification_question"] = None
    else:
        language_key = result.get("language", "English")

        labels = {
            "English": {
                "platform": "which app or service this was on",
                "issue": "what happened",
                "product": "which item was affected",
                "requested_action": "what outcome you want",
            },
            "Hindi": {
                "platform": "यह किस ऐप या सेवा पर हुआ",
                "issue": "क्या हुआ",
                "product": "कौन-सा आइटम प्रभावित हुआ",
                "requested_action": "आप क्या समाधान चाहते हैं",
            },
            "Hinglish": {
                "platform": "ye kis app ya service par hua",
                "issue": "kya hua",
                "product": "kaunsa item affect hua",
                "requested_action": "aap kya solution chahte hain",
            },
        }

        label_map = labels.get(language_key, labels["English"])
        details = ", ".join(label_map[field] for field in missing_fields)

        if language_key == "Hindi":
            result["clarification_question"] = (
                f"आगे मदद के लिए बताइए: {details}?"
            )
        elif language_key == "Hinglish":
            result["clarification_question"] = (
                f"Aage help ke liye batao: {details}?"
            )
        else:
            result["clarification_question"] = (
                f"To help with this, please tell me: {details}."
            )

    # ========================================================
    # TRUST RULE:
    # NEVER SAY REFUND HAS ALREADY HAPPENED
    # ========================================================

    if requested_action == "refund":
        language_key = result.get("language")

        if language_key == "Hindi":
            result["reply"] = (
                "समझ गया। मैं आपका ऑर्डर verify "
                "करके उपलब्ध समाधान देखता हूँ।"
            )
        elif language_key == "Hinglish":
            result["reply"] = (
                "Samajh gaya. Main aapka order "
                "verify karke available solution "
                "check karta hoon."
            )
        else:
            result["reply"] = (
                "I understand. I'll verify your "
                "order and check the available "
                "resolution."
            )

    return result


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():

    return {
        "success": True,
        "message": "ResolveAI backend is running",
        "voice": "local Faster-Whisper",
        "ai": "OpenRouter",
        "multilingual": True,
    }


@app.get("/api/swiggy/status")
async def swiggy_status(user: dict = Depends(require_current_user)):
    session = await _load_swiggy_session(user["id"])
    connected = bool(session)
    return {
        "connected": connected,
        "expires_at": session[1] if connected else None,
        "authorization_required": not connected,
    }


@app.post("/api/swiggy/connect")
async def swiggy_connect(user: dict = Depends(require_current_user)):
    """Start Swiggy's real authorization-code flow with PKCE."""
    client_id = await _register_swiggy_client()
    verifier = _base64url(secrets.token_bytes(32))
    challenge = _base64url(hashlib.sha256(verifier.encode("ascii")).digest())
    state = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    await _supabase_request(
        "DELETE",
        "resolveai_swiggy_oauth_states",
        params={
            "user_id": f"eq.{user['id']}",
            "created_at": f"lt.{datetime.fromtimestamp(now.timestamp() - 600, timezone.utc).isoformat()}",
        },
    )
    await _supabase_request(
        "POST",
        "resolveai_swiggy_oauth_states",
        json={
            "state": state,
            "user_id": user["id"],
            "verifier_ciphertext": _encrypt_swiggy_secret(verifier),
            "created_at": now.isoformat(),
        },
        prefer="return=minimal",
    )
    query = urlencode({
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": SWIGGY_REDIRECT_URI,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        "state": state,
        "scope": "mcp:tools",
    })
    return {"authorization_url": f"{SWIGGY_BASE_URL}/auth/authorize?{query}"}


@app.get("/api/swiggy/callback")
async def swiggy_callback(request: Request):
    frontend_url = os.getenv("SWIGGY_FRONTEND_URL", "http://127.0.0.1:5173/")
    error = request.query_params.get("error")
    state = request.query_params.get("state", "")
    if not state:
        return RedirectResponse(f"{frontend_url}?swiggy=authorization_required", status_code=303)

    try:
        state_rows = await _supabase_request(
            "POST",
            "rpc/consume_resolveai_swiggy_oauth_state",
            json={"p_state": state},
        )
    except HTTPException:
        return RedirectResponse(f"{frontend_url}?swiggy=authorization_required", status_code=303)
    state_data = state_rows[0] if isinstance(state_rows, list) and state_rows else None
    created_at = None
    if state_data:
        created_at = datetime.fromisoformat(state_data["created_at"].replace("Z", "+00:00")).timestamp()
    if error or not state_data or created_at is None or time.time() - created_at > 600:
        return RedirectResponse(f"{frontend_url}?swiggy=authorization_required", status_code=303)

    code = request.query_params.get("code")
    if not code:
        return RedirectResponse(f"{frontend_url}?swiggy=authorization_required", status_code=303)
    token_request = {
        "grant_type": "authorization_code",
        "code": code,
        "code_verifier": _decrypt_swiggy_secret(state_data["verifier_ciphertext"]),
        "redirect_uri": SWIGGY_REDIRECT_URI,
    }
    if SWIGGY_CLIENT_ID:
        token_request["client_id"] = SWIGGY_CLIENT_ID
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(f"{SWIGGY_BASE_URL}/auth/token", json=token_request)
        response.raise_for_status()
        token_result = response.json()
        access_token = token_result.get("access_token")
        if not access_token:
            raise ValueError("Missing access token")
        await _store_swiggy_session(
            state_data["user_id"],
            access_token,
            int(token_result.get("expires_in", 432000)),
        )
    except (httpx.HTTPError, ValueError, TypeError, HTTPException):
        return RedirectResponse(f"{frontend_url}?swiggy=authorization_required", status_code=303)
    return RedirectResponse(f"{frontend_url}?swiggy=connected", status_code=303)


@app.get("/api/swiggy/addresses")
async def swiggy_addresses(user: dict = Depends(require_current_user)):
    result = await _mcp_call("get_addresses", {"page": 1, "pageSize": 10}, user["id"])
    data = result.get("data", result)
    return {"addresses": data.get("addresses", []), "pagination": data.get("pagination")}


class SwiggyOrdersRequest(BaseModel):
    address_id: str = Field(min_length=1, max_length=128)


@app.post("/api/swiggy/orders")
async def swiggy_orders(request: SwiggyOrdersRequest, user: dict = Depends(require_current_user)):
    enforce_user_rate_limit(user["id"], "swiggy-orders", 30)
    address_id = request.address_id.strip()
    if not address_id:
        raise HTTPException(status_code=400, detail="Choose a saved Swiggy address first.")
    result = await _mcp_call("get_food_orders", {"addressId": address_id}, user["id"])
    data = result.get("data", result)
    return {"orders": data.get("orders", []), "status_message": data.get("statusMessage")}


# ============================================================
# SWIGGY ORDER DETAILS
# ============================================================

class SwiggyOrderDetailsRequest(BaseModel):
    order_id: str = Field(min_length=1, max_length=128)
    order: dict[str, Any] | None = Field(default=None, max_length=100)

def _normalize_order_id(value) -> str:
    if value is None:
        return ""

    return str(value).strip()


def _looks_like_order_object(value) -> bool:
    """
    Check whether a dictionary looks like a Swiggy order.
    """

    if not isinstance(value, dict):
        return False

    possible_order_fields = {
        "orderId",
        "order_id",
        "orderStatus",
        "order_status",
        "restaurantName",
        "restaurant_name",
        "orderedItems",
        "order_items",
        "orderItems",
        "orderedTime",
        "order_time",
        "orderTotal",
        "order_total",
    }

    return bool(
        possible_order_fields.intersection(
            value.keys()
        )
    )

def _find_order_object(
    value,
    target_order_id=None,
):
    """
    Recursively find a real Swiggy order object.
    """

    target_id = (
        str(target_order_id).strip()
        if target_order_id is not None
        else ""
    )

    # ============================================================
    # DICTIONARY
    # ============================================================

    if isinstance(value, dict):

        # --------------------------------------------------------
        # Exact order ID
        # --------------------------------------------------------

        current_id = str(
            value.get("orderId")
            or value.get("order_id")
            or ""
        ).strip()

        if (
            target_id
            and current_id
            and current_id == target_id
        ):
            return value

        # --------------------------------------------------------
        # Known order containers
        # --------------------------------------------------------

        for key in (
            "order",
            "orderDetails",
            "order_details",
            "foodOrder",
            "food_order",
            "foodOrderDetails",
            "food_order_details",
            "details",
            "data",
        ):

            if key not in value:
                continue

            found = _find_order_object(
                value[key],
                target_order_id=target_id,
            )

            if found is not None:
                return found

        # --------------------------------------------------------
        # Is this itself an order?
        # --------------------------------------------------------

        order_fields = {
            "orderId",
            "order_id",
            "orderStatus",
            "order_status",
            "restaurantName",
            "restaurant_name",
            "orderedItems",
            "order_items",
            "orderItems",
            "orderedTime",
            "order_time",
            "orderTotal",
            "order_total",
        }

        if order_fields.intersection(
            value.keys()
        ):

            if not target_id:
                return value

            if not current_id:
                return value

            if current_id == target_id:
                return value

        # --------------------------------------------------------
        # Search every nested value
        # --------------------------------------------------------

        for child in value.values():

            found = _find_order_object(
                child,
                target_order_id=target_id,
            )

            if found is not None:
                return found

        return None

    # ============================================================
    # LIST
    # ============================================================

    if isinstance(value, list):

        for child in value:

            found = _find_order_object(
                child,
                target_order_id=target_id,
            )

            if found is not None:
                return found

        return None

    # ============================================================
    # STRING
    # ============================================================

    if isinstance(value, str):

        text = value.strip()

        if not text:
            return None

        # Try direct JSON.
        try:

            parsed = json.loads(text)

            if isinstance(
                parsed,
                (dict, list),
            ):

                return _find_order_object(
                    parsed,
                    target_order_id=target_id,
                )

        except (
            TypeError,
            ValueError,
        ):
            pass

        # Try JSON embedded inside text.
        start = text.find("{")
        end = text.rfind("}")

        if (
            start != -1
            and end != -1
            and end > start
        ):

            try:

                parsed = json.loads(
                    text[
                        start:end + 1
                    ]
                )

                if isinstance(
                    parsed,
                    (dict, list),
                ):

                    return _find_order_object(
                        parsed,
                        target_order_id=target_id,
                    )

            except (
                TypeError,
                ValueError,
            ):
                pass

    return None


def _extract_order_items(order: dict) -> list:
    """
    Normalize item information from Swiggy.
    """

    raw_items = (
        order.get("order_items")
        or order.get("orderItems")
        or order.get("orderedItems")
        or order.get("items")
        or []
    )

    # Some Swiggy responses may provide a textual
    # orderedItems representation.
    if isinstance(raw_items, str):

        return [
            {
                "name": raw_items,
                "quantity": None,
                "total": None,
            }
        ]

    if not isinstance(raw_items, list):
        return []

    items = []

    for item in raw_items:

        if not isinstance(item, dict):
            continue

        name = (
            item.get("name")
            or item.get("item_name")
            or item.get("itemName")
            or item.get("title")
        )

        quantity = (
            item.get("quantity")
            if item.get("quantity") is not None
            else item.get("qty")
        )

        total = (
            item.get("total")
            if item.get("total") is not None
            else item.get("final_price")
        )

        if total is None:
            total = item.get("finalPrice")

        if total is None:
            total = item.get("item_total")

        items.append(
            {
                "name": name,
                "quantity": quantity,
                "total": total,
            }
        )

    return items

@app.post("/api/swiggy/order-details")
async def swiggy_order_details(
    request: SwiggyOrderDetailsRequest,
    user: dict = Depends(require_current_user),
):
    order_id = request.order_id.strip()

    if not order_id:
        raise HTTPException(
            status_code=400,
            detail="Choose a Swiggy order first.",
        )

    # ============================================================
    # FIRST: TRY REAL SWIGGY ORDER DETAILS
    # ============================================================

    try:
        result = await _mcp_call(
            "get_food_order_details",
            {
                "orderId": order_id,
            },
            user["id"],
        )

        order = _find_order_object(
            result,
            target_order_id=order_id,
        )

        if isinstance(order, dict):

            items = _extract_order_items(order)

            return {
                "success": True,
                "verified": True,
                "verification_source": "order_details",
                "order": {
                    "orderId": str(
                        order.get("order_id")
                        or order.get("orderId")
                        or order_id
                    ),
                    "restaurantName": (
                        order.get("restaurant_name")
                        or order.get("restaurantName")
                    ),
                    "orderStatus": (
                        order.get("order_status")
                        or order.get("orderStatus")
                    ),
                    "orderedTime": (
                        order.get("order_time")
                        or order.get("orderTime")
                        or order.get("orderedTime")
                    ),
                    "orderTotal": (
                        order.get("order_total")
                        if order.get("order_total") is not None
                        else order.get("orderTotal")
                    ),
                    "items": items,
                },
            }

    except Exception as exc:
        logger.warning("Swiggy order lookup failed (%s)", type(exc).__name__)

    # ============================================================
    # FALLBACK:
    # USE THE REAL ORDER OBJECT THAT CAME FROM
    # get_food_orders
    # ============================================================

    candidate = request.order

    if isinstance(candidate, dict):

        candidate_id = str(
            candidate.get("orderId")
            or candidate.get("order_id")
            or ""
        ).strip()

        # Never accept a different order.
        if candidate_id == order_id:

            items = _extract_order_items(
                candidate
            )

            # get_food_orders may call the field orderedItems.
            if not items:

                raw_items = candidate.get(
                    "orderedItems"
                )

                if isinstance(
                    raw_items,
                    list,
                ):

                    items = []

                    for item in raw_items:

                        if not isinstance(
                            item,
                            dict,
                        ):
                            continue

                        items.append(
                            {
                                "name": (
                                    item.get("name")
                                    or item.get("itemName")
                                    or item.get("item_name")
                                    or item.get("title")
                                ),
                                "quantity": (
                                    item.get("quantity")
                                    or item.get("qty")
                                ),
                                "total": (
                                    item.get("total")
                                    or item.get("finalPrice")
                                    or item.get("final_price")
                                ),
                            }
                        )

            return {
                "success": True,
                "verified": True,
                "verification_source": "order_history",

                "order": {
                    "orderId": order_id,

                    "restaurantName": (
                        candidate.get(
                            "restaurantName"
                        )
                        or candidate.get(
                            "restaurant_name"
                        )
                    ),

                    "orderStatus": (
                        candidate.get(
                            "orderStatus"
                        )
                        or candidate.get(
                            "order_status"
                        )
                    ),

                    "orderedTime": (
                        candidate.get(
                            "orderedTime"
                        )
                        or candidate.get(
                            "order_time"
                        )
                    ),

                    "orderTotal": (
                        candidate.get(
                            "orderTotal"
                        )
                        if candidate.get(
                            "orderTotal"
                        ) is not None
                        else candidate.get(
                            "order_total"
                        )
                    ),

                    "items": items,
                },
            }

    # ============================================================
    # NOTHING COULD VERIFY THE ORDER
    # ============================================================

    raise HTTPException(
        status_code=502,
        detail=(
            "Swiggy could not verify this order "
            "right now."
        ),
    )

@app.post("/api/swiggy/disconnect")
async def swiggy_disconnect(user: dict = Depends(require_current_user)):
    session = await _load_swiggy_session(user["id"])
    if session:
        async with httpx.AsyncClient(timeout=15) as client:
            try:
                await client.post(
                    f"{SWIGGY_BASE_URL}/auth/logout",
                    headers={"Authorization": f"Bearer {session[0]}"},
                )
            except httpx.HTTPError:
                pass
    await _clear_swiggy_session(user["id"])
    return {"connected": False}


# ============================================================
# TEXT / COMPLAINT ANALYSIS
# ============================================================

@app.post("/api/analyze")
async def analyze_complaint(
    request: ComplaintRequest,
    user: dict = Depends(require_current_user),
):
    enforce_user_rate_limit(user["id"], "complaint-analysis", 20)

    try:

        message = request.message.strip()

        if not message:

            return {
                "success": False,
                "error": "Complaint message is empty.",
            }

        # ----------------------------------------------------
        # AI UNDERSTANDING
        # ----------------------------------------------------

        swiggy_session = await _load_swiggy_session(user["id"])
        result = await asyncio.to_thread(
            analyze_with_ai,
            message,
            request.conversation,
            bool(swiggy_session),
        )

        # ----------------------------------------------------
        # FRONTEND ACTION OVERRIDE
        # ----------------------------------------------------

        if request.requested_action in {
            "refund",
            "replacement",
            "reorder",
            "cancellation",
            "status_check",
            "information",
        }:

            result[
                "requested_action"
            ] = request.requested_action

            result[
                "missing_fields"
            ] = [
                field
                for field
                in result.get(
                    "missing_fields",
                    []
                )
                if field != "requested_action"
            ]

            if not result[
                "missing_fields"
            ]:

                result[
                    "clarification_question"
                ] = None

        # ----------------------------------------------------
        # NEXT STEP
        # ----------------------------------------------------

        missing_fields = result.get(
            "missing_fields",
            []
        )

        if missing_fields:

            next_step = "clarification"

        elif (
            result.get("platform")
            == "swiggy"
            and swiggy_session
        ):

            next_step = "order_matching"

        elif (
            result.get("platform")
            == "swiggy"
        ):

            next_step = "platform_connection"

        else:

            next_step = "platform_connection"

        # ----------------------------------------------------
        # LOG
        # ----------------------------------------------------

        # ----------------------------------------------------
        # RESPONSE
        # ----------------------------------------------------

        return {
            "success": True,
            "message": message,
            **result,
            "next_step": next_step,
        }

    except HTTPException:
        raise

    except builtins.Exception as e:

        logger.warning("Complaint analysis failed (%s)", type(e).__name__)

        return {
            "success": False,
            "error": "AI analysis failed",
        }


# ============================================================
# VOICE TRANSCRIPTION
# ============================================================

@app.post("/api/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    language_code: str = Form("en-IN"),
    user: dict = Depends(require_current_user),
):
    enforce_user_rate_limit(user["id"], "voice-transcription", 10)

    temp_path = None

    try:

        # ----------------------------------------------------
        # RECEIVE AUDIO
        # ----------------------------------------------------

        max_size = 25 * 1024 * 1024
        if file.size is not None and file.size > max_size:
            raise HTTPException(
                status_code=413,
                detail="Audio file is too large. Please record a shorter message.",
            )
        audio_bytes = await file.read(max_size + 1)


        # ----------------------------------------------------
        # VALIDATE AUDIO
        # ----------------------------------------------------

        if not audio_bytes:

            return {
                "success": False,
                "error": "No audio received.",
            }


        if len(audio_bytes) > max_size:
            raise HTTPException(
                status_code=413,
                detail="Audio file is too large. Please record a shorter message.",
            )


        # Gnani Prisma REST accepts audio clips up to 60 seconds and returns
        # {success, transcript, request_id, timestamp}. Keep local Whisper as
        # the default and fallback unless explicitly enabled with credentials.
        if GNANI_STT_ENABLED and GNANI_API_KEY:
            if language_code not in {"bn-IN", "en-IN", "gu-IN", "hi-IN", "kn-IN", "ml-IN", "mr-IN", "pa-IN", "ta-IN", "te-IN"}:
                raise HTTPException(status_code=422, detail="Unsupported Gnani language code.")
            # MediaRecorder commonly emits WebM/Opus, while Prisma REST
            # documents WAV/MP3/OGG/FLAC/AAC/M4A. Normalize browser audio to
            # mono 16 kHz PCM WAV using PyAV (already installed with Whisper).
            try:
                input_container = av.open(io.BytesIO(audio_bytes))
                audio_stream = next((stream for stream in input_container.streams if stream.type == "audio"), None)
                if audio_stream is None:
                    input_container.close()
                    raise HTTPException(status_code=422, detail="No supported audio track was found.")
                if audio_stream.duration and audio_stream.time_base and float(audio_stream.duration * audio_stream.time_base) > 60:
                    input_container.close()
                    raise HTTPException(status_code=422, detail="Gnani Prisma accepts audio clips up to 60 seconds.")
                wav_buffer = io.BytesIO()
                output_container = av.open(wav_buffer, mode="w", format="wav")
                output_stream = output_container.add_stream("pcm_s16le", rate=16000)
                output_stream.layout = "mono"
                resampler = av.audio.resampler.AudioResampler(format="s16", layout="mono", rate=16000)
                for frame in input_container.decode(audio_stream):
                    for converted in resampler.resample(frame):
                        for packet in output_stream.encode(converted):
                            output_container.mux(packet)
                for packet in output_stream.encode(None):
                    output_container.mux(packet)
                output_container.close()
                input_container.close()
                wav_bytes = wav_buffer.getvalue()
                async with httpx.AsyncClient(timeout=60) as client:
                    response = await client.post(
                        "https://api.vachana.ai/stt/v3",
                        headers={"X-API-Key-ID": GNANI_API_KEY},
                        data={"language_code": language_code, "format": "transcribe"},
                        files={"audio_file": ("resolveai-voice.wav", wav_bytes, "audio/wav")},
                    )
                if not response.is_error:
                    result = response.json()
                    transcript = result.get("transcript", "").strip() if result.get("success") is True else ""
                    if transcript:
                        return {"success": True, "text": transcript, "language": language_code.split("-")[0], "provider": "gnani-prisma", "request_id": result.get("request_id")}
            except HTTPException:
                raise
            except (httpx.HTTPError, ValueError, av.error.FFmpegError, StopIteration) as error:
                logger.warning("Gnani transcription failed (%s); using local fallback", type(error).__name__)
            except Exception as error:
                logger.warning("Gnani audio processing failed (%s); using local fallback", type(error).__name__)


        # ----------------------------------------------------
        # SAVE TEMPORARY AUDIO FILE
        # ----------------------------------------------------

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=".webm"
        ) as temp_file:

            temp_file.write(
                audio_bytes
            )

            temp_path = temp_file.name


        # ----------------------------------------------------
        # WHISPER TRANSCRIPTION
        # ----------------------------------------------------

        print(
            "VOICE: Starting multilingual Whisper..."
        )


        segments, info = whisper_model.transcribe(

            temp_path,

            # Transcribe in the spoken language; never translate speech.
            task="transcribe",

            # Beam search improves decoding quality.
            beam_size=5,

            # Disable VAD while debugging.
            # This prevents Whisper from accidentally
            # removing quiet speech.
            vad_filter=False,

            # Prevent previous decoding mistakes from
            # influencing the next segment.
            condition_on_previous_text=False,

            # Deterministic decoding.
            temperature=0,

        )


        # ----------------------------------------------------
        # COLLECT TRANSCRIPT
        # ----------------------------------------------------

        transcript_parts = []

        for segment in segments:

            text = segment.text.strip()

            if text:

                transcript_parts.append(
                    text
                )


        transcript = " ".join(
            transcript_parts
        ).strip()


        # ----------------------------------------------------
        # WHISPER LANGUAGE INFORMATION
        # ----------------------------------------------------

        detected_language = info.language

        language_probability = round(
            info.language_probability,
            3
        )


        # ----------------------------------------------------
        # EMPTY TRANSCRIPT
        # ----------------------------------------------------

        if not transcript:

            return {
                "success": False,
                "error": (
                    "I could not understand "
                    "the speech. Please try again."
                ),
                "language": detected_language,
                "language_probability": language_probability,
            }


        # ----------------------------------------------------
        # RETURN RESULT
        # ----------------------------------------------------

        return {

            "success": True,

            "text": transcript,

            "language": detected_language,

            "language_probability":
                language_probability,

        }


    except HTTPException:
        raise

    except builtins.Exception as e:

        logger.warning("Voice transcription failed (%s)", type(e).__name__)

        return {

            "success": False,

            "error":
                "Voice transcription failed.",

        }


    finally:

        # ----------------------------------------------------
        # DELETE TEMP AUDIO
        # ----------------------------------------------------

        if temp_path:

            try:

                os.remove(
                    temp_path
                )

                print(
                    "VOICE: Temporary audio deleted."
                )

            except OSError:

                pass


class SynthesizeRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    language: Literal["auto", "hi-IN", "en-IN", "ta-IN", "te-IN", "kn-IN", "ml-IN", "mr-IN", "pa-IN", "bn-IN", "gu-IN", "hi-en"] = "auto"
    voice: Literal["Kaveri", "Nalini"] = "Kaveri"


@app.post("/api/voice/synthesize")
async def synthesize_voice(request: SynthesizeRequest, user: dict = Depends(require_current_user)):
    enforce_user_rate_limit(user["id"], "voice-synthesis", 30)
    if not GNANI_TTS_ENABLED or not GNANI_API_KEY:
        raise HTTPException(status_code=503, detail="Gnani Timbre TTS is not enabled on this server.")
    allowed_languages = {"auto", "hi-IN", "en-IN", "ta-IN", "te-IN", "kn-IN", "ml-IN", "mr-IN", "pa-IN", "bn-IN", "gu-IN", "hi-en"}
    if request.language not in allowed_languages:
        raise HTTPException(status_code=422, detail="Unsupported Gnani language code.")
    payload = {
        "text": request.text,
        "voice": request.voice,
        "model": "timbre-v2.5",
        "language": request.language,
        "audio_config": {"sample_rate": 24000, "num_channels": 1, "sample_width": 2, "encoding": "linear_pcm", "container": "wav"},
    }
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                "https://api.vachana.ai/api/v1/tts/inference",
                headers={"X-API-Key-ID": GNANI_API_KEY, "Content-Type": "application/json"},
                json=payload,
            )
    except httpx.HTTPError as error:
        logger.warning("Gnani synthesis failed (%s)", type(error).__name__)
        raise HTTPException(status_code=502, detail="Gnani Timbre synthesis failed.") from error
    if response.is_error or not response.content:
        raise HTTPException(status_code=502, detail="Gnani Timbre synthesis failed.")
    return Response(content=response.content, media_type="audio/wav")


# ============================================================
# RUN SERVER
# ============================================================

if __name__ == "__main__":

    import uvicorn

    uvicorn.run(

        "main:app",

        host="127.0.0.1",

        port=8000,

        reload=True,

    )
