import { fetchOrCreateCompanyId, readCurrency, readFirstString, readNumber, supabaseInsert, supabasePatch, supabaseSelect, type SupabaseRow } from "@/lib/server/supabase-admin";

async function resolveExchangeRate(currency: string) {
  if (currency === "BRL") {
    return 1;
  }

  const rows = await supabaseSelect<SupabaseRow>(
    `exchange_rates?select=rate&from_currency=eq.${encodeURIComponent(currency)}&to_currency=eq.BRL&order=valid_at.desc&limit=1`
  );

  if (rows.length === 0) {
    return 1;
  }

  return readNumber(rows[0], ["rate"]) || 1;
}

async function fetchAccountBaseCurrency(accountId: string) {
  const rows = await supabaseSelect<SupabaseRow>(
    `accounts?select=base_currency&id=eq.${encodeURIComponent(accountId)}&limit=1`
  );

  if (rows.length === 0) {
    throw new Error("Conta de liquidação não encontrada no Supabase.");
  }

  return readCurrency(rows[0], ["base_currency"]);
}

export async function settleOrigin(params: {
  table: "payables" | "receivable_installments";
  rowId: string;
  accountId: string;
  paidAt: string;
  description?: string;
  originType: "PAYABLE" | "RECEIVABLE_INSTALLMENT";
  direction: "IN" | "OUT";
}) {
  const companyId = await fetchOrCreateCompanyId();
  const rows = await supabaseSelect<SupabaseRow>(
    `${params.table}?select=*&id=eq.${encodeURIComponent(params.rowId)}&limit=1`
  );

  if (rows.length === 0) {
    throw new Error("Registro não encontrado no Supabase.");
  }

  const row = rows[0];
  const originalCurrency = readCurrency(row, ["currency"]);
  const originalAmount = readNumber(row, ["amount"]);
  const accountCurrency = await fetchAccountBaseCurrency(params.accountId);
  const exchangeRate = originalCurrency === accountCurrency ? 1 : await resolveExchangeRate(originalCurrency);
  const amountConverted = Number((originalAmount * exchangeRate).toFixed(2));

  const transaction = await supabaseInsert<{ id: string }>("transactions", {
    company_id: companyId,
    account_id: params.accountId,
    direction: params.direction,
    amount_original: originalAmount,
    currency_original: originalCurrency,
    exchange_rate: exchangeRate,
    amount_converted: amountConverted,
    currency_converted: accountCurrency,
    occurred_at: params.paidAt,
    description: params.description ?? null,
    origin_type: params.originType,
    origin_id: params.rowId
  });

  await supabasePatch(
    `${params.table}?id=eq.${encodeURIComponent(params.rowId)}`,
    {
      status: "PAID",
      payment_date: params.paidAt,
      transaction_id: transaction.id
    }
  );

  return transaction.id;
}

export async function createPayableRecord(payload: {
  supplierName: string;
  description?: string;
  amount: number;
  currency: string;
  dueDate: string;
}) {
  const companyId = await fetchOrCreateCompanyId();
  const row = await supabaseInsert<SupabaseRow>("payables", {
    company_id: companyId,
    supplier_name: payload.supplierName,
    description: payload.description ?? null,
    amount: payload.amount,
    currency: payload.currency,
    due_date: payload.dueDate,
    status: "PENDING"
  });

  return {
    id: readFirstString(row, ["id"]),
    supplierName: readFirstString(row, ["supplier_name"]),
    amountContract: readNumber(row, ["amount"]),
    currencyContract: readCurrency(row, ["currency"]),
    projectedAmountBrlBase: readNumber(row, ["amount"]),
    dueDate: readFirstString(row, ["due_date"]),
    status: readFirstString(row, ["status"]) || "PENDING"
  };
}