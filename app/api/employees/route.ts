import { NextResponse } from "next/server";

import { companyIdFromEnv, readFirstString, serviceRoleKey, supabaseSelect, type SupabaseRow } from "@/lib/server/supabase-admin";

export async function GET() {
  if (!serviceRoleKey()) {
    return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });
  }

  const companyId = companyIdFromEnv();

  try {
    const companyFilter = companyId ? `&company_id=eq.${encodeURIComponent(companyId)}` : "";

    let rows: SupabaseRow[] = [];
    try {
      rows = await supabaseSelect<SupabaseRow>(`funcionarios?select=*&order=nome_funcionario.asc${companyFilter}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("column funcionarios.company_id does not exist")) {
        throw error;
      }

      rows = await supabaseSelect<SupabaseRow>("funcionarios?select=*&order=nome_funcionario.asc");
    }

    return NextResponse.json(
      rows
        .map((row) => ({
          id: readFirstString(row, ["id_funcionario", "funcionario_id", "id"]),
          name: readFirstString(row, ["nome_funcionario", "name", "nome"])
        }))
        .filter((item) => item.id && item.name)
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar funcionários.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}