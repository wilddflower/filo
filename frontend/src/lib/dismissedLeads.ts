const KEY = "dismissedLeads";

export function getDismissed(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function dismiss(id: string): void {
  const ids = getDismissed();
  if (!ids.includes(id)) {
    localStorage.setItem(KEY, JSON.stringify([...ids, id]));
  }
}

export function isDismissed(id: string): boolean {
  return getDismissed().includes(id);
}
