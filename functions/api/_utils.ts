// functions/api/_utils.ts
//
// Shared helpers for the portal's API functions:
//   - PBKDF2 password hashing (Web Crypto -- no external dependency, works
//     natively in the Workers runtime, unlike node-bcrypt).
//   - HMAC-signed session cookies (also Web Crypto -- a hand-rolled
//     stand-in for a JWT library, kept dependency-free on purpose).
//   - A single ArcGIS REST query helper that ALWAYS filters by ClientID
//     server-side. Every API route should call this rather than building
//     its own fetch() to ArcGIS, so the filter is enforced in one place.

export interface Env {
  DB: D1Database;
  SESSION_SECRET: string;   // random long string, set as a Cloudflare secret
  ARCGIS_API_KEY: string;   // ArcGIS API key with access to the layer, set as a secret
  ARCGIS_LAYER_URL: string; // e.g. https://services.arcgis.com/XXXX/ArcGIS/rest/services/PropertyPortal/FeatureServer/2
}

const encoder = new TextEncoder();

function toHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

// ---------------- password hashing ----------------

export async function hashPassword(password: string, saltHex?: string): Promise<{ hash: string; salt: string }> {
  const salt = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return { hash: toHex(bits), salt: toHex(salt) };
}

export async function verifyPassword(password: string, salt: string, expectedHash: string): Promise<boolean> {
  const { hash } = await hashPassword(password, salt);
  return hash === expectedHash;
}

// ---------------- signed session cookie ----------------

export interface SessionPayload {
  clientLoginId: string;
  clientId: string;
  clientName: string;
  exp: number; // unix seconds
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signSession(payload: SessionPayload, secret: string): Promise<string> {
  const body = btoa(JSON.stringify(payload));
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return `${body}.${toHex(sig)}`;
}

export async function verifySession(cookieValue: string, secret: string): Promise<SessionPayload | null> {
  const [body, sigHex] = cookieValue.split(".");
  if (!body || !sigHex) return null;

  const key = await hmacKey(secret);
  const valid = await crypto.subtle.verify("HMAC", key, fromHex(sigHex), encoder.encode(body));
  if (!valid) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(atob(body));
  } catch {
    return null;
  }
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  const match = header
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

// ---------------- ArcGIS REST query, always scoped by ClientID ----------------

export async function queryUnitsForClient(env: Env, clientId: string): Promise<any[]> {
  const url = new URL(env.ARCGIS_LAYER_URL.replace(/\/$/, "") + "/query");
  // Escape single quotes defensively -- clientId always comes from a
  // verified, signed session in practice, never straight from the
  // browser, but this keeps the query safe even if that ever changes.
  url.searchParams.set("where", `ClientID='${clientId.replace(/'/g, "''")}'`);
  url.searchParams.set("outFields", "*");
  url.searchParams.set("f", "json");
  url.searchParams.set("token", env.ARCGIS_API_KEY);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`ArcGIS query failed with status ${res.status}`);

  const data: any = await res.json();
  if (data.error) throw new Error(data.error.message || "ArcGIS returned an error.");

  return (data.features || []).map((f: any) => f.attributes);
}
