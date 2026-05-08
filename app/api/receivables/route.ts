import { NextRequest, NextResponse } from "next/server";

type SaleItemBody = {
  passeioId: string;
  passeioNome: string;
  fornecedorId: string;
  fornecedorNome: string;
  adultos: number;
  criancas: number;
  custoUnitarioAdulto: number;
  custoUnitarioCrianca: number;
  totalItem: number;
  currency: string;
};

type CreateReceivableBody = {
  customerName: string;
  sellerId?: string;
  sellerName?: string;
  fxRateUsdBrl?: number;
  description?: string;
  totalAmount: number;
  currency: string;
  saleDate: string;
  installmentsCount: number;
  items?: SaleItemBody[];
  saleCode?: string;
  saleNumber?: number;
  installmentDueDates?: string[];
  meioPagamentoId?: string;
  meioPagamentoNome?: string;
  meioPagamentoTipo?: string;
  accountId?: string;
  accountName?: string;
  cashReceiverId?: string;
  cashReceiverName?: string;
};

type SupabaseRow = Record<string, unknown>;

function projectAmountBrlBase(amount: number, currency: string, fxRateUsdBrl?: number) {
  if (currency === "BRL") {
    return amount;
  }

  if (currency === "USD" && typeof fxRateUsdBrl === "number" && Number.isFinite(fxRateUsdBrl) && fxRateUsdBrl > 0) {
    return Number((amount * fxRateUsdBrl).toFixed(2));
  }

  return amount;
}

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

async function supabaseSelect<T extends SupabaseRow>(path: string): Promise<T[]> {
  const key = serviceRoleKey();
  const url = `${supabaseUrl()}/rest/v1/${path}`;

  const response = await fetch(url, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase SELECT ${path}: ${response.status} ${text}`);
  }

  return response.json() as Promise<T[]>;
}

function buildSaleCode(saleNumber: number) {
  return String(saleNumber).padStart(3, "0");
}

function parseSaleNumberFromUnknown(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.trunc(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return 0;

    const numeric = Number(trimmed);
    if (Number.isFinite(numeric) && numeric > 0) {
      return Math.trunc(numeric);
    }

    const match = trimmed.match(/(\d+)/g);
    if (match && match.length > 0) {
      const lastChunk = match[match.length - 1];
      const parsed = Number(lastChunk);
      if (Number.isFinite(parsed) && parsed > 0) {
        return Math.trunc(parsed);
      }
    }
  }

  return 0;
}

async function generateNextSaleSequence(companyId: string) {
  const rows = await supabaseSelect<SupabaseRow>(
    `receivables?select=sale_number,sale_code&company_id=eq.${encodeURIComponent(companyId)}&order=created_at.desc&limit=500`
  );

  const highest = rows.reduce((max, row) => {
    const fromNumber = parseSaleNumberFromUnknown(row.sale_number);
    const fromCode = parseSaleNumberFromUnknown(row.sale_code);
    return Math.max(max, fromNumber, fromCode);
  }, 0);

  const nextSaleNumber = highest + 1;

  return {
    saleNumber: nextSaleNumber,
    saleCode: buildSaleCode(nextSaleNumber)
  };
}

function readCompanyIdFromRow(row: SupabaseRow): string | null {
  // The actual Supabase schema uses id_fornecedor as the PK of companies
  for (const key of ["id_fornecedor", "id"]) {
    const val = row[key];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  return null;
}

export async function GET() {
  if (!serviceRoleKey()) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY não configurada. Adicione ao .env.local." },
      { status: 503 }
    );
  }

  try {
    const companyId = companyIdFromEnv();
    const companyFilter = companyId ? `&company_id=eq.${encodeURIComponent(companyId)}` : "";
    const response = await fetch(
      `${supabaseUrl()}/rest/v1/receivables?select=*&order=created_at.desc${companyFilter}`,
      {
        headers: {
          apikey: serviceRoleKey(),
          Authorization: `Bearer ${serviceRoleKey()}`
        },
        cache: "no-store"
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json({ error: `Supabase: ${response.status} ${text}` }, { status: 502 });
    }

    const rows = (await response.json()) as SupabaseRow[];
    return NextResponse.json(
      rows.map((row) => ({
        id: String(row.id ?? ""),
        customerName: String(row.customer_name ?? ""),
        sellerId: row.seller_id ? String(row.seller_id) : undefined,
        sellerName: row.seller_name ? String(row.seller_name) : undefined,
        saleCode: row.sale_code ? String(row.sale_code) : undefined,
        saleNumber: row.sale_number != null ? Number(row.sale_number) : undefined,
        description: row.description ? String(row.description) : undefined,
        totalAmount: Number(row.total_amount ?? 0),
        currency: String(row.currency ?? "BRL"),
        saleDate: String(row.sale_date ?? "").slice(0, 10),
        installmentsCount: Number(row.installments_count ?? 0),
        status: String(row.status ?? "OPEN")
      }))
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao listar recebíveis.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function fetchOrCreateCompanyId(): Promise<string> {
  // 1. Try env var first (fastest, no DB call)
  const envId = companyIdFromEnv();
  if (envId) return envId;

  // 2. Query companies table
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
    const id = readCompanyIdFromRow(rows[0]);
    if (id) return id;
  }

  // 3. Create a default company
  const created = await supabaseInsert<SupabaseRow>("companies", {
    legal_name: "BNC Financeiro",
    default_currency: "BRL",
  });

  const id = readCompanyIdFromRow(created);
  if (!id) {
    throw new Error("Empresa criada mas ID não encontrado na resposta. Verifique a coluna PK da tabela companies.");
  }

  return id;
}

export async function POST(request: NextRequest) {
  if (!serviceRoleKey()) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY não configurada. Adicione ao .env.local." },
      { status: 503 }
    );
  }

  let payload: CreateReceivableBody;
  try {
    payload = (await request.json()) as CreateReceivableBody;
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  if (!payload.customerName || !payload.totalAmount || !payload.saleDate) {
    return NextResponse.json({ error: "Campos obrigatórios ausentes." }, { status: 400 });
  }

  try {
    const companyId = await fetchOrCreateCompanyId();
    const { saleNumber, saleCode } = await generateNextSaleSequence(companyId);

    const adultosTotais = (payload.items ?? []).reduce((s, i) => s + (i.adultos ?? 0), 0);
    const criancasTotais = (payload.items ?? []).reduce((s, i) => s + (i.criancas ?? 0), 0);

    const receivableRow = await supabaseInsert<{ id: string }>("receivables", {
      company_id: companyId,
      customer_name: payload.customerName,
      seller_id: payload.sellerId ?? null,
      seller_name: payload.sellerName ?? null,
      fx_rate_usd_brl: payload.fxRateUsdBrl ?? null,
      adultos: adultosTotais,
      criancas: criancasTotais,
      description: payload.description ?? null,
      total_amount: payload.totalAmount,
      currency: payload.currency,
      sale_date: payload.saleDate,
      sale_number: saleNumber,
      sale_code: saleCode,
      installments_count: payload.installmentsCount,
      meio_pagamento_id: payload.meioPagamentoId ?? null,
      meio_pagamento_nome: payload.meioPagamentoNome ?? null,
      meio_pagamento_tipo: payload.meioPagamentoTipo ?? null,
      account_id: payload.accountId ?? null,
      account_name: payload.accountName ?? null,
      cash_receiver_id: payload.cashReceiverId ?? null,
      cash_receiver_name: payload.cashReceiverName ?? null,
      status: "OPEN",
    });

    const baseAmount =
      Math.floor((payload.totalAmount / payload.installmentsCount) * 100) / 100;
    const remainder =
      Math.round(
        (payload.totalAmount - baseAmount * (payload.installmentsCount - 1)) * 100
      ) / 100;

    for (let i = 0; i < payload.installmentsCount; i++) {
      const dueDate = payload.installmentDueDates?.[i] ?? payload.saleDate;
      const isLast = i === payload.installmentsCount - 1;
      const installmentAmount = isLast ? remainder : baseAmount;

      await supabaseInsert("receivable_installments", {
        company_id: companyId,
        receivable_id: receivableRow.id,
        installment_number: i + 1,
        amount: installmentAmount,
        amount_contract: installmentAmount,
        currency: payload.currency,
        currency_contract: payload.currency,
        projected_amount_brl_base: projectAmountBrlBase(installmentAmount, payload.currency, payload.fxRateUsdBrl),
        due_date: dueDate,
        status: "PENDING",
      });
    }

    // Inserir itens de passeio
    for (const item of payload.items ?? []) {
      await supabaseInsert("sale_items", {
        company_id: companyId,
        receivable_id: receivableRow.id,
        passeio_id: item.passeioId,
        passeio_nome: item.passeioNome,
        fornecedor_id: item.fornecedorId,
        fornecedor_nome: item.fornecedorNome,
        adultos: item.adultos,
        criancas: item.criancas,
        custo_unitario_adulto: item.custoUnitarioAdulto,
        custo_unitario_crianca: item.custoUnitarioCrianca,
        total_item: item.totalItem,
        currency: item.currency,
      });
    }

    return NextResponse.json({
      id: receivableRow.id,
      customerName: payload.customerName,
      sellerId: payload.sellerId ?? "",
      sellerName: payload.sellerName ?? "",
      saleCode,
      saleNumber,
      description: payload.description,
      totalAmount: payload.totalAmount,
      currency: payload.currency,
      saleDate: payload.saleDate,
      installmentsCount: payload.installmentsCount,
      status: "OPEN",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
