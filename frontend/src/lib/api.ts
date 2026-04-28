import type { Lead, FounderProfile } from "./types";
import { MOCK_LEADS } from "./data/mockLeads";

export async function generateReply(params: {
  postText: string;
  authorName: string;
  authorBio: string;
  recentPosts: string[];
  tone: string;
  tab: string;
  founderProfile?: FounderProfile | null;
}): Promise<{ text: string; humanityScore: number; humanityNote: string }> {
  const res = await fetch("/api/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error("Failed to generate reply");
  const data = await res.json();
  return { text: data.text as string, humanityScore: data.humanityScore ?? 0, humanityNote: data.humanityNote ?? "" };
}

export async function fetchLeads(): Promise<Lead[]> {
  try {
    const raw = localStorage.getItem("keywords");
    const keywords = raw ? JSON.parse(raw) : null;
    if (!keywords) {
      console.warn("[fetchLeads] No keywords in localStorage — using mock");
      return MOCK_LEADS;
    }

    console.log("[fetchLeads] Sending request with keywords:", Object.keys(keywords));
    const res = await fetch("/api/leads/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords }),
      signal: AbortSignal.timeout(120_000),
    });
    console.log("[fetchLeads] Response status:", res.status, res.ok);
    if (!res.ok) {
      console.error("[fetchLeads] Non-OK response:", res.status);
      return MOCK_LEADS;
    }
    const data = await res.json();
    console.log("[fetchLeads] source:", data.source, "pool:", data.pool, "leads:", data.leads?.length);
    const leads = data.leads as Lead[];
    return leads.length > 0 ? leads : MOCK_LEADS;
  } catch (e) {
    console.error("[fetchLeads] Error:", e);
    return MOCK_LEADS;
  }
}
