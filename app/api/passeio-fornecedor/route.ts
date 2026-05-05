import { NextRequest, NextResponse } from "next/server";

type SupabaseRow = Record<string, unknown>;

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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const passeioId = searchParams.get("passeioId") ?? "";
  const fornecedorId = searchParams.get("fornecedorId") ?? "";

  if (!passeioId || !fornecedorId) {
    return NextResponse.json({ custoAdulto: 0, custoCrianca: 0 });
  }

  const key = serviceRoleKey();
  if (!key) {
    return NextResponse.json({ custoAdulto: 0, custoCrianca: 0 });
  }

  const url =
    `${supabaseUrl()}/rest/v1/passeio_fornecedor` +
    `?passeio_id=eq.${encodeURIComponent(passeioId)}` +
    `&fornecedor_id=eq.${encodeURIComponent(fornecedorId)}` +
    `&select=custo_adulto,custo_crianca&limit=1`;

  try {
    const response = await fetch(url, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });

    if (!response.ok) return NextResponse.json({ custoAdulto: 0, custoCrianca: 0 });

    const rows = (await response.json()) as SupabaseRow[];
    if (rows.length === 0) return NextResponse.json({ custoAdulto: 0, custoCrianca: 0 });

    return NextResponse.json({
      custoAdulto: Number(rows[0].custo_adulto ?? 0),
      custoCrianca: Number(rows[0].custo_crianca ?? 0),
    });
  } catch {
    return NextResponse.json({ custoAdulto: 0, custoCrianca: 0 });
  }
}
