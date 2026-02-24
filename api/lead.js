export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const ORTTO_API_KEY = process.env.ORTTO_API_KEY;
    const ORTTO_ENDPOINT = process.env.ORTTO_ENDPOINT;

    if (!ORTTO_API_KEY || !ORTTO_ENDPOINT) {
      return res.status(500).json({
        error: "Missing env vars",
        missing: {
          ORTTO_API_KEY: !ORTTO_API_KEY,
          ORTTO_ENDPOINT: !ORTTO_ENDPOINT,
        },
      });
    }

    const payload = req.body || {};
    const email = payload?.data?.email;

    if (!email) {
      return res.status(400).json({ error: "Missing email in payload.data.email" });
    }

    // Minimal Ortto body (from your Ortto snippet)
    const orttoBody = {
      activities: [
        {
          activity_id: "act:cm:retirement-calculator-submitted",
          attributes: {},
          fields: {
            "str::email": email,
          },
          location: {
            source_ip: req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || null,
            custom: null,
            address: null,
          },
        },
      ],
      merge_by: ["str::email"],
    };

    const r = await fetch(ORTTO_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": ORTTO_API_KEY,
      },
      body: JSON.stringify(orttoBody),
    });

    const text = await r.text();

    // Return Ortto response so you can see it in browser Network -> Response
    return res.status(r.ok ? 200 : 500).json({
      ok: r.ok,
      orttoStatus: r.status,
      orttoResponse: text,
    });
  } catch (err) {
    return res.status(500).json({ error: "Server error", details: String(err) });
  }
}
