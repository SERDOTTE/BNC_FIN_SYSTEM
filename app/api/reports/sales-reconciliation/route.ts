import { NextRequest, NextResponse } from "next/server";

import { companyIdFromEnv, readFirstString, readNumber, serviceRoleKey, supabaseSelect, type SupabaseRow } from "@/lib/server/supabase-admin";

type InstallmentRow = SupabaseRow;

type SaleRow = SupabaseRow & {
  receivable_installments?: InstallmentRow[];
};

export async function GET(request: NextRequest) {
  if (!serviceRoleKey()) {
    return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });
  }

  const { searchParams } = request.nextUrl;
  const month = searchParams.get("month"); // expects YYYY-MM

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Parâmetro 'month' inválido. Use o formato YYYY-MM." }, { status: 400 });
  }

  const [year, mon] = month.split("-").map(Number);
  const dateFrom = `${year}-${String(mon).padStart(2, "0")}-01`;
  const nextMonth = mon === 12 ? `${year + 1}-01-01` : `${year}-${String(mon + 1).padStart(2, "0")}-01`;

  const companyId = companyIdFromEnv();
  const companyFilter = companyId ? `&company_id=eq.${encodeURIComponent(companyId)}` : "";

  try {
    const rows = await supabaseSelect<SaleRow>(
      `receivables?select=*,receivable_installments(*)&sale_date=gte.${dateFrom}&sale_date=lt.${nextMonth}&status=neq.CANCELED&order=sale_date.asc,sale_number.asc${companyFilter}`
    );

    const sales = rows.map((row) => {
      const installments = ((row.receivable_installments as InstallmentRow[]) ?? []).map((inst) => ({
        id: readFirstString(inst, ["id"]),
        installmentNumber: readNumber(inst, ["installment_number"]),
        amountUsd: readNumber(inst, ["amount_contract", "amount"]),
        amountBrl: readNumber(inst, ["projected_amount_brl_base"]) || readNumber(inst, ["amount_contract", "amount"]),
        dueDate: readFirstString(inst, ["due_date"]).slice(0, 10),
        status: (readFirstString(inst, ["status"]) || "PENDING") as string,
        paymentDate: inst.payment_date ? String(inst.payment_date).slice(0, 10) : undefined,
      }));

      const fxRate = row.fx_rate_usd_brl != null ? Number(row.fx_rate_usd_brl) : undefined;
      const totalAmount = readNumber(row, ["total_amount"]);
      const currency = readFirstString(row, ["currency"]) || "USD";
      const totalAmountBrl =
        currency === "BRL"
          ? totalAmount
          : fxRate && fxRate > 0
          ? Number((totalAmount * fxRate).toFixed(2))
          : installments.reduce((s, i) => s + i.amountBrl, 0);

      return {
        id: readFirstString(row, ["id"]),
        saleCode: readFirstString(row, ["sale_code"]) || undefined,
        saleNumber: row.sale_number != null ? Number(row.sale_number) : undefined,
        customerName: readFirstString(row, ["customer_name"]),
        saleDate: readFirstString(row, ["sale_date"]).slice(0, 10),
        totalAmount,
        currency,
        fxRateUsdBrl: fxRate,
        totalAmountBrl,
        meioPagamentoNome: readFirstString(row, ["meio_pagamento_nome"]) || undefined,
        accountName: readFirstString(row, ["account_name"]) || undefined,
        status: readFirstString(row, ["status"]) || "OPEN",
        installments,
      };
    });

    return NextResponse.json({ month, sales });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao gerar relatório.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
