-- Audit script for multi-branch sales after migration
-- Use this after deploying the branch-aware flow.

-- 1) Sales distribution by branch.
select
  branch_code,
  count(*) as total_sales,
  min(sale_number) as min_sale_number,
  max(sale_number) as max_sale_number,
  min(sale_code) as min_sale_code,
  max(sale_code) as max_sale_code
from receivables
group by branch_code
order by branch_code;

-- 2) Legacy sales that are still not assigned to CANCUN.
select
  id,
  customer_name,
  sale_number,
  sale_code,
  branch_code,
  branch_name,
  created_at
from receivables
where branch_code is distinct from 'CANCUN'
order by created_at desc;

-- 3) Check if sale_code matches the expected prefix per branch.
select
  id,
  customer_name,
  branch_code,
  sale_number,
  sale_code,
  case
    when branch_code = 'CANCUN' and sale_code like 'CCN.%' then 'OK'
    when branch_code = 'PUNTA_CANA' and sale_code like 'PCN.%' then 'OK'
    else 'MISMATCH'
  end as prefix_check
from receivables
where sale_number is not null
order by created_at desc;

-- 4) Find duplicate sale numbers per branch.
select
  branch_code,
  sale_number,
  count(*) as occurrences
from receivables
where sale_number is not null
group by branch_code, sale_number
having count(*) > 1
order by branch_code, sale_number;

-- 5) Find duplicate sale codes per branch.
select
  branch_code,
  sale_code,
  count(*) as occurrences
from receivables
where sale_code is not null
group by branch_code, sale_code
having count(*) > 1
order by branch_code, sale_code;

-- 6) Check if child tables inherited the same branch.
select
  r.id as receivable_id,
  r.sale_code,
  r.branch_code as receivable_branch,
  (
    select count(*)
    from receivable_installments ri
    where ri.receivable_id = r.id
      and coalesce(ri.branch_code, '') <> coalesce(r.branch_code, '')
  ) as installment_branch_mismatches,
  (
    select count(*)
    from sale_items si
    where si.receivable_id = r.id
      and coalesce(si.branch_code, '') <> coalesce(r.branch_code, '')
  ) as item_branch_mismatches
from receivables r
where exists (
  select 1
  from receivable_installments ri
  where ri.receivable_id = r.id
    and coalesce(ri.branch_code, '') <> coalesce(r.branch_code, '')
)
or exists (
  select 1
  from sale_items si
  where si.receivable_id = r.id
    and coalesce(si.branch_code, '') <> coalesce(r.branch_code, '')
)
order by r.created_at desc;

-- 7) Sales missing sale_code or sale_number.
select
  id,
  customer_name,
  branch_code,
  sale_number,
  sale_code,
  created_at
from receivables
where sale_number is null
   or sale_code is null
order by created_at desc;

-- 8) Suggested next code for each branch.
with branch_last as (
  select branch_code, max(sale_number) as last_sale_number
  from receivables
  group by branch_code
)
select
  branch_code,
  coalesce(last_sale_number, 0) + 1 as next_sale_number,
  case
    when branch_code = 'CANCUN' then 'CCN.' || lpad((coalesce(last_sale_number, 0) + 1)::text, 3, '0')
    when branch_code = 'PUNTA_CANA' then 'PCN.' || lpad((coalesce(last_sale_number, 0) + 1)::text, 3, '0')
    else null
  end as next_sale_code
from branch_last
order by branch_code;
