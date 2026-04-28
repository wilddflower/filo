import { Router } from "express";
import Groq from "groq-sdk";

const router = Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

router.post("/", async (req, res) => {
  const { postText, authorName, authorBio, recentPosts, tone, tab, founderProfile } = req.body;

  if (!postText) {
    res.status(400).json({ error: "postText is required" });
    return;
  }

  const isDM = tab === "dm";
  const charLimit = isDM ? 500 : 280;
  const medium = isDM ? "direct message (DM)" : "public reply";

  const recentContext = recentPosts?.length
    ? `\nTheir recent posts:\n${(recentPosts as string[]).map((p: string, i: number) => `${i + 1}. "${p}"`).join("\n")}`
    : "";

  const productDesc = founderProfile?.productDescription || founderProfile?.valueP || "";
  const company = founderProfile?.company || "us";
  const founderName = founderProfile?.name || "";
  const productUrl = founderProfile?.url || "";
  const promoCode = founderProfile?.promoCode || "";

  const urlLine = productUrl
    ? `End with the link: ${productUrl}${promoCode ? ` and drop the promo code "${promoCode}" right before it, casually — like "${promoCode} gets you in" or "use ${promoCode} at checkout".` : "."}`
    : promoCode
      ? `Include the promo code "${promoCode}" casually near the end — like "grab it with ${promoCode}" not "use code X".`
      : "";

  const prompt = `You are crafting a personalized ${medium} for ${authorName} on X (Twitter).
${founderName ? `You are ${founderName}, ` : ""}replying on behalf of ${company}.${productDesc ? ` What you do: ${productDesc}` : ""}${founderProfile?.style ? ` Your writing style: ${founderProfile.style}.` : ""}

Their bio: "${authorBio}"${recentContext}

The post you're replying to:
"${postText}"

Tone: ${tone}. Max ${charLimit} characters.

Write the reply in exactly this 3-part flow (do NOT label the sections — just write naturally):

PART 1 — Answer the tweet directly. Actually respond to what they said or asked. Be specific, name their exact situation. If they expressed pain or confusion, meet them there first before anything else.

PART 2 — Bridge from their specific situation to ${company}. Do NOT use generic phrases like "this is literally what we built X for" or "we exist for this". Instead, draw a direct line from the exact thing they mentioned in the tweet to what ${company} does — in their language, not yours. One or two sentences max. Make it feel like a lightbulb moment for them, not a pitch.

PART 3 — The CTA: ${urlLine || `tell them how to try it or learn more.`}

Rules:
- Gen Z casual energy. Short punchy sentences. No em-dashes. No hashtags. No corporate speak.
- Sound like a real human who genuinely wants to help, not a brand account pitching.
- The pitch should feel like a friend saying "omg you need to try this" not an ad.

Return a JSON object with exactly these fields, nothing else:
{
  "text": "<the reply text>",
  "humanityScore": <integer 1-10, where 10 = sounds completely human and genuine, 1 = obvious bot>,
  "humanityNote": "<one short phrase explaining the score>"
}`;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.75,
      max_tokens: 300,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
    const parsed = JSON.parse(raw);
    let text = (parsed.text ?? "").replace(/^["']|["']$/g, "").trim();
    const humanityScore = typeof parsed.humanityScore === "number" ? parsed.humanityScore : 0;
    const humanityNote = typeof parsed.humanityNote === "string" ? parsed.humanityNote : "";

    res.json({ text, humanityScore, humanityNote });
  } catch (err) {
    console.error("Reply generation error:", err);
    const fallbackText = [
      `Ugh yes this is so real.`,
      productDesc ? `This is literally why we built ${company} — ${productDesc}` : `This is exactly what ${company} is for.`,
      productUrl && promoCode ? `${promoCode} gets you in → ${productUrl}` :
      productUrl ? productUrl :
      promoCode ? `Try it with ${promoCode}.` : "Lmk if you wanna try it.",
    ].filter(Boolean).join(" ");
    res.json({ text: fallbackText, humanityScore: 5, humanityNote: "Fallback reply" });
  }
});

export default router;
