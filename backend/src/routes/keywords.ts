import { Router } from "express";
import Groq from "groq-sdk";

const router = Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

router.post("/", async (req, res) => {
  const { company, productDescription, competitors } = req.body as {
    company?: string;
    productDescription?: string;
    competitors?: string[];
  };

  const companyStr = company ?? "";
  const descStr = productDescription ?? "";
  const compList = Array.isArray(competitors) ? competitors : [];

  const prompt = `You are generating X (Twitter) search keywords to find early-stage founders who are struggling with growth and distribution for their B2C product. These founders are potential customers for ${companyStr}: ${descStr}.

Return a JSON object with exactly these keys:
{ "leadFinding": [...5 short phrases], "competitorAnalysis": [...5 short phrases], "marketResearch": [...5 short phrases] }

leadFinding: phrases founders post when they're struggling to get users or traction — things like desperation about signups, user acquisition pain, "how do I grow", launch going nowhere. Short, natural, search-friendly phrases people actually tweet.
competitorAnalysis: mentions of competing growth tools or frustrated complaints about current solutions${compList.length ? ` — especially: ${compList.join(", ")}` : " like paid ads, cold email, growth agencies"}.
marketResearch: broader pain points founders express about distribution, PMF without growth, getting the word out, B2C marketing as a solo founder.

Keep each phrase under 5 words, no hashtags, no quotes. Return only valid JSON, no commentary.`;

  const fallback = () => {
    res.json({
      leadFinding: ["first 100 users", "user acquisition", "getting traction", "startup growth", "need more users"],
      competitorAnalysis: compList.length
        ? compList.slice(0, 5)
        : ["growth hack", "organic growth", "paid ads failing", "cold email tips", "referral program"],
      marketResearch: ["distribution strategy", "product market fit", "launch strategy", "b2c marketing", "founder growth"],
    });
  };

  const timeoutMs = 4000;
  const timer = setTimeout(() => {
    fallback();
  }, timeoutMs);

  let responded = false;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 400,
      response_format: { type: "json_object" },
    });

    clearTimeout(timer);
    if (responded) return;
    responded = true;

    const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
    const parsed = JSON.parse(raw);
    res.json({
      leadFinding: Array.isArray(parsed.leadFinding) ? parsed.leadFinding : [],
      competitorAnalysis: Array.isArray(parsed.competitorAnalysis) ? parsed.competitorAnalysis : [],
      marketResearch: Array.isArray(parsed.marketResearch) ? parsed.marketResearch : [],
    });
  } catch {
    clearTimeout(timer);
    if (!responded) {
      responded = true;
      fallback();
    }
  }
});

export default router;
