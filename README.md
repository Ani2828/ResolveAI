# ResolveAI

> **AI-powered consumer complaint resolution for users who should not have to learn how to use support systems.**

ResolveAI is a multilingual, voice-first complaint-resolution assistant designed for low-digital-literacy users. Instead of forcing users to navigate complicated help flows, it lets them explain what happened naturally by speaking or typing.

The system combines speech-to-text, structured complaint understanding, real platform data, and guided resolution workflows.

## Why ResolveAI

Online-order complaints are often harder to resolve than they should be. Users may need to identify the right app, find an order, understand support categories, communicate in an unfamiliar language, and repeat the same problem across multiple screens.

ResolveAI reduces that interaction cost:

**Speak/type naturally → understand the complaint → identify the relevant platform and issue → verify the real order → guide the user toward the appropriate resolution.**

## Core capabilities

- **Voice-first complaints** using local Faster-Whisper transcription.
- **Automatic language detection** with support for English, Hindi, Hinglish, Kannada and other languages handled by the AI layer.
- **AI complaint understanding** for platform, issue, product, requested action, order reference, confidence and clarification needs.
- **Real Swiggy integration** using OAuth 2.1 + PKCE and Swiggy MCP.
- **Real order retrieval and matching** against the connected Swiggy account.
- **Order-history verification** before showing an order-specific resolution workflow.
- **Multilingual UI adaptation** based on the language detected from the user's input.
- **Complaint history and solved-problem views** stored locally in the browser for the current MVP.
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
│   Real Swiggy Account    │
│ Orders / Addresses       │
└──────────────────────────┘
```

### Request flow

1. The user speaks or types a complaint.
2. Voice input is transcribed locally with Faster-Whisper.
3. The complaint is sent to the FastAPI analysis endpoint.
4. The AI extracts structured fields such as language, platform, issue, product and requested action.
5. When Swiggy is connected, the application retrieves real order history and searches for a safe match.
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

## Swiggy integration

ResolveAI uses Swiggy's MCP interface to connect an authorized Swiggy account and retrieve real food-order data.

The current integration supports the connected-account workflow for:

- OAuth authorization
- Saved-address retrieval
- Food-order retrieval
- Order matching
- Order details / order-history verification

The application deliberately does **not** claim that every complaint can be resolved through a direct API action. For example, the current Swiggy food MCP surface does not provide a direct customer-refund endpoint, so refund-related flows can guide the user toward the supported Swiggy support path instead of fabricating a successful refund.

## Data and privacy notes

This hackathon MVP intentionally keeps the architecture lightweight.

- Complaint history is stored in browser `localStorage` rather than a cloud database.
- User profile preferences are stored locally.
- API credentials stay in local environment variables.
- Swiggy account access is handled through the OAuth flow rather than hard-coded credentials.
- The application should never invent order IDs, prices, restaurant names, delivery information or resolution outcomes.

## Current MVP limitations

- There is no cloud database or multi-user authentication yet.
- Browser-local history is device/browser specific.
- Some resolution types require the platform's own support workflow rather than a direct API action.
- Production deployment requires appropriate platform credentials, redirect-URI configuration and external-service review.

## Hackathon context

**Project:** ResolveAI  
**Track:** Agentic AI  
**Focus:** Customer-support agent / real-world complaint resolution  
**Event:** WCC Launchpad 3.0

Built as a working hackathon prototype with open-source libraries and external platform APIs/MCP where permitted by their respective terms.

## Status

**Hackathon MVP — actively developed**

The repository represents the current implementation used for the submission.
