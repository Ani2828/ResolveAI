# ResolveAI demo guide

Use this walkthrough for an internship interview, hackathon judging, or a short product demo. It takes about five minutes and does not require pretending that a sample complaint is a real customer case.

## Before presenting

- Open the deployed app: https://resolveai-frontend-9f0z.onrender.com.
- Sign in with your own account. Complaint history is private to the signed-in user.
- Check whether Swiggy shows as connected. If it says **Authorization required**, continue with the sample complaint demo below; do not promise live order verification.
- Use fictional/sample complaint text. Do not enter another person's personal data or show private order details on a public screen recording.
- If voice input is part of the demo, allow microphone access and test it beforehand. Text input is a reliable fallback.

## Five-minute walkthrough

1. **Introduce the user problem (30 seconds).** Explain that support flows can be difficult to navigate, especially when someone would rather describe an issue in their own words or language.
2. **Submit a sample complaint (60 seconds).** Type: `My food order arrived, but the drink was missing. I want help with the missing item.` Optionally record the same fictional complaint and review the transcript before sending it.
3. **Show the AI understanding (60 seconds).** Point out the detected platform, issue, requested action, and suggested next step. Explain that the model structures the complaint; it does not decide that a refund has happened.
4. **Show verification honestly (60 seconds).** If Swiggy access is not authorized, state that the app cannot verify an order yet. If partner access has been approved and your own test account is connected, select a real order and show only the fields needed for the complaint.
5. **Show the outcome and privacy (60 seconds).** Show the complaint status and the signed-in account's history. If you mark a sample complaint complete, explain that this is only the app's status and does not issue a platform refund.
6. **Close with limitations and next step (30 seconds).** Explain that real Swiggy order data depends on Swiggy partner approval and account consent; a support/refund action is only confirmed if the platform itself confirms it.

## Suggested narration

> “ResolveAI lets a customer explain an issue by voice or text. It turns that into structured complaint details and a suggested next step. Complaint history is saved to the signed-in user's account. Swiggy order verification is available only after partner access and user authorization; this sample walkthrough does not claim a real order or refund.”

## What counts as real usage

- **Deployed product flow:** a real user signs in and submits their own complaint to the deployed service. Get their permission before recording or sharing it.
- **Sample scenario:** fictional complaint text used to demonstrate the flow. Label it as a sample; it proves the product interaction, not customer adoption or a verified platform outcome.
- **Live order scenario:** only claim this when the signed-in user authorized Swiggy, the app fetched an order from that account, and the UI indicates the order-history verification source.
- **Resolved complaint:** only say the external issue was resolved when the external platform confirms it. ResolveAI's local status alone means the user marked the item complete in the app.

## Swiggy access checklist

Live order verification needs Swiggy to approve the integration and allowlist the exact HTTPS callback, followed by the user's own OAuth consent. The deployed callback is:

```text
https://resolveai-backend-55w1.onrender.com/api/swiggy/callback
```

Once approval is granted, test with your own account and a low-risk example. Do not put Swiggy credentials, OAuth tokens, Supabase service-role keys, or API keys in frontend code, screenshots, recordings, or this repository.

## Interview questions to prepare for

- **How do you prevent made-up order details?** Order details are only shown after retrieving and matching account-authorized order history; otherwise the app communicates that verification is unavailable.
- **How is complaint history separated between people?** Supabase Auth identifies the user; Postgres row-level security scopes complaint rows by that user ID. The browser also keeps an account-scoped continuity copy.
- **Does ResolveAI issue refunds?** No. It guides the user through supported next steps and does not claim an external action succeeded without platform confirmation.
- **What is still pending?** Swiggy partner approval/allowlisting for live access, plus any external action that Swiggy does not expose through the authorized integration.
