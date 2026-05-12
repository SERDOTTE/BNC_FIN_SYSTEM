-- Migration: branch-aware passeios
-- Date: 2026-05-12
-- Goal: assign all existing passeios to CANCUN and prepare branch-specific selection.

BEGIN;

ALTER TABLE passeios
  ADD COLUMN IF NOT EXISTS branch_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS branch_name VARCHAR(100);

UPDATE passeios
SET branch_code = 'CANCUN',
    branch_name = 'CANCUN'
WHERE branch_code IS NULL;

ALTER TABLE passeios
  ALTER COLUMN branch_code SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_passeios_company_branch_name
  ON passeios(branch_code, nome_passeio);

CREATE INDEX IF NOT EXISTS idx_passeios_branch_code
  ON passeios(branch_code);

COMMIT;
