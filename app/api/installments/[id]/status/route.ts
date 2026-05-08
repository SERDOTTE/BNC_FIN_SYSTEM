import { NextRequest, NextResponse } from "next/server";

import { readFirstString, serviceRoleKey, supabasePatch, type SupabaseRow } from "@/lib/server/supabase-admin";

type Body = {
  status?: string;
};

function normalizeStatus(status?: string) {
  const normalized = (status ?? "").trim().toUpperCase();

  if (normalized === "RECEBIDO") {
    return "PAID";
  }

  if (normalized === "RECEBER") {
    return "PENDING";
  }

  if (normalized === "ATRASO") {
    return "OVERDUE";
  }

  if (normalized === "PENDING" || normalized === "PAID" || normalized === "OVERDUE" || normalized === "CANCELED") {
    return normalized;
  }

  return "";
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!serviceRoleKey()) {
    return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });
  }

  const { id } = await params;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const status = normalizeStatus(body.status);
  if (!status) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }

  try {
    const updated = await supabasePatch<SupabaseRow>(
      `receivable_installments?id=eq.${encodeURIComponent(id)}`,
      { status }
    );

    return NextResponse.json({
      id: readFirstString(updated, ["id"]),
      status: readFirstString(updated, ["status"]) || status
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao atualizar status da parcela.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
