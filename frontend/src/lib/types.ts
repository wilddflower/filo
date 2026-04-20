export type ScoreTier = "hi" | "md" | "lo";
export type Confidence = "high" | "med" | "low";
export type Tone = "helpful" | "informative" | "promotional";
export type SavedStatus = "new" | "reached-out" | "replied" | "waiting" | "converted" | "not-interested";

export interface Rationale {
  tag: string;
  text: string;
}

export interface Lead {
  id: string;
  name: string;
  handle: string;
  avatarHue: number;
  followers: string;
  time: string;
  timestamp: string;
  score: number;
  scoreTier: ScoreTier;
  confidence: Confidence;
  matched: string[];
  primaryKeyword: string;
  post: string;
  bio: string;
  location: string;
  website: string;
  hearts: number;
  reposts: number;
  replies: number;
  isReply: boolean;
  rationale: Rationale[];
  recentPosts: string[];
}

export interface SavedLead {
  leadId: string;
  savedOn: string;
  status: SavedStatus;
  list: string;
  note: string;
}

export interface LeadFilters {
  score: "all" | ScoreTier;
  time: "1h" | "6h" | "today" | "week";
  followers: "any" | "100" | "1k" | "10k";
}
