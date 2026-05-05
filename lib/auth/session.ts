export const AUTH_COOKIE_NAME = "bnc_auth_session";

const DEFAULT_MAX_AGE_SECONDS = 60 * 60 * 12;

type SessionPayload = {
  email: string;
  exp: number;
};

function getAuthSecret() {
  return (
    process.env.APP_AUTH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "bnc-dev-secret-change"
  );
}

function toBase64UrlFromBytes(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function fromBase64UrlToText(value: string) {
  const bytes = fromBase64UrlToBytes(value);
  return new TextDecoder().decode(bytes);
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getAuthSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return toBase64UrlFromBytes(new Uint8Array(signature));
}

export async function createSessionToken(email: string, maxAgeSeconds = DEFAULT_MAX_AGE_SECONDS) {
  const payload: SessionPayload = {
    email,
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds
  };

  const payloadText = JSON.stringify(payload);
  const payloadEncoded = toBase64UrlFromBytes(new TextEncoder().encode(payloadText));
  const signature = await sign(payloadEncoded);
  return `${payloadEncoded}.${signature}`;
}

export async function verifySessionToken(token?: string | null): Promise<SessionPayload | null> {
  if (!token) {
    return null;
  }

  const [payloadEncoded, signature] = token.split(".");
  if (!payloadEncoded || !signature) {
    return null;
  }

  const expected = await sign(payloadEncoded);
  if (expected !== signature) {
    return null;
  }

  try {
    const payloadText = fromBase64UrlToText(payloadEncoded);
    const payload = JSON.parse(payloadText) as SessionPayload;

    if (!payload.email || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function sessionCookieMaxAge() {
  return DEFAULT_MAX_AGE_SECONDS;
}
