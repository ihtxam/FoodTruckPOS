-- Idempotent: merchant overview report email settings JSON column
-- Run: psql "$DATABASE_URL" -f backend/sql/ensure-report-email-settings.sql

ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS report_email_settings JSONB;
