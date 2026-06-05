const ALLOWED_KEYS = ["PCPlayer26", "PC111412"];

const CORS = {
  "Access-Control-Allow-Origin": "https://eddie-bauer.github.io",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: CORS });
  }

  let body: { prompt?: string; playerKey?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const { prompt, playerKey } = body;

  if (!playerKey || !ALLOWED_KEYS.includes(playerKey)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  if (!prompt) {
    return new Response(JSON.stringify({ error: "Missing prompt" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const googleKey = Deno.env.get("GOOGLE_AI_KEY");
  if (!googleKey) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${googleKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );

  const data = await resp.json();
  return new Response(JSON.stringify(data), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
