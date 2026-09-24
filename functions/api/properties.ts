// functions/api/properties.ts  -->  GET /api/properties
//
// Returns the signed-in client's own Units -- and only theirs. The
// ClientID used for the query comes exclusively from the verified
// session cookie set by /api/login, never from a query string or
// request body, so there's no way for a client to ask for someone
// else's portfolio by editing the request.

import { Env, getCookie, verifySession, queryUnitsForClient } from "./_utils";

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  const cookie = getCookie(request, "session");
  const session = cookie ? await verifySession(cookie, env.SESSION_SECRET) : null;

  if (!session) {
    return new Response(JSON.stringify({ error: "Not signed in." }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const units = await queryUnitsForClient(env, session.clientId);
    return new Response(JSON.stringify({ clientName: session.clientName, units }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: "Could not load properties.", detail: String(err?.message || err) }), {
      status: 502,
      headers: { "Content-Type": "application/json" }
    });
  }
};
