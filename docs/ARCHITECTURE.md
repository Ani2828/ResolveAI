# ResolveAI Architecture

## High-level flow

```text
User
  │
  ├── text
  │
  └── voice
        │
        ▼
  React frontend
        │
        ├── voice recording
        └── complaint text
        │
        ▼
  FastAPI
        │
        ├── /api/transcribe
        │       └── Faster-Whisper
        │
        └── /api/analyze
                └── OpenRouter LLM
                        │
                        ▼
                Structured complaint
                - language
                - platform
                - issue
                - product
                - requested action
                - order reference
                - confidence
                - clarification needs
                        │
                        ▼
                Swiggy connected?
                    │
              ┌─────┴─────┐
              │           │
             No          Yes
              │           │
              │           ▼
              │      Swiggy MCP
              │      - addresses
              │      - food orders
              │      - order details
              │           │
              │           ▼
              │      Safe order match
              │           │
              └─────┬─────┘
                    ▼
              UI resolution flow
```

## Agent boundaries

ResolveAI separates **understanding** from **platform actions**:

- The LLM classifies and structures the complaint.
- The frontend/backend decides when real platform data is required.
- Swiggy MCP is used for real account/order information.
- The UI does not claim a resolution occurred unless the supported platform workflow confirms it.

This separation reduces hallucinated order information and keeps the user in control.

## Voice pipeline

```text
Microphone
   ↓
Browser MediaRecorder
   ↓
FastAPI /api/transcribe
   ↓
Faster-Whisper (small, CPU/int8)
   ↓
Transcript
   ↓
User confirms/edits
   ↓
/api/analyze
```

The user can correct the transcript before submitting the complaint to the analysis layer.

## Persistence

The current MVP stores signed-in complaint history in Supabase Postgres, protected by row-level security. It mirrors complaint history in account-scoped browser storage for continuity. Profile preferences remain browser-local. Swiggy OAuth tokens and temporary authorization state are encrypted in Postgres and accessed only by the backend service role.

The browser-local copy supports:

- solved-problem status
- profile preferences
- theme selection
- wallpaper

## Capacity and failure behavior

Complaint analysis and local Whisper decoding run in bounded worker slots so synchronous provider/model work does not block the FastAPI event loop. The API rejects work briefly with HTTP 503 and `Retry-After` when its slots stay full; per-account request limits further constrain expensive endpoints. Frontend API calls have time limits and show a retryable message when the network or backend is unavailable.

The limits are per process and sized for the current single-instance demo. They are not a guarantee against arbitrary traffic: a free host can sleep while idle, the local speech model needs CPU and memory, and multiple instances do not share the current rate-limit counters. A public launch needs an always-on sized instance, shared rate limiting/monitoring, and load testing. At higher traffic, speech should move to a bounded background queue with separately scaled workers.

Live Swiggy order retrieval additionally requires Swiggy partner approval, callback allowlisting, and user authorization. Without those prerequisites the app can still demonstrate complaint analysis and account-scoped history, but it cannot verify a real Swiggy order.


## Optional Gnani speech services

When `GNANI_STT_ENABLED=true` and a server-side `GNANI_API_KEY` is configured, the backend normalizes recorded audio to mono 16 kHz WAV and tries Gnani Prisma STT before falling back to local Faster-Whisper. The optional `/api/voice/synthesize` endpoint uses Gnani Timbre TTS for spoken support-request drafts. Both services remain disabled by default, and browser speech synthesis remains the frontend fallback. Never commit API credentials.
