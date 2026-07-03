# Chaslay Digital Receipts API

Stores digital receipts and serves them at `https://pay.chaslay.com/receipts/{id}`.
The FoodTruck POS app publishes receipts and sends customer emails through this service.

## Quick start

```bash
cd server/chaslay-receipts
cp .env.example .env
# edit .env � set API_KEY to match BuildConfig.SYNC_API_KEY in the Android app
# configure SMTP_* settings for your mail server
npm install
npm start
```

## SMTP configuration (.env)

| Variable | Example | Description |
|----------|---------|-------------|
| `SMTP_HOST` | `smtp.gmail.com` | Mail server hostname |
| `SMTP_PORT` | `587` | Usually 587 (STARTTLS) or 465 (SSL) |
| `SMTP_SECURE` | `false` | Set `true` for port 465 |
| `SMTP_USER` | `noreply@chaslay.com` | SMTP login |
| `SMTP_PASS` | `your-password` | SMTP password or app password |
| `SMTP_FROM_EMAIL` | `noreply@chaslay.com` | From address shown to customers |
| `SMTP_FROM_NAME` | `Chaslay` | From display name |

## Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/v1/receipts` | `X-Api-Key` | POS publishes receipt JSON |
| POST | `/v1/receipts/:id/email` | `X-Api-Key` | Send receipt link via SMTP |
| GET | `/v1/receipts/:id` | none | JSON receipt |
| GET | `/receipts/:id` | none | HTML receipt page for customers |
| GET | `/health` | none | Health check |

## Production layout (recommended)

```
api.chaslay.com   ? proxy to this Node service (port 8080)
pay.chaslay.com   ? same service, path /receipts/*
```

Mount `./data/receipts` as a persistent volume.

## Android app settings

In POS **Settings ? Receipt base URL**, use:

```
https://pay.chaslay.com/receipts
```

The app POSTs to `https://api.chaslay.com/v1/receipts` (same `LICENSE_API_BASE_URL` + `X-Api-Key`).
