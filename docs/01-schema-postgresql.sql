-- Financial flow control database schema
-- Stack target: PostgreSQL 15+
-- Notes:
-- 1) Transactions are immutable (reversal instead of updates).
-- 2) Realized cash flow stays in transactions; projected flow stays in cash_forecasts.
-- 3) Multi-tenant ready via company_id in all business tables.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================
-- ENUMS
-- =========================
CREATE TYPE account_type AS ENUM ('BANK', 'CASH', 'WALLET', 'OTHER');
CREATE TYPE payable_status AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELED');
CREATE TYPE receivable_status AS ENUM ('OPEN', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELED');
CREATE TYPE installment_status AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELED');
CREATE TYPE transaction_direction AS ENUM ('IN', 'OUT');
CREATE TYPE transaction_origin_type AS ENUM (
  'MANUAL',
  'RECEIVABLE_INSTALLMENT',
  'PAYABLE',
  'REVERSAL',
  'ADJUSTMENT'
);
CREATE TYPE forecast_direction AS ENUM ('IN', 'OUT');
CREATE TYPE forecast_status AS ENUM ('PENDING', 'REALIZED', 'CANCELED');
CREATE TYPE idempotency_status AS ENUM ('IN_PROGRESS', 'COMPLETED', 'FAILED');

-- =========================
-- HELPERS
-- =========================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION block_mutation_on_transactions()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'transactions are immutable; create a reversal transaction instead';
END;
$$ LANGUAGE plpgsql;

-- =========================
-- CORE TENANCY / USERS
-- =========================
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name VARCHAR(180) NOT NULL,
  tax_id VARCHAR(30),
  default_currency CHAR(3) NOT NULL CHECK (default_currency ~ '^[A-Z]{3}$'),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  full_name VARCHAR(180) NOT NULL,
  email VARCHAR(180) NOT NULL,
  role VARCHAR(50) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, email)
);

CREATE TRIGGER trg_companies_updated_at
BEFORE UPDATE ON companies
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_app_users_updated_at
BEFORE UPDATE ON app_users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================
-- ACCOUNTS
-- =========================
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  name VARCHAR(100) NOT NULL,
  type account_type NOT NULL,
  base_currency CHAR(3) NOT NULL CHECK (base_currency ~ '^[A-Z]{3}$'),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, id),
  UNIQUE (company_id, name)
);

CREATE INDEX idx_accounts_company ON accounts(company_id);

CREATE TRIGGER trg_accounts_updated_at
BEFORE UPDATE ON accounts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================
-- EXCHANGE RATES
-- =========================
CREATE TABLE exchange_rate_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES exchange_rate_providers(id),
  from_currency CHAR(3) NOT NULL CHECK (from_currency ~ '^[A-Z]{3}$'),
  to_currency CHAR(3) NOT NULL CHECK (to_currency ~ '^[A-Z]{3}$'),
  rate NUMERIC(18,8) NOT NULL CHECK (rate > 0),
  valid_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider_id, from_currency, to_currency, valid_at)
);

CREATE INDEX idx_exchange_rates_pair_time
  ON exchange_rates(from_currency, to_currency, valid_at DESC);

-- =========================
-- RECEIVABLES / INSTALLMENTS
-- =========================
CREATE TABLE receivables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  customer_name VARCHAR(180) NOT NULL,
  description TEXT,
  total_amount NUMERIC(18,2) NOT NULL CHECK (total_amount > 0),
  currency CHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  sale_date DATE NOT NULL,
  installments_count INTEGER NOT NULL CHECK (installments_count > 0),
  status receivable_status NOT NULL DEFAULT 'OPEN',
  created_by UUID REFERENCES app_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, id)
);

CREATE INDEX idx_receivables_company_status ON receivables(company_id, status);
CREATE INDEX idx_receivables_company_sale_date ON receivables(company_id, sale_date);

CREATE TRIGGER trg_receivables_updated_at
BEFORE UPDATE ON receivables
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE receivable_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  receivable_id UUID NOT NULL,
  installment_number INTEGER NOT NULL CHECK (installment_number > 0),
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  due_date DATE NOT NULL,
  status installment_status NOT NULL DEFAULT 'PENDING',
  payment_date TIMESTAMPTZ,
  transaction_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_installment_receivable_company
    FOREIGN KEY (company_id, receivable_id)
    REFERENCES receivables(company_id, id)
    ON DELETE CASCADE,
  UNIQUE (company_id, id),
  UNIQUE (receivable_id, installment_number)
);

CREATE INDEX idx_installments_company_due_status
  ON receivable_installments(company_id, due_date, status);

CREATE TRIGGER trg_installments_updated_at
BEFORE UPDATE ON receivable_installments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================
-- PAYABLES
-- =========================
CREATE TABLE payables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  supplier_name VARCHAR(180) NOT NULL,
  description TEXT,
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  due_date DATE NOT NULL,
  status payable_status NOT NULL DEFAULT 'PENDING',
  payment_date TIMESTAMPTZ,
  transaction_id UUID,
  created_by UUID REFERENCES app_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, id)
);

CREATE INDEX idx_payables_company_due_status
  ON payables(company_id, due_date, status);

CREATE TRIGGER trg_payables_updated_at
BEFORE UPDATE ON payables
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================
-- REALIZED TRANSACTIONS (IMMUTABLE LEDGER)
-- =========================
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  account_id UUID NOT NULL,
  direction transaction_direction NOT NULL,

  amount_original NUMERIC(18,2) NOT NULL CHECK (amount_original > 0),
  currency_original CHAR(3) NOT NULL CHECK (currency_original ~ '^[A-Z]{3}$'),

  exchange_rate_id UUID REFERENCES exchange_rates(id),
  exchange_rate NUMERIC(18,8) NOT NULL CHECK (exchange_rate > 0),
  amount_converted NUMERIC(18,2) NOT NULL CHECK (amount_converted > 0),
  currency_converted CHAR(3) NOT NULL CHECK (currency_converted ~ '^[A-Z]{3}$'),

  occurred_at TIMESTAMPTZ NOT NULL,
  description TEXT,

  origin_type transaction_origin_type NOT NULL,
  origin_id UUID,

  reversal_of_transaction_id UUID REFERENCES transactions(id),

  created_by UUID REFERENCES app_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_transactions_account_company
    FOREIGN KEY (company_id, account_id)
    REFERENCES accounts(company_id, id),

  CONSTRAINT ck_transaction_origin_id_required
    CHECK (
      (origin_type IN ('MANUAL', 'ADJUSTMENT') AND origin_id IS NULL)
      OR
      (origin_type IN ('RECEIVABLE_INSTALLMENT', 'PAYABLE', 'REVERSAL') AND origin_id IS NOT NULL)
    ),

  CONSTRAINT ck_transaction_reversal
    CHECK (
      (origin_type = 'REVERSAL' AND reversal_of_transaction_id IS NOT NULL)
      OR
      (origin_type <> 'REVERSAL' AND reversal_of_transaction_id IS NULL)
    )
);

CREATE INDEX idx_transactions_company_time
  ON transactions(company_id, occurred_at);

CREATE INDEX idx_transactions_company_account_time
  ON transactions(company_id, account_id, occurred_at);

CREATE INDEX idx_transactions_origin
  ON transactions(origin_type, origin_id);

CREATE UNIQUE INDEX uq_transactions_reversal_once
  ON transactions(reversal_of_transaction_id)
  WHERE reversal_of_transaction_id IS NOT NULL;

CREATE TRIGGER trg_transactions_no_update
BEFORE UPDATE ON transactions
FOR EACH ROW EXECUTE FUNCTION block_mutation_on_transactions();

CREATE TRIGGER trg_transactions_no_delete
BEFORE DELETE ON transactions
FOR EACH ROW EXECUTE FUNCTION block_mutation_on_transactions();

ALTER TABLE receivable_installments
  ADD CONSTRAINT fk_installment_transaction
  FOREIGN KEY (transaction_id)
  REFERENCES transactions(id);

ALTER TABLE payables
  ADD CONSTRAINT fk_payable_transaction
  FOREIGN KEY (transaction_id)
  REFERENCES transactions(id);

-- =========================
-- FORECASTS (PROJECTED FLOW)
-- =========================
CREATE TABLE cash_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  account_id UUID,
  direction forecast_direction NOT NULL,

  amount_original NUMERIC(18,2) NOT NULL CHECK (amount_original > 0),
  currency_original CHAR(3) NOT NULL CHECK (currency_original ~ '^[A-Z]{3}$'),

  exchange_rate_id UUID REFERENCES exchange_rates(id),
  exchange_rate NUMERIC(18,8) CHECK (exchange_rate > 0),
  amount_converted NUMERIC(18,2) CHECK (amount_converted > 0),
  currency_converted CHAR(3) CHECK (currency_converted ~ '^[A-Z]{3}$'),

  forecast_date DATE NOT NULL,
  status forecast_status NOT NULL DEFAULT 'PENDING',

  origin_type transaction_origin_type NOT NULL,
  origin_id UUID NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_forecasts_account_company
    FOREIGN KEY (company_id, account_id)
    REFERENCES accounts(company_id, id)
);

CREATE INDEX idx_forecasts_company_date_status
  ON cash_forecasts(company_id, forecast_date, status);

CREATE UNIQUE INDEX uq_forecasts_origin_pending
  ON cash_forecasts(company_id, origin_type, origin_id)
  WHERE status = 'PENDING';

-- =========================
-- IDEMPOTENCY
-- =========================
CREATE TABLE idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  key_value VARCHAR(120) NOT NULL,
  endpoint VARCHAR(120) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  status idempotency_status NOT NULL DEFAULT 'IN_PROGRESS',
  response_code INTEGER,
  response_body JSONB,
  created_by UUID REFERENCES app_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE (company_id, key_value, endpoint)
);

CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);

-- =========================
-- AUDIT LOG
-- =========================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  entity VARCHAR(80) NOT NULL,
  entity_id UUID,
  action VARCHAR(80) NOT NULL,
  actor_user_id UUID REFERENCES app_users(id),
  request_id VARCHAR(80),
  ip_address VARCHAR(64),
  user_agent TEXT,
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_company_entity_time
  ON audit_logs(company_id, entity, created_at DESC);

-- =========================
-- OUTBOX EVENTS (INTEGRATIONS)
-- =========================
CREATE TABLE outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  aggregate_type VARCHAR(80) NOT NULL,
  aggregate_id UUID NOT NULL,
  event_type VARCHAR(120) NOT NULL,
  payload JSONB NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);

CREATE INDEX idx_outbox_publish_queue
  ON outbox_events(published_at, occurred_at)
  WHERE published_at IS NULL;

-- =========================
-- REPORTING VIEWS
-- =========================
CREATE VIEW v_cash_flow_realized_daily AS
SELECT
  company_id,
  DATE(occurred_at) AS flow_date,
  currency_converted,
  SUM(CASE WHEN direction = 'IN' THEN amount_converted ELSE 0 END) AS total_in,
  SUM(CASE WHEN direction = 'OUT' THEN amount_converted ELSE 0 END) AS total_out,
  SUM(CASE WHEN direction = 'IN' THEN amount_converted ELSE -amount_converted END) AS net
FROM transactions
GROUP BY company_id, DATE(occurred_at), currency_converted;

CREATE VIEW v_cash_flow_projected_daily AS
SELECT
  company_id,
  forecast_date AS flow_date,
  COALESCE(currency_converted, currency_original) AS currency,
  SUM(CASE WHEN direction = 'IN' THEN COALESCE(amount_converted, amount_original) ELSE 0 END) AS total_in,
  SUM(CASE WHEN direction = 'OUT' THEN COALESCE(amount_converted, amount_original) ELSE 0 END) AS total_out,
  SUM(CASE WHEN direction = 'IN' THEN COALESCE(amount_converted, amount_original)
           ELSE -COALESCE(amount_converted, amount_original) END) AS net
FROM cash_forecasts
WHERE status = 'PENDING'
GROUP BY company_id, forecast_date, COALESCE(currency_converted, currency_original);

-- =============================================================================
-- MIGRATION: sale_items, passeio_fornecedor, and receivables new columns
-- Run this in the Supabase SQL Editor (or any PostgreSQL client).
-- =============================================================================

ALTER TABLE receivables
  ADD COLUMN IF NOT EXISTS seller_id         TEXT,
  ADD COLUMN IF NOT EXISTS seller_name       TEXT,
  ADD COLUMN IF NOT EXISTS fx_rate_usd_brl   NUMERIC(18,8),
  ADD COLUMN IF NOT EXISTS adultos           INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS criancas          INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS sale_items (
  id                     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id             UUID         NOT NULL REFERENCES companies(id),
  receivable_id          UUID         NOT NULL REFERENCES receivables(id) ON DELETE CASCADE,
  passeio_id             TEXT         NOT NULL,
  passeio_nome           TEXT         NOT NULL,
  fornecedor_id          TEXT         NOT NULL,
  fornecedor_nome        TEXT         NOT NULL,
  adultos                INTEGER      NOT NULL DEFAULT 0,
  criancas               INTEGER      NOT NULL DEFAULT 0,
  custo_unitario_adulto  NUMERIC(18,2) NOT NULL DEFAULT 0,
  custo_unitario_crianca NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_item             NUMERIC(18,2) NOT NULL DEFAULT 0,
  currency               CHAR(3)      NOT NULL,
  created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS passeio_fornecedor (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  passeio_id    TEXT         NOT NULL,
  fornecedor_id TEXT         NOT NULL,
  custo_adulto  NUMERIC(18,2) NOT NULL DEFAULT 0,
  custo_crianca NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (passeio_id, fornecedor_id)
);

-- =============================================================================
-- MIGRATION: sale_items, passeio_fornecedor, and receivables new columns
-- Run this in the Supabase SQL Editor (or any PostgreSQL client).
-- =============================================================================

ALTER TABLE receivables
  ADD COLUMN IF NOT EXISTS seller_id         TEXT,
  ADD COLUMN IF NOT EXISTS seller_name       TEXT,
  ADD COLUMN IF NOT EXISTS fx_rate_usd_brl   NUMERIC(18,8),
  ADD COLUMN IF NOT EXISTS adultos           INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS criancas          INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS sale_items (
  id                     UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id             UUID          NOT NULL REFERENCES companies(id),
  receivable_id          UUID          NOT NULL REFERENCES receivables(id) ON DELETE CASCADE,
  passeio_id             TEXT          NOT NULL,
  passeio_nome           TEXT          NOT NULL,
  fornecedor_id          TEXT          NOT NULL,
  fornecedor_nome        TEXT          NOT NULL,
  adultos                INTEGER       NOT NULL DEFAULT 0,
  criancas               INTEGER       NOT NULL DEFAULT 0,
  custo_unitario_adulto  NUMERIC(18,2) NOT NULL DEFAULT 0,
  custo_unitario_crianca NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_item             NUMERIC(18,2) NOT NULL DEFAULT 0,
  currency               CHAR(3)       NOT NULL,
  created_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS passeio_fornecedor (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  passeio_id    TEXT          NOT NULL,
  fornecedor_id TEXT          NOT NULL,
  custo_adulto  NUMERIC(18,2) NOT NULL DEFAULT 0,
  custo_crianca NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (passeio_id, fornecedor_id)
);

-- =============================================================================
-- MIGRATION: tabela fornecedores
-- Run this in the Supabase SQL Editor if a fornecedores table does not yet exist.
-- =============================================================================

CREATE TABLE IF NOT EXISTS fornecedores (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID         REFERENCES companies(id),
  nome       VARCHAR(180) NOT NULL,
  is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fornecedores_company ON fornecedores (company_id);

CREATE OR REPLACE TRIGGER trg_fornecedores_updated_at
BEFORE UPDATE ON fornecedores
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
