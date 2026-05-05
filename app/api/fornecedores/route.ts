import { NextRequest, NextResponse } from "next/server";

import { companyIdFromEnv, readFirstString, serviceRoleKey, supabaseFetch, supabaseSelect, type SupabaseRow } from "@/lib/server/supabase-admin";

export async function GET() {
  const key = serviceRoleKey();

  if (!key) {
    return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });
  }

  const companyId = companyIdFromEnv();
  const companyFilter = companyId ? `&company_id=eq.${encodeURIComponent(companyId)}` : "";

  try {
    const rows = await supabaseSelect<SupabaseRow>(`fornecedores?select=id,nome&is_active=eq.true&order=nome.asc${companyFilter}`);

    const items = rows
      .map((row) => ({
        id: readFirstString(row, ["id"]),
        name: readFirstString(row, ["nome"])
      }))
      .filter((item) => item.id && item.name);

    return NextResponse.json(items);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar fornecedores.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const key = serviceRoleKey();
  const companyId = companyIdFromEnv();

  if (!key) {
    return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });
  }

  const body = (await request.json()) as { nome?: string };
  const nome = (body.nome ?? "").trim();

  if (!nome) {
    return NextResponse.json({ error: "O nome do fornecedor é obrigatório." }, { status: 400 });
  }

  const payload: Record<string, unknown> = { nome, is_active: true };
  if (companyId) payload.company_id = companyId;

  const response = await supabaseFetch("fornecedores", {
    method: "POST",
    headers: {
      Prefer: "return=representation"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    return NextResponse.json(
      { error: `Falha ao criar fornecedor: ${response.status} ${text}` },
      { status: response.status }
    );
  }

  const rows = (await response.json()) as SupabaseRow[];
  const row = rows[0] ?? payload;
  return NextResponse.json(
    { id: String(row.id ?? ""), name: String(row.nome ?? nome), nome: String(row.nome ?? nome) },
    { status: 201 }
  );
}
