import type { Currency } from "@/lib/types";

export type SupabaseRow = Record<string, unknown>;

export function supabaseUrl() {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "").replace(/\/rest\/v1$/i, "");
}

export function serviceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}

export function companyIdFromEnv() {
  return process.env.SUPABASE_COMPANY_ID ?? "";
}

export function assertSupabaseConfigured() {
  const url = supabaseUrl();
  const key = serviceRoleKey();

  if (!url || !key) {
    throw new Error("Supabase não configurado.");
  }

  return { url, key };
}

export async function supabaseFetch(path: string, init?: RequestInit) {
  const { url, key } = assertSupabaseConfigured();

  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    cache: init?.cache ?? "no-store"
  });
}

export async function supabaseSelect<T>(path: string): Promise<T[]> {
  const response = await supabaseFetch(path);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase SELECT ${path}: ${response.status} ${text}`);
  }

  return response.json() as Promise<T[]>;
}

export async function supabaseInsert<T>(table: string, body: Record<string, unknown>): Promise<T> {
  const response = await supabaseFetch(table, {
    method: "POST",
    headers: {
      Prefer: "return=representation"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase INSERT ${table}: ${response.status} ${text}`);
  }

  const data = await response.json() as T[];
  return data[0];
}

export async function supabasePatch<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await supabaseFetch(path, {
    method: "PATCH",
    headers: {
      Prefer: "return=representation"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase PATCH ${path}: ${response.status} ${text}`);
  }

  const data = await response.json() as T[];
  return data[0];
}

export async function fetchOrCreateCompanyId(): Promise<string> {
  const envId = companyIdFromEnv();
  if (envId) {
    return envId;
  }

  const rows = await supabaseSelect<SupabaseRow>("companies?select=*&limit=1");
  if (rows.length > 0) {
    const id = readFirstString(rows[0], ["id", "id_fornecedor"]);
    if (id) {
      return id;
    }
  }

  const created = await supabaseInsert<SupabaseRow>("companies", {
    legal_name: "BNC Financeiro",
    default_currency: "BRL"
  });

  const id = readFirstString(created, ["id", "id_fornecedor"]);
  if (!id) {
    throw new Error("Empresa criada mas o identificador não foi retornado.");
  }

  return id;
}

export function readFirstString(row: SupabaseRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

export function readNumber(row: SupabaseRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }

  return 0;
}

export function readCurrency(row: SupabaseRow, keys: string[], fallback: Currency = "BRL"): Currency {
  const value = readFirstString(row, keys).toUpperCase();
  if (value === "BRL" || value === "USD" || value === "EUR" || value === "ARS") {
    return value;
  }

  return fallback;
}

export function toIsoDate(value: unknown) {
  if (typeof value !== "string" || !value) {
    return "";
  }

  return value.slice(0, 10);
}