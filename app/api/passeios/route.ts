import { NextRequest, NextResponse } from "next/server";

import { companyIdFromEnv, readFirstString, serviceRoleKey, supabaseFetch, supabaseSelect, type SupabaseRow } from "@/lib/server/supabase-admin";
import { fallbackBranchDefinition, resolveBranchDefinition } from "@/lib/branches";

function mapPasseio(row: SupabaseRow) {
  const branch = resolveBranchDefinition(row.branch_code ?? row.branch_name) ?? fallbackBranchDefinition();
  return {
    id: readFirstString(row, ["id_passeio", "id"]),
    name: readFirstString(row, ["nome_passeio", "nome", "name"]),
    branchCode: branch.code,
    branchLabel: branch.label
  };
}

async function listPasseiosRows(companyId: string, branchCode?: string) {
  const companyFilter = companyId ? `&company_id=eq.${encodeURIComponent(companyId)}` : "";
  const branchFilter = branchCode ? `&branch_code=eq.${encodeURIComponent(branchCode)}` : "";
  const queries = [
    `passeios?select=*&order=nome_passeio.asc${companyFilter}${branchFilter}`,
    `passeios?select=*&order=nome.asc${companyFilter}${branchFilter}`,
    `passeios?select=*&order=nome_passeio.asc${companyFilter}`,
    `passeios?select=*&order=nome.asc${companyFilter}`,
    `passeios?select=*&order=nome_passeio.asc${branchFilter}`,
    `passeios?select=*&order=nome.asc${branchFilter}`,
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

export async function GET(request: NextRequest) {
  const key = serviceRoleKey();

  if (!key) {
    return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });
  }

  try {
    const branchCode = request.nextUrl.searchParams.get("branchCode") ?? request.nextUrl.searchParams.get("branch_code") ?? undefined;
    const rows = await listPasseiosRows(companyIdFromEnv(), branchCode);
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

  const body = (await request.json()) as { nome?: string; fornecedorId?: string; moedaCusto?: string; branchCode?: string };
  const nome = (body.nome ?? "").trim();
  const fornecedorId = (body.fornecedorId ?? "").trim();
  const moedaCusto = (body.moedaCusto ?? "USD").trim().toUpperCase();
  const branch = resolveBranchDefinition(body.branchCode) ?? fallbackBranchDefinition();
  const ownerId = companyId || fornecedorId || "";

  if (!nome) {
    return NextResponse.json({ error: "O nome do passeio é obrigatório." }, { status: 400 });
  }

  const payloadNomePasseio: Record<string, unknown> = {
    nome_passeio: nome,
    id_fornecedor: ownerId || null,
    moeda_custo: moedaCusto || "USD",
    branch_code: branch.code,
    branch_name: branch.label
  };
  const payloadNome: Record<string, unknown> = {
    nome,
    id_fornecedor: ownerId || null,
    moeda_custo: moedaCusto || "USD",
    branch_code: branch.code,
    branch_name: branch.label
  };

  const attempts: Record<string, unknown>[] = [
    payloadNomePasseio,
    payloadNome,
    { nome_passeio: nome, id_fornecedor: ownerId || null, branch_code: branch.code, branch_name: branch.label },
    { nome: nome, id_fornecedor: ownerId || null, branch_code: branch.code, branch_name: branch.label },
    { nome_passeio: nome, moeda_custo: moedaCusto || "USD", branch_code: branch.code, branch_name: branch.label },
    { nome: nome, moeda_custo: moedaCusto || "USD", branch_code: branch.code, branch_name: branch.label },
    { nome_passeio: nome, branch_code: branch.code, branch_name: branch.label },
    { nome, branch_code: branch.code, branch_name: branch.label }
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
      return NextResponse.json({ id: "", name: nome, branchCode: branch.code, branchLabel: branch.label }, { status: 201 });
    }

    return NextResponse.json(item, { status: 201 });
  }

  return NextResponse.json(
    { error: `Falha ao criar passeio. ${lastError || "Verifique as colunas da tabela passeios."}` },
    { status: 500 }
  );
}
