export type ScoreTier = "hi" | "md" | "lo";
export type Platform = "x" | "facebook";
export type PostCategory = "Lead Finding" | "Competitor Analysis" | "Market Research";
export type Confidence = "high" | "med" | "low";

export interface Keywords {
  leadFinding: string[];
  competitorAnalysis: string[];
  marketResearch: string[];
}

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
  platform: Platform;
  groupName?: string;
}
