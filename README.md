# ResolveAI

> **AI-powered consumer complaint resolution for users who should not have to learn how to use support systems.**

ResolveAI is a multilingual, voice-first complaint-resolution assistant designed for low-digital-literacy users. Instead of forcing users to navigate complicated help flows, it lets them explain what happened naturally by speaking or typing.

The system combines speech-to-text, structured complaint understanding, account-scoped complaint history, and guided resolution workflows. Swiggy order data is available only after Swiggy authorization and partner access are enabled.

## Why ResolveAI

Online-order complaints are often harder to resolve than they should be. Users may need to identify the right app, find an order, understand support categories, communicate in an unfamiliar language, and repeat the same problem across multiple screens.

ResolveAI reduces that interaction cost:

**Speak/type naturally → understand the complaint → identify the relevant platform and issue → verify the real order → guide the user toward the appropriate resolution.**

## Core capabilities

- **Voice-first complaints** using local Faster-Whisper transcription, with optional Gnani Prisma STT and Timbre TTS.
- **Automatic language detection** with support for English, Hindi, Hinglish, Kannada and other languages handled by the AI layer.
- **AI complaint understanding** for platform, issue, product, requested action, order reference, confidence and clarification needs.
- **Swiggy integration path** using OAuth 2.1 + PKCE and Swiggy MCP; live order access requires Swiggy partner approval and an authorized account.
- **Order retrieval and matching** against a connected Swiggy account when that access is enabled.
- **Order-history verification** before showing an order-specific resolution workflow; ResolveAI does not invent order details or claim a refund was issued.
- **Multilingual UI adaptation** based on the language detected from the user's input.
- **Account sign-in and private complaint history** using Supabase Auth and owner-scoped Postgres row-level security, with a browser-local continuity copy.
- **In-app settings** for profile information, themes and custom wallpaper.
- **Mobile-first interface** designed around simple, low-friction interactions.

## Architecture

```text
┌──────────────────────────┐
│      React Frontend      │
│  Voice / Text / UI       │
└────────────┬─────────────┘
             │ HTTP
             ▼
┌──────────────────────────┐
│      FastAPI Backend     │
├──────────────────────────┤
│ Complaint Analysis       │
│ Faster-Whisper           │
│ OpenRouter LLM            │
│ Swiggy OAuth + MCP        │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│   Swiggy MCP (optional)  │
│ Partner access required  │
└──────────────────────────┘
```

### Request flow

1. The user speaks or types a complaint.
2. Voice input is transcribed locally with Faster-Whisper by default, or with Gnani Prisma when explicitly enabled on the backend.
3. The complaint is sent to the FastAPI analysis endpoint.
4. The AI extracts structured fields such as language, platform, issue, product and requested action.
5. When Swiggy access is approved and an account is connected, the application retrieves that account's order history and searches for a safe match.
6. The UI presents the verified order context and the next supported resolution step.

## Technology stack

### Frontend

- React 19
- Vite
- Tailwind CSS
- DaisyUI 5
- JavaScript / JSX

### Backend

- Python
- FastAPI
- Pydantic
- Faster-Whisper
- OpenRouter (OpenAI-compatible API)
- HTTPX
- Swiggy MCP
- OAuth 2.1 + PKCE

## Repository structure

```text
ResolveAI/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── .env.example
│   └── .gitignore
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── public/
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.js
│   └── .gitignore
│
├── docs/
│   └── ARCHITECTURE.md
│
├── .gitignore
└── README.md
```

## Local setup

### Prerequisites

- Node.js 18+
- Python 3.10+
- Git
- A working microphone for voice input

### 1. Clone

```bash
git clone https://github.com/Ani2828/ResolveAI.git
cd ResolveAI
```

### 2. Start the backend

```bash
cd backend
python -m venv venv
```

Windows PowerShell:

```powershell
.\venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create a local `.env` from `.env.example` and add your own credentials.

#### Supabase account setup

1. Create a Supabase project and enable email sign-in. In **Authentication → URL Configuration**, add `http://localhost:5173` and your deployed frontend URL to the allowed redirect URLs.
2. In **Authentication → Signing Keys**, use an asymmetric ES256 or RS256 signing key. The backend verifies user access tokens against Supabase's public JWKS endpoint.
3. Run `backend/migrations/001_user_scoped_swiggy_sessions.sql` and `backend/migrations/002_user_complaint_history.sql` in the Supabase SQL Editor.
4. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `frontend/.env`. The anon key is public and may be included in the frontend; never put a service role or secret key in a `VITE_` variable.
5. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SWIGGY_TOKEN_ENCRYPTION_KEY` in `backend/.env`. The service role key must stay server-side. Generate a Fernet encryption key with:

   ```bash
   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
   ```

6. Add the matching Supabase URL and anon key as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` on the frontend host. Add the Supabase URL, server-only service role key and encryption key to the backend host. `render.yaml` declares these variables so Render prompts for values at deploy time.

Complaint history is stored in Postgres under the signed-in user's ID and protected by row-level security. The browser also keeps an account-scoped local copy for continuity. Swiggy access tokens and OAuth PKCE state are encrypted in Postgres and accessible only to the backend service role. Rotating the encryption key without re-encrypting stored values will require users to reconnect Swiggy.

The backend also applies per-account request limits to complaint analysis, voice, and order retrieval. These limits are in-process safeguards; configure a shared gateway/WAF rate limit before running multiple backend instances.

Start FastAPI:

```bash
uvicorn main:app --reload
```

Backend:

```text
http://127.0.0.1:8000
```

### 3. Start the frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend:

```text
http://localhost:5173
```

## Environment variables

The backend uses environment variables for external credentials.

See:

```text
backend/.env.example
```

**Never commit `.env` or API keys to GitHub.**


### Optional Gnani Prisma STT and Timbre TTS

Gnani speech services are optional and disabled by default. Keep the API key in `backend/.env` only; never expose it in frontend variables or commit real credentials.

```dotenv
GNANI_API_KEY=your_gnani_api_key
GNANI_STT_ENABLED=true
GNANI_TTS_ENABLED=true
```

Restart the backend after changing these settings. Prisma STT is used only when enabled with a key; otherwise the existing local Faster-Whisper path remains the default and fallback. Timbre TTS is used for the spoken Swiggy support-request helper when enabled; browser speech synthesis remains the fallback.

The integration expects an account-enabled Gnani API key. Live provider behavior cannot be confirmed without valid credentials and network access. No API key is included in this repository.

## Swiggy integration

ResolveAI has an OAuth + MCP integration path for connecting an authorized Swiggy account and retrieving food-order data. **Live Swiggy data is not available to a demo until Swiggy has approved the app's access and the user has authorized an account.** The deployed callback is configured in Render; the callback URL alone does not grant partner access.

When partner access is enabled, the connected-account workflow supports:

- OAuth authorization
- Saved-address retrieval
- Food-order retrieval
- Order matching
- Order details / order-history verification

The application deliberately does **not** claim that every complaint can be resolved through a direct API action. For example, the current Swiggy food MCP surface does not provide a direct customer-refund endpoint, so refund-related flows can guide the user toward the supported Swiggy support path instead of fabricating a successful refund.

## Data and privacy notes

This hackathon MVP intentionally keeps the architecture lightweight.

- Complaint history is stored in Supabase Postgres for the signed-in owner and mirrored in account-scoped browser `localStorage` for continuity.
- User profile preferences are stored locally.
- API credentials stay in local environment variables.
- Swiggy account access is handled through the OAuth flow rather than hard-coded credentials.
- The application should never invent order IDs, prices, restaurant names, delivery information or resolution outcomes.

## Current MVP limitations

- Live Swiggy order retrieval requires partner approval, redirect URI allowlisting, and user authorization; it may not be available in a hackathon or internship demo.
- The browser-local continuity copy is device/browser specific; Supabase is the account-backed history source.
- Some resolution types require the platform's own support workflow rather than a direct API action.
- Production deployment requires appropriate platform credentials, redirect-URI configuration and external-service review.

## Demo and presentation

Follow the honest, five-minute walkthrough in [`docs/DEMO.md`](docs/DEMO.md). Until Swiggy partner access is approved, describe the deployed experience as an AI complaint-analysis demo with private complaint history; label the complaint text as sample input and do not present order data as live.

## Hackathon context

**Project:** ResolveAI  
**Track:** Agentic AI  
**Focus:** Customer-support agent / real-world complaint resolution  
**Event:** WCC Launchpad 3.0

Built as a working hackathon prototype with open-source libraries and external platform APIs/MCP where permitted by their respective terms.

## Status

**Hackathon MVP — actively developed**

The repository represents the current implementation used for the submission.
