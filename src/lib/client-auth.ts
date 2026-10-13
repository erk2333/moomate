export function participantToken(): string { return typeof window === "undefined" ? "" : localStorage.getItem("moomate_token") || ""; }
export function authHeaders(extra: Record<string, string> = {}): HeadersInit { return { ...extra, Authorization: `Bearer ${participantToken()}` }; }
