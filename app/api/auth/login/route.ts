import { NextRequest, NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, createSessionToken, sessionCookieMaxAge } from "@/lib/auth/session";

type LoginBody = {
  email?: string;
  password?: string;
};

function supabaseAuthBaseUrl() {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "").replace(/\/rest\/v1$/i, "");
}

async function validateAgainstSupabase(email: string, password: string) {
  const baseUrl = supabaseAuthBaseUrl();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  if (!baseUrl || !anonKey) {
    return false;
  }

  const response = await fetch(`${baseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });

  return response.ok;
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
  const supabaseValid = envValid ? false : await validateAgainstSupabase(email, password);

  if (!envValid && !supabaseValid) {
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
