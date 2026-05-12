import { NextRequest, NextResponse } from "next/server";
import { fallbackBranchDefinition, resolveBranchDefinition } from "@/lib/branches";

function supabaseUrl() {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "").replace(/\/rest\/v1$/i, "");
}

function serviceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}

async function patchPasseioById(
  id: string,
  body: Record<string, unknown>,
  preferHeader = "return=representation"
) {
  const key = serviceRoleKey();
  const filters = ["id", "id_passeio"];

  for (const filterField of filters) {
    const response = await fetch(
      `${supabaseUrl()}/rest/v1/passeios?${filterField}=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Prefer: preferHeader
        },
        body: JSON.stringify(body)
      }
    );

    if (response.ok) {
      return response;
    }
  }

  return null;
}

async function deletePasseioById(id: string) {
  const key = serviceRoleKey();
  const filters = ["id", "id_passeio"];
  let lastError = "";

  for (const filterField of filters) {
    const response = await fetch(
      `${supabaseUrl()}/rest/v1/passeios?${filterField}=eq.${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        }
      }
    );

    if (response.ok) {
      return { ok: true, error: "" };
    }

    lastError = await response.text();
  }

  return { ok: false, error: lastError };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const key = serviceRoleKey();
  if (!key) {
    return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });
  }

  const { id } = await params;
  const body = (await request.json()) as { nome?: string };
  const nome = (body.nome ?? "").trim();

  if (!nome) {
    return NextResponse.json({ error: "Nome é obrigatório." }, { status: 400 });
  }

  const payloads = [{ nome_passeio: nome }, { nome }];

  for (const payload of payloads) {
    const response = await patchPasseioById(id, payload);
    if (!response) {
      continue;
    }

    const rows = (await response.json()) as Array<Record<string, unknown>>;
    const row = rows[0] ?? payload;
    const branch = resolveBranchDefinition(row.branch_code ?? row.branch_name) ?? fallbackBranchDefinition();

    return NextResponse.json({
      id: String(row.id_passeio ?? row.id ?? id),
      name: String(row.nome_passeio ?? row.nome ?? nome),
      branchCode: branch.code,
      branchLabel: branch.label
    });
  }

  return NextResponse.json({ error: "Falha ao atualizar passeio." }, { status: 500 });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const key = serviceRoleKey();
  if (!key) {
    return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });
  }

  const { id } = await params;

  const result = await deletePasseioById(id);
  if (!result.ok) {
    return NextResponse.json(
      { error: `Falha ao excluir passeio. ${result.error || ""}`.trim() },
      { status: 500 }
    );
  }

  return new NextResponse(null, { status: 204 });
}
