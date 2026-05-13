import { NextRequest, NextResponse } from "next/server";
import { fallbackBranchDefinition, resolveBranchDefinition } from "@/lib/branches";

function supabaseUrl() {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "").replace(/\/rest\/v1$/i, "");
}

function serviceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}

function companyIdFromEnv() {
  return process.env.SUPABASE_COMPANY_ID ?? "";
}

function readNonEmptyString(value: unknown) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed;
}

function projectAmountBrlBase(amount: number, currency: string, fxRateUsdBrl?: number) {
  if (currency === "BRL") return amount;
  if (currency === "USD" && typeof fxRateUsdBrl === "number" && fxRateUsdBrl > 0) {
    return Number((amount * fxRateUsdBrl).toFixed(2));
  }
  return amount;
}

async function supabasePatch(table: string, id: string, body: Record<string, unknown>) {
  const key = serviceRoleKey();
  const url = `${supabaseUrl()}/rest/v1/${table}?id=eq.${id}`;

  const response = await fetch(url, {
    method: "PATCH",
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
    throw new Error(`Supabase PATCH ${table}: ${response.status} ${text}`);
  }

  const data = (await response.json()) as Record<string, unknown>[];
  return data[0] ?? null;
}

async function supabasePatchWhere(table: string, filter: string, body: Record<string, unknown>) {
  const key = serviceRoleKey();
  const url = `${supabaseUrl()}/rest/v1/${table}?${filter}`;

  const response = await fetch(url, {
    method: "PATCH",
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
    throw new Error(`Supabase PATCH ${table}: ${response.status} ${text}`);
  }

  return (await response.json()) as Record<string, unknown>[];
}

async function supabaseSelectWhere(table: string, filter: string) {
  const key = serviceRoleKey();
  const url = `${supabaseUrl()}/rest/v1/${table}?${filter}`;

  const response = await fetch(url, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase SELECT ${table}: ${response.status} ${text}`);
  }

  return (await response.json()) as Record<string, unknown>[];
}

async function supabaseInsertOne(table: string, body: Record<string, unknown>) {
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
}

async function supabaseDeleteWhere(table: string, filter: string) {
  const key = serviceRoleKey();
  const url = `${supabaseUrl()}/rest/v1/${table}?${filter}`;

  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase DELETE ${table}: ${response.status} ${text}`);
  }
}

async function supabaseDelete(table: string, id: string) {
  return supabaseDeleteWhere(table, `id=eq.${id}`);
}

type InstallmentInputBody = {
  dueDate: string;
  meioPagamentoId?: string;
  meioPagamentoNome?: string;
  meioPagamentoTipo?: string;
  accountId?: string;
  accountName?: string;
  cashReceiverId?: string;
  cashReceiverName?: string;
};

type SaleItemInputBody = {
  passeioId: string;
  passeioNome: string;
  fornecedorId?: string;
  fornecedorNome?: string;
  adultos?: number;
  criancas?: number;
  custoUnitarioAdulto?: number;
  custoUnitarioCrianca?: number;
  totalItem?: number;
  currency?: string;
};

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const rows = await supabaseSelectWhere("receivables", `id=eq.${encodeURIComponent(id)}&select=*`);
    const row = rows[0];

    if (!row) {
      return NextResponse.json({ error: "Venda não encontrada" }, { status: 404 });
    }

    const branch = resolveBranchDefinition(row.branch_code ?? row.branch_name) ?? fallbackBranchDefinition();
    const saleItemsRows = await supabaseSelectWhere("sale_items", `receivable_id=eq.${encodeURIComponent(id)}&select=*&order=created_at.asc`);

    return NextResponse.json({
      id: String(row.id),
      branchCode: branch.code,
      branchLabel: branch.label,
      customerName: String(row.customer_name ?? ""),
      sellerId: row.seller_id ? String(row.seller_id) : undefined,
      sellerName: row.seller_name ? String(row.seller_name) : undefined,
      saleCode: row.sale_code ? String(row.sale_code) : undefined,
      saleNumber: row.sale_number ? Number(row.sale_number) : undefined,
      description: row.description ? String(row.description) : undefined,
      totalAmount: Number(row.total_amount ?? 0),
      currency: String(row.currency ?? "BRL"),
      saleDate: String(row.sale_date ?? "").slice(0, 10),
      installmentsCount: Number(row.installments_count ?? 0),
      status: String(row.status ?? "OPEN"),
      saleItems: saleItemsRows.map((item) => ({
        passeioId: String(item.passeio_id ?? ""),
        passeioNome: String(item.passeio_nome ?? ""),
        fornecedorId: item.fornecedor_id ? String(item.fornecedor_id) : "",
        fornecedorNome: item.fornecedor_nome ? String(item.fornecedor_nome) : "",
        adultos: Number(item.adultos ?? 0),
        criancas: Number(item.criancas ?? 0),
        custoUnitarioAdulto: Number(item.custo_unitario_adulto ?? 0),
        custoUnitarioCrianca: Number(item.custo_unitario_crianca ?? 0),
        totalItem: Number(item.total_item ?? 0),
        currency: String(item.currency ?? row.currency ?? "BRL"),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    const body = (await request.json()) as {
      customerName?: string;
      description?: string;
      saleDate?: string;
      totalAmount?: number;
      currency?: string;
      sellerId?: string;
      sellerName?: string;
      fxRateUsdBrl?: number;
      installmentsCount?: number;
      branchCode?: string;
      saleItems?: SaleItemInputBody[];
      installmentInputs?: InstallmentInputBody[];
    };

    const patch: Record<string, unknown> = {};

    if (body.customerName !== undefined) patch.customer_name = body.customerName;
    if (body.description !== undefined) patch.description = body.description;
    if (body.saleDate !== undefined) patch.sale_date = body.saleDate;
    if (body.totalAmount !== undefined) patch.total_amount = body.totalAmount;
    if (body.currency !== undefined) patch.currency = body.currency;
    if (body.sellerId !== undefined) patch.seller_id = body.sellerId || null;
    if (body.sellerName !== undefined) patch.seller_name = body.sellerName || null;
    if (body.fxRateUsdBrl !== undefined) patch.fx_rate_usd_brl = body.fxRateUsdBrl || null;
    if (body.installmentsCount !== undefined) patch.installments_count = body.installmentsCount;

    if (body.branchCode !== undefined) {
      const branch = resolveBranchDefinition(body.branchCode);
      if (!branch) {
        return NextResponse.json({ error: "Filial inválida. Use CANCUN ou PUNTA_CANA." }, { status: 400 });
      }

      patch.branch_code = branch.code;
      patch.branch_name = branch.label;
    }

    if (Object.keys(patch).length === 0 && !body.installmentInputs && !body.saleItems) {
      return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
    }

    const row = Object.keys(patch).length > 0
      ? await supabasePatch("receivables", id, patch)
      : await (async () => {
          // fetch current row just for the response
          const key = serviceRoleKey();
          const url = `${supabaseUrl()}/rest/v1/receivables?id=eq.${id}&select=*`;
          const res = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
          const data = (await res.json()) as Record<string, unknown>[];
          return data[0] ?? null;
        })();

    if (!row) {
      return NextResponse.json({ error: "Venda não encontrada" }, { status: 404 });
    }

    const branch = resolveBranchDefinition(row.branch_code ?? row.branch_name) ?? fallbackBranchDefinition();

    // Rebuild installments if requested
    if (body.installmentInputs && body.installmentInputs.length > 0) {
      const companyId = companyIdFromEnv() || readNonEmptyString(row.company_id);
      if (!companyId) {
        throw new Error("Não foi possível identificar company_id da venda para recriar parcelas.");
      }
      const count = body.installmentInputs.length;
      const totalAmount = body.totalAmount ?? Number(row.total_amount ?? 0);
      const currency = body.currency ?? String(row.currency ?? "BRL");
      const fxRate = body.fxRateUsdBrl ?? (row.fx_rate_usd_brl ? Number(row.fx_rate_usd_brl) : undefined);

      const baseAmount = Math.floor((totalAmount / count) * 100) / 100;
      const remainder = Math.round((totalAmount - baseAmount * (count - 1)) * 100) / 100;

      // Delete existing installments
      await supabaseDeleteWhere("receivable_installments", `receivable_id=eq.${id}`);

      // Recreate
      for (let i = 0; i < count; i++) {
        const inp = body.installmentInputs[i];
        const isLast = i === count - 1;
        const installmentAmount = isLast ? remainder : baseAmount;

        await supabaseInsertOne("receivable_installments", {
          company_id: companyId,
          receivable_id: id,
          branch_code: branch.code,
          installment_number: i + 1,
          amount: installmentAmount,
          amount_contract: installmentAmount,
          currency,
          currency_contract: currency,
          projected_amount_brl_base: projectAmountBrlBase(installmentAmount, currency, fxRate),
          due_date: inp.dueDate,
          status: "PENDING",
        });
      }
    }

    if (body.saleItems) {
      const companyId = companyIdFromEnv() || readNonEmptyString(row.company_id);
      if (!companyId) {
        throw new Error("Não foi possível identificar company_id da venda para atualizar passeios.");
      }

      const hasInvalidItem = body.saleItems.some((item) => !item.passeioId || !item.passeioNome);
      if (hasInvalidItem) {
        return NextResponse.json({ error: "Todos os itens da venda devem ter passeio válido." }, { status: 400 });
      }

      await supabaseDeleteWhere("sale_items", `receivable_id=eq.${id}`);

      for (const item of body.saleItems) {
        await supabaseInsertOne("sale_items", {
          company_id: companyId,
          receivable_id: id,
          branch_code: branch.code,
          passeio_id: item.passeioId,
          passeio_nome: item.passeioNome,
          fornecedor_id: item.fornecedorId ?? null,
          fornecedor_nome: item.fornecedorNome ?? null,
          adultos: item.adultos ?? 0,
          criancas: item.criancas ?? 0,
          custo_unitario_adulto: item.custoUnitarioAdulto ?? 0,
          custo_unitario_crianca: item.custoUnitarioCrianca ?? 0,
          total_item: item.totalItem ?? 0,
          currency: item.currency ?? String(row.currency ?? "BRL"),
        });
      }
    }

    await Promise.all([
      supabasePatchWhere("receivable_installments", `receivable_id=eq.${id}`, { branch_code: branch.code }).catch(() => []),
      supabasePatchWhere("sale_items", `receivable_id=eq.${id}`, { branch_code: branch.code }).catch(() => []),
    ]);

    return NextResponse.json({
      branchCode: branch.code,
      branchLabel: branch.label,
      id: String(row.id),
      customerName: String(row.customer_name ?? ""),
      description: row.description ? String(row.description) : undefined,
      totalAmount: Number(body.totalAmount ?? row.total_amount ?? 0),
      currency: String(body.currency ?? row.currency ?? "BRL"),
      saleDate: String(body.saleDate ?? row.sale_date ?? "").slice(0, 10),
      installmentsCount: Number(body.installmentsCount ?? row.installments_count ?? 0),
      status: String(row.status ?? "OPEN"),
      saleCode: row.sale_code ? String(row.sale_code) : undefined,
      saleNumber: row.sale_number ? Number(row.sale_number) : undefined,
      sellerId: body.sellerId ?? (row.seller_id ? String(row.seller_id) : undefined),
      sellerName: body.sellerName ?? (row.seller_name ? String(row.seller_name) : undefined),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    // Delete child records first to avoid FK constraint violations
    await supabaseDelete("sale_items", id).catch(() => {
      // sale_items may not exist or may cascade — ignore errors
    });

    // Delete installments for this receivable
    const key = serviceRoleKey();
    const instUrl = `${supabaseUrl()}/rest/v1/installments?receivable_id=eq.${id}`;
    await fetch(instUrl, {
      method: "DELETE",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });

    await supabaseDelete("receivables", id);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
