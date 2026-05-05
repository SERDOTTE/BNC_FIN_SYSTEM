import { NextRequest, NextResponse } from "next/server";

import { createPayableRecord } from "@/lib/server/settlements";
import { companyIdFromEnv, readCurrency, readFirstString, readNumber, serviceRoleKey, supabaseSelect, toIsoDate, type SupabaseRow } from "@/lib/server/supabase-admin";

export async function GET() {
  if (!serviceRoleKey()) {
    return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });
  }

  const companyId = companyIdFromEnv();
  const companyFilter = companyId ? `&company_id=eq.${encodeURIComponent(companyId)}` : "";

  try {
    const rows = await supabaseSelect<SupabaseRow>(
      `payables?select=*&order=due_date.asc${companyFilter}`
    );

    return NextResponse.json(
      rows.map((row) => ({
        id: readFirstString(row, ["id"]),
        supplierName: readFirstString(row, ["supplier_name"]),
        amountContract: readNumber(row, ["amount"]),
        currencyContract: readCurrency(row, ["currency"]),
        projectedAmountBrlBase: readNumber(row, ["amount"]),
        dueDate: toIsoDate(row.due_date),
        status: readFirstString(row, ["status"]) || "PENDING"
      }))
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar payables.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type CreatePayableBody = {
  supplierName?: string;
  description?: string;
  amount?: number;
  currency?: string;
  dueDate?: string;
};

export async function POST(request: NextRequest) {
  if (!serviceRoleKey()) {
    return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });
  }

  let payload: CreatePayableBody;
  try {
    payload = (await request.json()) as CreatePayableBody;
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  if (!payload.supplierName || !payload.amount || !payload.currency || !payload.dueDate) {
    return NextResponse.json({ error: "Campos obrigatórios ausentes." }, { status: 400 });
  }

  try {
    const created = await createPayableRecord({
      supplierName: payload.supplierName,
      description: payload.description,
      amount: payload.amount,
      currency: payload.currency,
      dueDate: payload.dueDate
    });

    return NextResponse.json(created);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao criar payable.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}