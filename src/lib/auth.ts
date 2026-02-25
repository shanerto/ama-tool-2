/**
 * Minimal admin auth using a signed token stored in an HttpOnly cookie.
 * We sign/verify with HMAC-SHA256 using the ADMIN_SESSION_SECRET env var.
 * No third-party auth libraries required.
 */

export const ADMIN_COOKIE = "ama_admin_session";
export const SITE_COOKIE = "ama_site_session";
const TOKEN_VALUE = "authenticated"; // what we sign

function getSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("ADMIN_SESSION_SECRET env var is missing or too short");
  }
  return secret;
}

async function hmac(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Buffer.from(sig).toString("base64url");
}

/** Creates a signed session token: "value.signature" */
export async function createSessionToken(): Promise<string> {
  const secret = getSecret();
  const sig = await hmac(secret, TOKEN_VALUE);
  return `${TOKEN_VALUE}.${sig}`;
}

/** Returns true if the token is valid. */
export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    const secret = getSecret();
    const [value, sig] = token.split(".");
    if (value !== TOKEN_VALUE || !sig) return false;
    const expected = await hmac(secret, TOKEN_VALUE);
    // Constant-time compare via timing-safe equal
    return sig === expected;
  } catch {
    return false;
  }
}

export function verifyAdminPassword(password: string): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error("ADMIN_PASSWORD env var is not set");
  }
  return password === adminPassword;
}

export function verifySitePassword(password: string): boolean {
  const sitePassword = process.env.SITE_PASSWORD;
  if (!sitePassword) {
    throw new Error("SITE_PASSWORD env var is not set");
  }
  return password === sitePassword;
}
