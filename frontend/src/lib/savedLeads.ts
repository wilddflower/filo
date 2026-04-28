import type { Lead, SavedStatus } from "./types";

export interface SavedEntry {
  lead: Lead;
  savedOn: string;
  status: SavedStatus;
}

const KEY = "savedLeads";

export function getSaved(): SavedEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function persist(entries: SavedEntry[]) {
  localStorage.setItem(KEY, JSON.stringify(entries));
}

export function saveLead(lead: Lead): void {
  const entries = getSaved().filter((e) => e.lead.id !== lead.id);
  entries.unshift({ lead, savedOn: new Date().toISOString(), status: "new" });
  persist(entries);
}

export function unsaveLead(id: string): void {
  persist(getSaved().filter((e) => e.lead.id !== id));
}

export function isSaved(id: string): boolean {
  return getSaved().some((e) => e.lead.id === id);
}

export function updateStatus(id: string, status: SavedStatus): void {
  persist(getSaved().map((e) => (e.lead.id === id ? { ...e, status } : e)));
}
