import { NextRequest, NextResponse } from "next/server";

import { buildDashboardMonthlyBreakdown } from "@/lib/server/finance";
import { serviceRoleKey } from "@/lib/server/supabase-admin";

function readMonth(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 12) {
    return parsed;
  }
  return fallback;
}

function readYear(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isFinite(parsed) && parsed >= 2000 && parsed <= 2100) {
    return parsed;
  }
  return fallback;
}

export async function GET(request: NextRequest) {
  if (!serviceRoleKey()) {
    return NextResponse.json({ error: "Supabase nao configurado." }, { status: 503 });
  }

  const now = new Date();
  const month = readMonth(request.nextUrl.searchParams.get("month"), now.getMonth() + 1);
  const year = readYear(request.nextUrl.searchParams.get("year"), now.getFullYear());

  try {
    return NextResponse.json(await buildDashboardMonthlyBreakdown(month, year));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar composicao mensal do dashboard.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
