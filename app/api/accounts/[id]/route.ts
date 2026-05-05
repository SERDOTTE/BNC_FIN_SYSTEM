import { NextRequest, NextResponse } from "next/server";

function supabaseUrl() {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "").replace(/\/rest\/v1$/i, "");
}

function serviceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}

type UpdateAccountBody = {
  name?: string;
  type?: string;
  baseCurrency?: string;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sKey = serviceRoleKey();
  if (!sKey) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY não configurada." }, { status: 503 });
  }

  const { id } = await params;

  let body: UpdateAccountBody;
  try {
    body = (await request.json()) as UpdateAccountBody;
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch["name"] = body.name;
  if (body.type !== undefined) patch["type"] = body.type;
  if (body.baseCurrency !== undefined) patch["base_currency"] = body.baseCurrency;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nenhum campo para atualizar." }, { status: 400 });
  }

  const response = await fetch(
    `${supabaseUrl()}/rest/v1/accounts?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: {
        apikey: sKey,
        Authorization: `Bearer ${sKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(patch),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    return NextResponse.json({ error: `Supabase: ${response.status} ${text}` }, { status: 502 });
  }

  type Row = { id: string; name: string; type: string; base_currency: string };
  const rows = (await response.json()) as Row[];
  const row = rows[0];

  if (!row) {
    return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
  }

  return NextResponse.json({
    id: row.id,
    name: row.name,
    type: row.type,
    baseCurrency: row.base_currency,
    balance: 0,
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sKey = serviceRoleKey();
  if (!sKey) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY não configurada." }, { status: 503 });
  }

  const { id } = await params;

  // Soft delete: marca is_active = false
  const response = await fetch(
    `${supabaseUrl()}/rest/v1/accounts?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: {
        apikey: sKey,
        Authorization: `Bearer ${sKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ is_active: false }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    return NextResponse.json({ error: `Supabase: ${response.status} ${text}` }, { status: 502 });
  }

  return new NextResponse(null, { status: 204 });
}
