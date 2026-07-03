# Chaslay Digital Receipts API

Stores digital receipts and serves them at `https://pay.chaslay.com/receipts/{id}`.

Runs as the **`receipts`** Docker service from `backend/docker-compose.yml`.

## Config on Hetzner (WinSCP path)

```
/root/FoodTruckPOS/backend/receipts.env
```

Copy from `backend/receipts.env.example` if missing. Set `API_KEY` to match POS `SYNC_API_KEY`.

## Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/v1/receipts` | `X-Api-Key` | POS publishes receipt JSON |
| POST | `/v1/receipts/:id/email` | `X-Api-Key` | Send receipt link via SMTP |
| GET | `/v1/receipts/:id` | none | JSON receipt |
| GET | `/receipts/:id` | none | HTML receipt page |
| GET | `/health` | none | Health check |

## SMTP variables (in `backend/receipts.env`)

| Variable | Example |
|----------|---------|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `noreply@chaslay.com` |
| `SMTP_PASS` | app password |
| `SMTP_FROM_EMAIL` | `noreply@chaslay.com` |
