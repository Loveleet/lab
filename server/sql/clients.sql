-- Clients table for LAB client management (olab database)
CREATE TABLE IF NOT EXISTS clients (
  id                  SERIAL PRIMARY KEY,
  first_name          TEXT NOT NULL,
  last_name           TEXT NOT NULL,
  phone_number        TEXT,
  email               TEXT UNIQUE,
  telegram_id         TEXT,
  exchange            TEXT NOT NULL DEFAULT 'binance',
  binance_api_key     TEXT,
  binance_secret_key  TEXT,
  investment          NUMERIC(18, 2) DEFAULT 0,
  is_active           BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Existing DBs: add exchange if missing
ALTER TABLE clients ADD COLUMN IF NOT EXISTS exchange TEXT NOT NULL DEFAULT 'binance';

CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_active ON clients(is_active);
CREATE INDEX IF NOT EXISTS idx_clients_exchange ON clients(exchange);
