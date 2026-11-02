import type { Account, Draft, UniquenessReport } from "./types";

const BLOCK_AT = 35;
const WARN_AT = 22;

function normalize(text: string): string {
  return text.replace(/\s+/g, "").replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
}

function trigrams(text: string): Set<string> {
  const n = normalize(text);
  const grams = new Set<string>();
  if (n.length < 3) {
    if (n) grams.add(n);
    return grams;
  }
  for (let i = 0; i <= n.length - 3; i += 1) {
    grams.add(n.slice(i, i + 3));
  }
  return grams;
}

export function jaccardPercent(a: string, b: string): number {
  const A = trigrams(a);
  const B = trigrams(b);
  if (A.size === 0 && B.size === 0) return 0;
  let inter = 0;
  for (const g of A) {
    if (B.has(g)) inter += 1;
  }
  const union = A.size + B.size - inter;
  return Math.round((inter / union) * 100);
}

function fingerprint(draft: Pick<Draft, "selectedTitle" | "lead" | "sections">): string {
  const heads = draft.sections.map((s) => s.heading).join(" ");
  return `${draft.selectedTitle} ${draft.lead} ${heads}`;
}

export function scoreUniqueness(params: {
  candidate: Pick<Draft, "selectedTitle" | "lead" | "sections" | "accountId">;
  others: Draft[];
  accounts: Account[];
}): UniquenessReport {
  const { candidate, others, accounts } = params;
  const self = fingerprint(candidate);
  const accountName = (id: string) =>
    accounts.find((a) => a.id === id)?.name ?? "다른 계정";

  const matches = others
    .filter((d) => d.accountId !== candidate.accountId)
    .map((d) => ({
      accountName: accountName(d.accountId),
      title: d.selectedTitle,
      score: jaccardPercent(self, fingerprint(d)),
    }))
    .filter((m) => m.score >= 12)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const top = matches[0]?.score ?? 0;
  const notes: string[] = [];
  if (top >= BLOCK_AT) {
    notes.push(
      `다른 계정 글과 ${top}% 닮았습니다. 이 초안은 발행하면 클론으로 보입니다.`,
    );
  } else if (top >= WARN_AT) {
    notes.push(`다른 계정과 ${top}% 겹칩니다. 제목·첫 문단을 다시 쓰는 편이 안전합니다.`);
  } else {
    notes.push("다른 계정 글과 충분히 갈라져 있습니다.");
  }

  return {
    score: top,
    blocked: top >= BLOCK_AT,
    warning: top >= WARN_AT && top < BLOCK_AT,
    matches,
    notes,
  };
}
