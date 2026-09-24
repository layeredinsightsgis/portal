// src/index.ts
//
// A single Cloudflare Worker handling both the API routes and the static
// portal page. This replaces the earlier functions/api/*.ts (Pages
// Functions) setup -- this project turned out to be a Worker, not a
// Pages project, so it needs one fetch handler that routes requests
// itself and serves static files via the ASSETS binding, rather than
// Pages' automatic file-based routing.

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  SESSION_SECRET: string;
  ARCGIS_CLIENT_ID: string;
  ARCGIS_CLIENT_SECRET: string;
  ARCGIS_LAYER_URL: string;
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

async function hashPassword(password: string, saltHex?: string): Promise<{ hash: string; salt: string }> {
  const salt = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return { hash: toHex(bits), salt: toHex(salt) };
}

async function verifyPassword(password: string, salt: string, expectedHash: string): Promise<boolean> {
  const { hash } = await hashPassword(password, salt);
  return hash === expectedHash;
}

// ---------------- signed session cookie ----------------

interface SessionPayload {
  clientLoginId: string;
  clientId: string;
  clientName: string;
  exp: number;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

async function signSession(payload: SessionPayload, secret: string): Promise<string> {
  const body = btoa(JSON.stringify(payload));
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return `${body}.${toHex(sig)}`;
}

async function verifySession(cookieValue: string, secret: string): Promise<SessionPayload | null> {
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

function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  const match = header.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

// ---------------- ArcGIS OAuth token + REST query, always scoped by ClientID ----------------

// The trial org can't issue static API keys, so we use an OAuth 2.0
// "app authentication" (client_credentials) app instead. That means
// fetching a short-lived access token before each query rather than
// using one long-lived key. No caching yet -- traffic is low enough
// that a fresh token per request is fine; worth revisiting with a
// cached/shared token (e.g. in a KV or Durable Object) if volume grows.
async function getArcgisToken(env: Env): Promise<string> {
  const body = new URLSearchParams({
    client_id: env.ARCGIS_CLIENT_ID,
    client_secret: env.ARCGIS_CLIENT_SECRET,
    grant_type: "client_credentials",
    f: "json"
  });

  const res = await fetch("https://www.arcgis.com/sharing/rest/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });

  if (!res.ok) throw new Error(`ArcGIS token request failed with status ${res.status}`);
  const data: any = await res.json();
  if (data.error) throw new Error(data.error_description || data.error || "ArcGIS token request returned an error.");
  return data.access_token;
}

async function queryUnitsForClient(env: Env, clientId: string): Promise<any[]> {
  const token = await getArcgisToken(env);

  const url = new URL(env.ARCGIS_LAYER_URL.replace(/\/$/, "") + "/query");
  url.searchParams.set("where", `ClientID='${clientId.replace(/'/g, "''")}'`);
  url.searchParams.set("outFields", "*");
  url.searchParams.set("f", "json");
  url.searchParams.set("token", token);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`ArcGIS query failed with status ${res.status}`);
  const data: any = await res.json();
  if (data.error) throw new Error(data.error.message || "ArcGIS returned an error.");
  return (data.features || []).map((f: any) => f.attributes);
}

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders }
  });
}

// ---------------- route handlers ----------------

async function handleLogin(request: Request, env: Env): Promise<Response> {
  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const username = (body.username || "").trim().toLowerCase();
  const password = body.password || "";
  if (!username || !password) {
    return json({ error: "Username and password are required." }, 400);
  }

  const row = await env.DB
    .prepare("SELECT id, password_hash, salt, client_id, client_name FROM clients WHERE id = ?")
    .bind(username)
    .first<{ id: string; password_hash: string; salt: string; client_id: string; client_name: string }>();

  if (!row || !(await verifyPassword(password, row.salt, row.password_hash))) {
    return json({ error: "Incorrect username or password." }, 401);
  }

  const session = await signSession(
    {
      clientLoginId: row.id,
      clientId: row.client_id,
      clientName: row.client_name,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8
    },
    env.SESSION_SECRET
  );

  return json(
    { clientName: row.client_name },
    200,
    { "Set-Cookie": `session=${encodeURIComponent(session)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800` }
  );
}

async function handleLogout(): Promise<Response> {
  return json({ ok: true }, 200, { "Set-Cookie": "session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0" });
}

async function handleProperties(request: Request, env: Env): Promise<Response> {
  const cookie = getCookie(request, "session");
  const session = cookie ? await verifySession(cookie, env.SESSION_SECRET) : null;
  if (!session) return json({ error: "Not signed in." }, 401);

  try {
    const units = await queryUnitsForClient(env, session.clientId);
    return json({ clientName: session.clientName, units });
  } catch (err: any) {
    return json({ error: "Could not load properties.", detail: String(err?.message || err) }, 502);
  }
}

// ---------------- entry point ----------------

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/login" && request.method === "POST") return handleLogin(request, env);
    if (url.pathname === "/api/logout" && request.method === "POST") return handleLogout();
    if (url.pathname === "/api/properties" && request.method === "GET") return handleProperties(request, env);

    // Anything else falls through to the static files in public/
    return env.ASSETS.fetch(request);
  }
};
