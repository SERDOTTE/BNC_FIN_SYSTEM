import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const key = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "").replace(/\/rest\/v1$/i, "");
  const url = key;
  const sKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!sKey) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY não configurada." }, { status: 503 });
  }

  const response = await fetch(`${url}/rest/v1/accounts?select=*&is_active=eq.true&order=name.asc`, {
    headers: {
      apikey: sKey,
      Authorization: `Bearer ${sKey}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    return NextResponse.json({ error: `Supabase: ${response.status} ${text}` }, { status: 502 });
  }

  type Row = { id: string; name: string; type: string; base_currency: string };
  const rows = await response.json() as Row[];
  return NextResponse.json(rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    baseCurrency: row.base_currency,
    balance: 0,
  })));
}

type CreateAccountBody = {
  name: string;
  type: string;
  baseCurrency: string;
};

type SupabaseRow = Record<string, unknown>;

function supabaseUrl() {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "").replace(/\/rest\/v1$/i, "");
}

function serviceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}

function companyIdFromEnv() {
  return process.env.SUPABASE_COMPANY_ID ?? "";
}

async function supabaseInsert<T extends SupabaseRow>(
  table: string,
  body: Record<string, unknown>
): Promise<T> {
  const key = serviceRoleKey();
  const url = `${supabaseUrl()}/rest/v1/${table}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase INSERT ${table}: ${response.status} ${text}`);
  }

  const data = (await response.json()) as T[];
  return data[0];
}

async function fetchOrCreateCompanyId(): Promise<string> {
  const envId = companyIdFromEnv();
  if (envId) return envId;

  const key = serviceRoleKey();
  const response = await fetch(`${supabaseUrl()}/rest/v1/companies?select=*&limit=1`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Falha ao consultar tabela companies: ${response.status}`);
  }

  const rows = (await response.json()) as SupabaseRow[];
  if (rows.length > 0) {
    const row = rows[0];
    for (const key of ["id_fornecedor", "id"]) {
      const val = row[key];
      if (typeof val === "string" && val.trim()) return val.trim();
    }
  }

  const created = await supabaseInsert<SupabaseRow>("companies", {
    legal_name: "BNC Financeiro",
    default_currency: "BRL",
  });

  for (const key of ["id_fornecedor", "id"]) {
    const val = created[key];
    if (typeof val === "string" && val.trim()) return val.trim();
  }

  throw new Error("Empresa criada mas ID não encontrado na resposta.");
}

export async function POST(request: NextRequest) {
  if (!serviceRoleKey()) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY não configurada. Adicione ao .env.local." },
      { status: 503 }
    );
  }

  let payload: CreateAccountBody;
  try {
    payload = (await request.json()) as CreateAccountBody;
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  if (!payload.name || !payload.type || !payload.baseCurrency) {
    return NextResponse.json({ error: "Campos obrigatórios ausentes: name, type, baseCurrency." }, { status: 400 });
  }

  try {
    const companyId = await fetchOrCreateCompanyId();

    const row = await supabaseInsert<{ id: string; name: string; type: string; base_currency: string }>(
      "accounts",
      {
        company_id: companyId,
        name: payload.name,
        type: payload.type,
        base_currency: payload.baseCurrency,
        is_active: true,
      }
    );

    return NextResponse.json({
      id: row.id,
      name: row.name,
      type: row.type,
      baseCurrency: row.base_currency,
      balance: 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
