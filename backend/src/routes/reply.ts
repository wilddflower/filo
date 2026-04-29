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

  const cloverContext = `AI growth agents that help founders crack distribution and get their first users — we build the engine that drives revenue on autopilot so founders can focus on the product`;
  const productContext = productDesc || cloverContext;

  const toneStyle =
    tone === "helpful"
      ? "Empathetic opener — acknowledge their pain like a founder who's been there. Then flip to excited when you drop the product. Warm but punchy."
      : tone === "informative"
      ? "Teach them something specific in 1 sentence, then show exactly how the product solves it. Concrete, no fluff."
      : "High energy start to finish. Catchy, confident, obvious next step. Make it feel like this was made for them.";

  const prompt = `You are crafting a personalized ${medium} for ${authorName} on X (Twitter).
${founderName ? `You are ${founderName}, ` : ""}replying on behalf of ${company}.${` What you do: ${productContext}`}

Their bio: "${authorBio}"${recentContext}

The post you're replying to:
"${postText}"

Max ${charLimit} characters.

Write the reply in exactly this 3-part flow (do NOT label the sections — just write naturally):

PART 1 — Respond directly to what they said in 1 sentence. Name their exact pain or situation. If they're frustrated, say so.

PART 2 — Echo one specific word, phrase, or situation from their tweet — then pivot to ${company} with energy. Structure: "[their specific thing] is exactly where ${company} comes in — we're [what you do in their terms]." Pull from their actual post. If they said "traction", use "traction". If they said "first users", say "first users". Make the connection feel inevitable, not generic. One or two sentences.

PART 3 — The CTA: ${urlLine || `Tell them to check it out — "get the ball rolling" energy. Give them a clear next step.`}

Tone and style:
- ${toneStyle}
- X/Twitter native energy — casual, punchy, how startup founders actually talk on here. Not corporate, not formal.
- The product intro (Part 2) should feel catchy and excited — like you genuinely love what you built, not a brand account blasting replies.
- Short sentences. NEVER use em-dashes (—). No hashtags. No buzzwords like "leverage", "streamline", "journey", or "game-changer".
- Sound like a real person who read their tweet and immediately thought "oh I know exactly what you need."

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
      temperature: 0.82,
      max_tokens: 400,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
    const parsed = JSON.parse(raw);
    let text = (parsed.text ?? "").replace(/^["']|["']$/g, "").replace(/\s*—\s*/g, " ").trim();
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
