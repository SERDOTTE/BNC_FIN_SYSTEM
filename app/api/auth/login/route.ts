import { NextRequest, NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, createSessionToken, sessionCookieMaxAge } from "@/lib/auth/session";

type LoginBody = {
  email?: string;
  password?: string;
};

type AuthValidationResult =
  | { ok: true }
  | { ok: false; kind: "invalid-credentials" }
  | { ok: false; kind: "misconfigured"; message: string }
  | { ok: false; kind: "upstream-error"; message: string };

function supabaseAuthBaseUrl() {
  const raw =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    "";

  return raw.trim().replace(/\/$/, "").replace(/\/rest\/v1$/i, "");
}

function supabaseAuthApiKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  );
}

async function validateAgainstSupabase(email: string, password: string) {
  const baseUrl = supabaseAuthBaseUrl();
  const apiKey = supabaseAuthApiKey();

  if (!baseUrl) {
    return {
      ok: false,
      kind: "misconfigured",
      message: "NEXT_PUBLIC_SUPABASE_URL não configurada no ambiente de deploy."
    } satisfies AuthValidationResult;
  }

  try {
    const parsed = new URL(baseUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return {
        ok: false,
        kind: "misconfigured",
        message: "URL do Supabase invalida. Use http:// ou https:// em NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL."
      } satisfies AuthValidationResult;
    }
  } catch {
    return {
      ok: false,
      kind: "misconfigured",
      message: "URL do Supabase invalida. Verifique NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL no deploy."
    } satisfies AuthValidationResult;
  }

  if (!apiKey) {
    return {
      ok: false,
      kind: "misconfigured",
      message: "Configure NEXT_PUBLIC_SUPABASE_ANON_KEY ou SUPABASE_SERVICE_ROLE_KEY na Vercel."
    } satisfies AuthValidationResult;
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });
  } catch {
    return {
      ok: false,
      kind: "upstream-error",
      message: "Nao foi possivel conectar ao Supabase Auth. Verifique URL/rede no ambiente de deploy."
    } satisfies AuthValidationResult;
  }

  if (response.ok) {
    return { ok: true } satisfies AuthValidationResult;
  }

  const responseText = await response.text().catch(() => "");
  const normalized = responseText.toLowerCase();
  const isInvalidCredentials =
    (response.status === 400 || response.status === 401) &&
    (normalized.includes("invalid login credentials") ||
      normalized.includes("invalid credentials") ||
      normalized.includes("senha") ||
      normalized.includes("password") ||
      normalized.includes("credentials"));

  if (isInvalidCredentials) {
    return { ok: false, kind: "invalid-credentials" } satisfies AuthValidationResult;
  }

  if (response.status === 400 || response.status === 401) {
    return {
      ok: false,
      kind: "upstream-error",
      message: responseText
        ? `Supabase recusou autenticacao: ${response.status} ${responseText}`
        : `Supabase recusou autenticacao: ${response.status}.`
    } satisfies AuthValidationResult;
  }

  return {
    ok: false,
    kind: "upstream-error",
    message: responseText
      ? `Falha na autenticação via Supabase: ${response.status} ${responseText}`
      : `Falha na autenticação via Supabase: ${response.status}.`
  } satisfies AuthValidationResult;
}

function validateAgainstEnv(email: string, password: string) {
  const allowedEmail = (process.env.APP_LOGIN_EMAIL ?? "").trim().toLowerCase();
  const allowedPassword = process.env.APP_LOGIN_PASSWORD ?? "";

  if (!allowedEmail || !allowedPassword) {
    return false;
  }

  return email.trim().toLowerCase() === allowedEmail && password === allowedPassword;
}

export async function POST(request: NextRequest) {
  let payload: LoginBody;
  try {
    payload = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const email = String(payload.email ?? "").trim();
  const password = String(payload.password ?? "");

  if (!email || !password) {
    return NextResponse.json({ error: "Informe email e senha." }, { status: 400 });
  }

  const envValid = validateAgainstEnv(email, password);
  const supabaseResult = envValid ? { ok: false, kind: "invalid-credentials" as const } : await validateAgainstSupabase(email, password);

  if (!envValid && !supabaseResult.ok) {
    if (supabaseResult.kind === "misconfigured" || supabaseResult.kind === "upstream-error") {
      return NextResponse.json({ error: supabaseResult.message }, { status: 503 });
    }

    return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
  }

  const token = await createSessionToken(email);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionCookieMaxAge()
  });

  return response;
}
