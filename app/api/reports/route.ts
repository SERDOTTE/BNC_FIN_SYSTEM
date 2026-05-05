import { NextResponse } from "next/server";

import { buildReportsData } from "@/lib/server/finance";
import { serviceRoleKey } from "@/lib/server/supabase-admin";

export async function GET() {
  if (!serviceRoleKey()) {
    return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });
  }

  try {
    return NextResponse.json(await buildReportsData());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar relatórios.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}