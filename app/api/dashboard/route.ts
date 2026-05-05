import { NextResponse } from "next/server";

import { buildDashboardData } from "@/lib/server/finance";
import { serviceRoleKey } from "@/lib/server/supabase-admin";

export async function GET() {
  if (!serviceRoleKey()) {
    return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });
  }

  try {
    return NextResponse.json(await buildDashboardData());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar dashboard.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}