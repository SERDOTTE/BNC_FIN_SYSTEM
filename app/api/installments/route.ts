import { NextResponse } from "next/server";

import { companyIdFromEnv, readCurrency, readFirstString, readNumber, serviceRoleKey, supabaseSelect, type SupabaseRow } from "@/lib/server/supabase-admin";

type InstallmentRow = SupabaseRow & {
  receivables?: SupabaseRow | null;
};

export async function GET() {
  if (!serviceRoleKey()) {
    return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });
  }

  const companyId = companyIdFromEnv();
  const companyFilter = companyId ? `&company_id=eq.${encodeURIComponent(companyId)}` : "";

  try {
    const rows = await supabaseSelect<InstallmentRow>(
      `receivable_installments?select=*,receivables(customer_name,status)&order=due_date.asc${companyFilter}`
    );

    return NextResponse.json(
      rows.map((row) => ({
        id: readFirstString(row, ["id"]),
        receivableId: readFirstString(row, ["receivable_id"]),
        receivableStatus: readFirstString((row.receivables as SupabaseRow | null) ?? {}, ["status"]) || "OPEN",
        title: `Parcela ${readNumber(row, ["installment_number"])}`,
        customerName: readFirstString((row.receivables as SupabaseRow | null) ?? {}, ["customer_name"]),
        installmentNumber: readNumber(row, ["installment_number"]),
        amountContract: readNumber(row, ["amount"]),
        currencyContract: readCurrency(row, ["currency"]),
        projectedAmountBrlBase: readNumber(row, ["amount"]),
        dueDate: readFirstString(row, ["due_date"]).slice(0, 10),
        status: readFirstString(row, ["status"]) || "PENDING"
      }))
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao listar parcelas.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}