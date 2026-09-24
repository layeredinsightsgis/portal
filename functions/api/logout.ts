// functions/api/logout.ts  -->  POST /api/logout
//
// Clears the session cookie by re-setting it with an immediate expiry.

export const onRequestPost: PagesFunction = async () => {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": "session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0"
    }
  });
};
