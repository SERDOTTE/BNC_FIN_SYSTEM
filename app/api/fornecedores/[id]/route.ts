import { NextRequest, NextResponse } from "next/server";

function supabaseUrl() {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "").replace(/\/rest\/v1$/i, "");
}

function serviceRoleKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const key = serviceRoleKey();
  if (!key) return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });

  const { id } = await params;
  const body = (await request.json()) as { nome?: string };
  const nome = (body.nome ?? "").trim();
  if (!nome) return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });

  const response = await fetch(
    `${supabaseUrl()}/rest/v1/fornecedores?id=eq.${id}`,
    {
      method: "PATCH",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ nome }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    return NextResponse.json({ error: `Falha ao atualizar: ${response.status} ${text}` }, { status: response.status });
  }

  type Row = { id: string; nome: string };
  const rows = (await response.json()) as Row[];
  const row = rows[0];
  return NextResponse.json({ id: row?.id ?? id, name: row?.nome ?? nome });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const key = serviceRoleKey();
  if (!key) return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });

  const { id } = await params;

  const response = await fetch(
    `${supabaseUrl()}/rest/v1/fornecedores?id=eq.${id}`,
    {
      method: "PATCH",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ is_active: false }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    return NextResponse.json({ error: `Falha ao excluir: ${response.status} ${text}` }, { status: response.status });
  }

  return new NextResponse(null, { status: 204 });
}
