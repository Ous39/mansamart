# MansaMart multi-channel notification system

## Delivery model

Every event is stored in the in-app inbox. The orchestration service classifies
the event, applies user preferences and quiet hours, then creates independent
delivery records for push, email and WhatsApp. Provider retries are safe because
events and channels have unique deduplication constraints.

## Priority policy

| Priority | Examples | Behaviour |
|---|---|---|
| Critical | Security, failed payment, refund, cancellation, arriving rider | May bypass quiet hours; email and opted-in WhatsApp allowed |
| High | New order, booking, message or delivery offer | Push immediately; unread WhatsApp escalation after five minutes |
| Normal | Routine order and booking progress | Respects category and quiet-hour preferences |
| Low | Deals and campaigns | Explicit opt-in; never bypasses quiet hours |

WhatsApp escalation is cancelled when the in-app notification is read. Sending
requires explicit account-level consent, a valid phone number and an approved
Meta template. Disabling WhatsApp clears permission for future sends; existing
delivery records will fail closed if consent is absent.

## Seller messaging

Incoming WhatsApp messages create a deduplicated seller notification and update
the conversation unread count. Seller replies are sent only from their connected
WhatsApp Business number. The dashboard reports response rate and average first
response time for the current conversation cycles.

## Operations

The API processes up to 50 due deliveries every 30 seconds. Failed email and
WhatsApp deliveries retry up to three times with bounded exponential backoff.
Meta status webhooks update sent, delivered and read timestamps. Do not log
access tokens or message bodies in infrastructure request logs.
