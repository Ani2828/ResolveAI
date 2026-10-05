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

The current MVP uses browser-local persistence for:

- complaint history
- solved-problem status
- profile preferences
- theme selection
- wallpaper

No cloud database is required for the current prototype.
