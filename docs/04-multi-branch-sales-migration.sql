-- Migration: branch-aware sales and per-branch sale sequence
-- Date: 2026-05-12
-- Applies to tables used by receivable sales flow.

BEGIN;

-- 1) Add branch fields to receivables.
ALTER TABLE receivables
  ADD COLUMN IF NOT EXISTS branch_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS branch_name VARCHAR(100);

-- 2) Backfill legacy rows as CANCUN.
UPDATE receivables
SET branch_code = 'CANCUN',
    branch_name = 'CANCUN'
WHERE branch_code IS NULL;

-- 3) Enforce branch required.
ALTER TABLE receivables
  ALTER COLUMN branch_code SET NOT NULL;

-- 4) Ensure per-branch numbering uniqueness.
CREATE UNIQUE INDEX IF NOT EXISTS uq_receivables_company_branch_sale_number
  ON receivables(company_id, branch_code, sale_number)
  WHERE sale_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_receivables_company_branch_sale_code
  ON receivables(company_id, branch_code, sale_code)
  WHERE sale_code IS NOT NULL;

-- 5) Propagate branch to child tables when column exists.
ALTER TABLE receivable_installments
  ADD COLUMN IF NOT EXISTS branch_code VARCHAR(20);

UPDATE receivable_installments ri
SET branch_code = r.branch_code
FROM receivables r
WHERE r.id = ri.receivable_id
  AND ri.branch_code IS NULL;

ALTER TABLE sale_items
  ADD COLUMN IF NOT EXISTS branch_code VARCHAR(20);

UPDATE sale_items si
SET branch_code = r.branch_code
FROM receivables r
WHERE r.id = si.receivable_id
  AND si.branch_code IS NULL;

COMMIT;
