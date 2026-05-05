import { NextRequest, NextResponse } from "next/server";

import { companyIdFromEnv, readFirstString, serviceRoleKey, supabaseFetch, supabaseSelect, type SupabaseRow } from "@/lib/server/supabase-admin";

function mapPasseio(row: SupabaseRow) {
  return {
    id: readFirstString(row, ["id_passeio", "id"]),
    name: readFirstString(row, ["nome_passeio", "nome", "name"])
  };
}

async function listPasseiosRows(companyId: string) {
  const companyFilter = companyId ? `&company_id=eq.${encodeURIComponent(companyId)}` : "";
  const queries = [
    `passeios?select=*&order=nome_passeio.asc${companyFilter}`,
    `passeios?select=*&order=nome.asc${companyFilter}`,
    "passeios?select=*&order=nome_passeio.asc",
    "passeios?select=*&order=nome.asc"
  ];

  for (const query of queries) {
    try {
      return await supabaseSelect<SupabaseRow>(query);
    } catch {
      // try next query shape
    }
  }

  throw new Error("Nenhuma consulta de passeios funcionou no Supabase.");
}

export async function GET() {
  const key = serviceRoleKey();

  if (!key) {
    return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });
  }

  try {
    const rows = await listPasseiosRows(companyIdFromEnv());
    const items = rows.map(mapPasseio).filter((item) => item.id && item.name);
    return NextResponse.json(items);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar passeios.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const key = serviceRoleKey();
  const companyId = companyIdFromEnv();

  if (!key) {
    return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });
  }

  const body = (await request.json()) as { nome?: string; fornecedorId?: string; moedaCusto?: string };
  const nome = (body.nome ?? "").trim();
  const fornecedorId = (body.fornecedorId ?? "").trim();
  const moedaCusto = (body.moedaCusto ?? "USD").trim().toUpperCase();
  const ownerId = companyId || fornecedorId || "";

  if (!nome) {
    return NextResponse.json({ error: "O nome do passeio é obrigatório." }, { status: 400 });
  }

  const payloadNomePasseio: Record<string, unknown> = {
    nome_passeio: nome,
    id_fornecedor: ownerId || null,
    moeda_custo: moedaCusto || "USD"
  };
  const payloadNome: Record<string, unknown> = {
    nome,
    id_fornecedor: ownerId || null,
    moeda_custo: moedaCusto || "USD"
  };

  const attempts: Record<string, unknown>[] = [
    payloadNomePasseio,
    payloadNome,
    { nome_passeio: nome, id_fornecedor: ownerId || null },
    { nome: nome, id_fornecedor: ownerId || null },
    { nome_passeio: nome, moeda_custo: moedaCusto || "USD" },
    { nome: nome, moeda_custo: moedaCusto || "USD" },
    { nome_passeio: nome },
    { nome }
  ];

  let lastError = "";

  for (const payload of attempts) {
    const response = await supabaseFetch("passeios", {
      method: "POST",
      headers: {
        Prefer: "return=representation"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      lastError = await response.text();
      continue;
    }

    const rows = (await response.json()) as SupabaseRow[];
    const item = mapPasseio(rows[0] ?? payload);
    if (!item.id || !item.name) {
      return NextResponse.json({ id: "", name: nome }, { status: 201 });
    }

    return NextResponse.json(item, { status: 201 });
  }

  return NextResponse.json(
    { error: `Falha ao criar passeio. ${lastError || "Verifique as colunas da tabela passeios."}` },
    { status: 500 }
  );
}
