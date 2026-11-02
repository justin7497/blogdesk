export const DEFAULT_SOCIAL_HANDLE = "soyeontem";
export const DEFAULT_SOCIAL_NAME = "소연";
export const DEFAULT_SOCIAL_BIO =
  "야근에 지쳐도 내 일상은 소중하니까. 퇴근 후 힐링 꿀템.";

export function normalizeHandle(value: string): string {
  return value
    .trim()
    .replace(/^@/, "")
    .replace(/[^a-zA-Z0-9._]/g, "")
    .slice(0, 30);
}

export function instagramProfileUrl(handle: string): string {
  const id = normalizeHandle(handle);
  return id ? `https://www.instagram.com/${id}/` : "https://www.instagram.com/";
}

export function threadsProfileUrl(handle: string): string {
  const id = normalizeHandle(handle);
  return id ? `https://www.threads.net/@${id}` : "https://www.threads.net/";
}

export function accountLabel(name: string, handle: string): string {
  const id = normalizeHandle(handle);
  if (name && id) return `${name} · @${id}`;
  if (id) return `@${id}`;
  return name || "계정";
}
