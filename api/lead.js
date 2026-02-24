export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const payload = req.body;

    const ORTTO_API_KEY = process.env.ORTTO_API_KEY;
    const ORTTO_ENDPOINT = process.env.ORTTO_ENDPOINT;

    if (!ORTTO_API_KEY || !ORTTO_ENDPOINT) {
      return res.status(500).json({ error: "Missing ORTTO_API_KEY or ORTTO_ENDPOINT" });
    }

    const email = payload?.data?.email;
    if (!email) {
      return res.status(400).json({ error: "Missing email" });
    }

    const orttoBody = {
      activities: [
        {
          activity_id: "act:cm:retirement-calculator-submitted",
          attributes: {},
          fields: {
            "str::email": email,
            "str::first_name": payload?.data?.firstName || "",
            "str::last_name": payload?.data?.lastName || "",
            "str::country": payload?.data?.country || "",
            "str::phone": `${payload?.data?.phoneCode || ""}${payload?.data?.phone || ""}`,

            // calculator inputs
            "num::current_age": payload?.data?.currentAge ?? null,
            "num::retirement_age": payload?.data?.retirementAge ?? null,
            "num::current_savings": payload?.data?.currentSavings ?? null,
            "num::annual_salary": payload?.data?.annualSalary ?? null,
            "num::monthly_contribution": payload?.data?.monthlyContribution ?? null,
            "num::annual_return": payload?.data?.annualReturn ?? null,
            "num::inflation_rate": payload?.data?.inflationRate ?? null,
            "num::annual_expenses": payload?.data?.annualExpenses ?? null,
            "num::years_in_retirement": payload?.data?.yearsInRetirement ?? null,
            "str::currency": payload?.data?.currency || "USD",

            // results
            "num::total_at_retirement": payload?.results?.totalAtRetirement ?? null,
            "num::annual_income": payload?.results?.annualIncome ?? null,
            "num::years_to_retirement": payload?.results?.yearsToRetirement ?? null
          },
          location: {
            source_ip: req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || null,
            custom: null,
            address: null
          }
        }
      ],
      merge_by: ["str::email"]
    };

    const r = await fetch(ORTTO_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": ORTTO_API_KEY
      },
      body: JSON.stringify(orttoBody)
    });

    const text = await r.text();

    if (!r.ok) {
      return res.status(500).json({ error: "Ortto error", details: text });
    }

    return res.status(200).json({ ok: true, ortto: text });
  } catch (err) {
    return res.status(500).json({ error: "Server error", details: String(err) });
  }
}
