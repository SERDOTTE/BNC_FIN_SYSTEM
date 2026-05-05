import { NextRequest, NextResponse } from "next/server";

import { buildDailyCashFlow } from "@/lib/server/finance";
import { serviceRoleKey } from "@/lib/server/supabase-admin";

export async function GET(request: NextRequest) {
  if (!serviceRoleKey()) {
    return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const month = Number.parseInt(searchParams.get("month") ?? "", 10);
  const year = Number.parseInt(searchParams.get("year") ?? "", 10);

  if (!Number.isFinite(month) || !Number.isFinite(year)) {
    return NextResponse.json({ error: "month e year são obrigatórios." }, { status: 400 });
  }

  try {
    return NextResponse.json(await buildDailyCashFlow(month, year));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar fluxo diário.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}