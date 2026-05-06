import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  return NextResponse.json({ email: session.email });
}
