import { NextRequest, NextResponse } from "next/server";

import { settleOrigin } from "@/lib/server/settlements";
import { serviceRoleKey } from "@/lib/server/supabase-admin";

type PayBody = {
  accountId?: string;
  paidAt?: string;
  description?: string;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!serviceRoleKey()) {
    return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });
  }

  const { id } = await params;

  let payload: PayBody;
  try {
    payload = (await request.json()) as PayBody;
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  if (!payload.accountId || !payload.paidAt) {
    return NextResponse.json({ error: "Campos obrigatórios ausentes." }, { status: 400 });
  }

  try {
    const transactionId = await settleOrigin({
      table: "receivable_installments",
      rowId: id,
      accountId: payload.accountId,
      paidAt: payload.paidAt,
      description: payload.description,
      originType: "RECEIVABLE_INSTALLMENT",
      direction: "IN"
    });

    return NextResponse.json({ installmentId: id, transactionId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao liquidar parcela.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}