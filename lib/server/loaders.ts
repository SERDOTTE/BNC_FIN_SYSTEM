import type { Account, Installment, LookupOption, Payable, PasseioOption, Receivable, Supplier } from "@/lib/types";
import { fallbackBranchDefinition, resolveBranchDefinition } from "@/lib/branches";
import { buildDailyCashFlow, buildDashboardData, buildDashboardMonthlyBreakdown, buildReportsData } from "@/lib/server/finance";
import { companyIdFromEnv, readCurrency, readFirstString, readNumber, supabaseSelect, toIsoDate, type SupabaseRow } from "@/lib/server/supabase-admin";

type InstallmentRow = SupabaseRow & {
  receivables?: SupabaseRow | null;
};

function withCompanyFilter(path: string) {
  const companyId = companyIdFromEnv();
  if (!companyId) {
    return path;
  }

  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}company_id=eq.${encodeURIComponent(companyId)}`;
}

export async function listAccountsServer(): Promise<Account[]> {
  const rows = await supabaseSelect<SupabaseRow>(withCompanyFilter("accounts?select=*&is_active=eq.true&order=name.asc"));
  return rows.map((row) => ({
    id: readFirstString(row, ["id"]),
    name: readFirstString(row, ["name"]),
    type: readFirstString(row, ["type"]) as Account["type"],
    baseCurrency: readCurrency(row, ["base_currency"]),
    balance: 0
  }));
}

export async function listFornecedoresServer(): Promise<Supplier[]> {
  const rows = await supabaseSelect<SupabaseRow>(withCompanyFilter("fornecedores?select=id,nome&is_active=eq.true&order=nome.asc"));
  return rows
    .map((row) => ({
      id: readFirstString(row, ["id"]),
      name: readFirstString(row, ["nome"])
    }))
    .filter((item) => item.id && item.name);
}

export async function listPasseiosServer(): Promise<PasseioOption[]> {
  const queries = [
    withCompanyFilter("passeios?select=*&order=nome_passeio.asc"),
    withCompanyFilter("passeios?select=*&order=nome.asc"),
    "passeios?select=*&order=nome_passeio.asc",
    "passeios?select=*&order=nome.asc"
  ];

  for (const query of queries) {
    try {
      const rows = await supabaseSelect<SupabaseRow>(query);
      return rows
        .map((row) => ({
          id: readFirstString(row, ["id_passeio", "id"]),
          name: readFirstString(row, ["nome_passeio", "nome", "name"]),
          branchCode: (resolveBranchDefinition(row.branch_code ?? row.branch_name) ?? fallbackBranchDefinition()).code,
          branchLabel: (resolveBranchDefinition(row.branch_code ?? row.branch_name) ?? fallbackBranchDefinition()).label
        }))
        .filter((item) => item.id && item.name);
    } catch {
      // Try next query shape for schema compatibility.
    }
  }

  return [];
}

export async function listReceivablesServer(): Promise<Receivable[]> {
  const rows = await supabaseSelect<SupabaseRow>(withCompanyFilter("receivables?select=*&order=created_at.desc"));
  return rows.map((row) => {
    const branch = resolveBranchDefinition(row.branch_code ?? row.branch_name) ?? fallbackBranchDefinition();

    return {
      id: readFirstString(row, ["id"]),
      branchCode: branch.code,
      branchLabel: branch.label,
      customerName: readFirstString(row, ["customer_name"]),
      sellerId: readFirstString(row, ["seller_id"]) || undefined,
      sellerName: readFirstString(row, ["seller_name"]) || undefined,
      saleCode: readFirstString(row, ["sale_code"]) || undefined,
      saleNumber: readNumber(row, ["sale_number"]) || undefined,
      description: readFirstString(row, ["description"]) || undefined,
      totalAmount: readNumber(row, ["total_amount"]),
      currency: readCurrency(row, ["currency"]),
      saleDate: toIsoDate(row.sale_date),
      installmentsCount: readNumber(row, ["installments_count"]),
      status: (readFirstString(row, ["status"]) || "OPEN") as Receivable["status"]
    };
  });
}

export async function listInstallmentsServer(): Promise<Installment[]> {
  const rows = await supabaseSelect<InstallmentRow>(
    withCompanyFilter("receivable_installments?select=*,receivables(customer_name,status)&order=due_date.asc")
  );

  return rows.map((row) => ({
    id: readFirstString(row, ["id"]),
    receivableId: readFirstString(row, ["receivable_id"]),
    receivableStatus: (readFirstString((row.receivables as SupabaseRow | null) ?? {}, ["status"]) || "OPEN") as Installment["receivableStatus"],
    installmentCode: readFirstString(row, ["installment_code"]) || undefined,
    title: `Parcela ${readNumber(row, ["installment_number"])}`,
    customerName: readFirstString((row.receivables as SupabaseRow | null) ?? {}, ["customer_name"]),
    installmentNumber: readNumber(row, ["installment_number"]),
    amountContract: readNumber(row, ["amount_contract", "amount"]),
    currencyContract: readCurrency(row, ["currency_contract", "currency"]),
    projectedAmountBrlBase: readNumber(row, ["projected_amount_brl_base", "amount_contract", "amount"]),
    dueDate: toIsoDate(row.due_date),
    status: (readFirstString(row, ["status"]) || "PENDING") as Installment["status"]
  }));
}

export async function listPayablesServer(): Promise<Payable[]> {
  const rows = await supabaseSelect<SupabaseRow>(withCompanyFilter("payables?select=*&order=due_date.asc"));
  return rows.map((row) => ({
    id: readFirstString(row, ["id"]),
    supplierName: readFirstString(row, ["supplier_name"]),
    amountContract: readNumber(row, ["amount"]),
    currencyContract: readCurrency(row, ["currency"]),
    projectedAmountBrlBase: readNumber(row, ["amount"]),
    dueDate: toIsoDate(row.due_date),
    status: (readFirstString(row, ["status"]) || "PENDING") as Payable["status"]
  }));
}

export { buildDashboardData, buildDailyCashFlow, buildReportsData, buildDashboardMonthlyBreakdown };