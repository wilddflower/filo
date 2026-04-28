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

  const toneStyle =
    tone === "helpful"
      ? "Warm and supportive — like a knowledgeable friend who genuinely wants to help. Lead with empathy, then show the path forward. Honest, not pushy."
      : tone === "informative"
      ? "Clear and educational — explain what the product does and why it matters for their specific situation. Concrete and specific, not vague. Still human."
      : "Confident and direct — lead with the value, make the offer feel generous, close with a clear next step. Persuasive but not salesy.";

  const prompt = `You are crafting a personalized ${medium} for ${authorName} on X (Twitter).
${founderName ? `You are ${founderName}, ` : ""}replying on behalf of ${company}.${productDesc ? ` What you do: ${productDesc}` : ""}

Their bio: "${authorBio}"${recentContext}

The post you're replying to:
"${postText}"

Max ${charLimit} characters.

Write the reply in exactly this 3-part flow (do NOT label the sections — just write naturally):

PART 1 — Respond directly to what they said. Be specific — name their exact situation, pain, or question. If they're expressing frustration or confusion, acknowledge it first before anything else.

PART 2 — Bridge from their specific situation to ${company}. Draw a direct line from the exact thing they mentioned in the tweet to what ${company} does — use their language. One or two sentences max. Make it feel obvious, not like a pitch. Do NOT use phrases like "this is literally what we built for" or "we exist for this."

PART 3 — The CTA: ${urlLine || `tell them how to try it or learn more.`}

Tone and style:
- ${toneStyle}
- Professional and warm. Not stiff corporate. Not Gen Z slang. Think: smart colleague who cares.
- Short, clear sentences. No em-dashes. No hashtags. No buzzwords.
- Sound like a real person who read their tweet carefully, not a brand account blasting replies.
- The product recommendation should feel earned — they should finish reading and think "that actually makes sense for me."

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
      temperature: 0.72,
      max_tokens: 400,
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
      `That's a real challenge.`,
      productDesc ? `${company} is built for exactly this — ${productDesc}.` : `${company} might be worth a look.`,
      productUrl && promoCode ? `Use ${promoCode} to get started: ${productUrl}` :
      productUrl ? `Learn more: ${productUrl}` :
      promoCode ? `Try it with code ${promoCode}.` : "Happy to share more if you're interested.",
    ].filter(Boolean).join(" ");
    res.json({ text: fallbackText, humanityScore: 5, humanityNote: "Fallback reply" });
  }
});

export default router;
