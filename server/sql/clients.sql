-- Clients: one person; exchange credentials live in client_exchange_accounts
CREATE TABLE IF NOT EXISTS clients (
  id                  SERIAL PRIMARY KEY,
  first_name          TEXT NOT NULL,
  last_name           TEXT NOT NULL,
  phone_number        TEXT,
  email               TEXT UNIQUE,
  telegram_id         TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_exchange_accounts (
  id                  SERIAL PRIMARY KEY,
  client_id           INT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  exchange            TEXT NOT NULL,
  api_key             TEXT,
  secret_key          TEXT,
  investment          NUMERIC(18, 2) DEFAULT 0,
  is_active           BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, exchange)
);

-- Legacy DBs that still have exchange/API columns on clients: migrate once into accounts
ALTER TABLE clients ADD COLUMN IF NOT EXISTS exchange TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS binance_api_key TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS binance_secret_key TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS investment NUMERIC(18, 2) DEFAULT 0;

INSERT INTO client_exchange_accounts (client_id, exchange, api_key, secret_key, investment, is_active)
SELECT
  c.id,
  COALESCE(NULLIF(LOWER(TRIM(c.exchange)), ''), 'binance'),
  c.binance_api_key,
  c.binance_secret_key,
  COALESCE(c.investment, 0),
  COALESCE(c.is_active, FALSE)
FROM clients c
WHERE NOT EXISTS (
  SELECT 1 FROM client_exchange_accounts a WHERE a.client_id = c.id
)
ON CONFLICT (client_id, exchange) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_active ON clients(is_active);
CREATE INDEX IF NOT EXISTS idx_client_exchange_accounts_client ON client_exchange_accounts(client_id);
CREATE INDEX IF NOT EXISTS idx_client_exchange_accounts_exchange ON client_exchange_accounts(exchange);
