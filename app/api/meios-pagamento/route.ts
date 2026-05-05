import { NextResponse } from "next/server";

import { companyIdFromEnv, readFirstString, serviceRoleKey, supabaseSelect, type SupabaseRow } from "@/lib/server/supabase-admin";

function detectTipo(row: SupabaseRow) {
  const explicitType = readFirstString(row, ["tipo", "type"]);
  if (explicitType) {
    return explicitType.toUpperCase();
  }

  const name = readFirstString(row, ["nome_meios_pagamento", "nome_meio_pagamento", "nome", "name"]);
  return name.toUpperCase().includes("DINHEIRO") ? "DINHEIRO" : "OUTRO";
}

export async function GET() {
  const key = serviceRoleKey();
  if (!key) {
    return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });
  }

  const companyId = companyIdFromEnv();
  const companyFilter = companyId ? `&company_id=eq.${encodeURIComponent(companyId)}` : "";
  const queries = [
    `meios_pagamentos?select=*&order=nome_meios_pagamento.asc${companyFilter}`,
    `meios_pagamentos?select=*&order=nome.asc${companyFilter}`,
    `meios_pagamento?select=*&order=nome_meios_pagamento.asc${companyFilter}`,
    `meios_pagamento?select=*&order=nome.asc${companyFilter}`,
    "meios_pagamentos?select=*",
    "meios_pagamento?select=*"
  ];

  try {
    let rows: SupabaseRow[] | null = null;

    for (const query of queries) {
      try {
        rows = await supabaseSelect<SupabaseRow>(query);
        break;
      } catch {
        rows = null;
      }
    }

    if (!rows) {
      throw new Error("Nenhuma consulta de meios de pagamento funcionou no Supabase.");
    }

    return NextResponse.json(
      rows
        .map((row) => ({
          id: readFirstString(row, ["id_meios_pagamento", "id_meio_pagamento", "id"]),
          name: readFirstString(row, ["nome_meios_pagamento", "nome_meio_pagamento", "nome", "name"]),
          tipo: detectTipo(row),
          contaRecebimento: readFirstString(row, ["conta_recebimento", "account_name", "account"])
        }))
        .filter((item) => item.id && item.name)
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar meios de pagamento.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
