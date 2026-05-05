import { NextRequest, NextResponse } from "next/server";

type SupabaseRow = Record<string, unknown>;

function supabaseUrl() {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "").replace(/\/rest\/v1$/i, "");
}

function serviceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}

type Body = {
  status?: string;
};

function normalizeStatus(status?: string) {
  const normalized = (status ?? "").trim().toUpperCase();
  if (normalized === "RECEBIDO") {
    return "PAID";
  }

  if (normalized === "OPEN" || normalized === "PARTIALLY_PAID" || normalized === "PAID" || normalized === "OVERDUE" || normalized === "CANCELED") {
    return normalized;
  }

  return "";
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const key = serviceRoleKey();
  if (!key) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY não configurada." }, { status: 503 });
  }

  const { id } = await params;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const status = normalizeStatus(body.status);
  if (!status) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }

  const response = await fetch(
    `${supabaseUrl()}/rest/v1/receivables?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify({ status })
    }
  );

  if (!response.ok) {
    const text = await response.text();
    return NextResponse.json({ error: `Supabase: ${response.status} ${text}` }, { status: 502 });
  }

  const rows = await response.json() as SupabaseRow[];
  const row = rows[0] ?? {};

  return NextResponse.json({
    id: String(row.id ?? ""),
    customerName: String(row.customer_name ?? ""),
    sellerId: row.seller_id ? String(row.seller_id) : undefined,
    sellerName: row.seller_name ? String(row.seller_name) : undefined,
    saleCode: row.sale_code ? String(row.sale_code) : undefined,
    saleNumber: typeof row.sale_number === "number" ? row.sale_number : Number(row.sale_number ?? 0) || undefined,
    description: row.description ? String(row.description) : undefined,
    totalAmount: Number(row.total_amount ?? 0),
    currency: String(row.currency ?? "BRL"),
    saleDate: String(row.sale_date ?? "").slice(0, 10),
    installmentsCount: Number(row.installments_count ?? 0),
    status: String(row.status ?? "OPEN")
  });
}
