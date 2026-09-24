// functions/api/login.ts  -->  POST /api/login
//
// Checks the submitted username/password against the D1 "clients" table
// and, on success, sets a signed session cookie carrying that login's
// ClientID. Every other API route trusts ONLY this cookie for who's
// asking -- never a value the browser sends directly in a request body
// or query string.

import { Env, verifyPassword, signSession } from "./_utils";

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

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

  // Same error for "no such user" and "wrong password" -- don't reveal
  // which one it was.
  if (!row || !(await verifyPassword(password, row.salt, row.password_hash))) {
    return json({ error: "Incorrect username or password." }, 401);
  }

  const session = await signSession(
    {
      clientLoginId: row.id,
      clientId: row.client_id,
      clientName: row.client_name,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8 // 8-hour session
    },
    env.SESSION_SECRET
  );

  return new Response(JSON.stringify({ clientName: row.client_name }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": `session=${encodeURIComponent(session)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`
    }
  });
};

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}
