import { SOCIAL_SERIES } from "./instagram-schedule";
import type {
  InstagramDialogue,
  InstagramPost,
  InstagramSlide,
} from "./types";

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

export const INSTAGRAM_STATUS_LABEL: Record<InstagramPost["status"], string> = {
  draft: "작성중",
  changes: "수정 요청",
  hold: "보류",
  approved: "승인",
  posted: "게시됨",
};

export function wrapCardLines(text: string, maxChars: number): string[] {
  const source = text.replace(/\s+/g, " ").trim();
  if (!source) return [];
  const lines: string[] = [];
  let current = "";
  for (const ch of [...source]) {
    const next = current + ch;
    if (next.length > maxChars && current) {
      lines.push(current.trim());
      current = ch.trimStart();
    } else {
      current = next;
    }
  }
  if (current.trim()) lines.push(current.trim());
  return lines.slice(0, 8);
}

export function slideFileName(post: InstagramPost, index: number): string {
  const safe = (post.headline || post.topic || "card")
    .replace(/[\\/:*?"<>|]+/g, "")
    .slice(0, 24);
  return `${safe}-${index + 1}.png`;
}

export function emptyDialogue(emphasis = false): InstagramDialogue {
  return { speaker: "", line: "", emphasis };
}

export function emptySlide(headline = ""): InstagramSlide {
  return {
    series: SOCIAL_SERIES,
    headline,
    dialogues: [emptyDialogue(), emptyDialogue(), emptyDialogue(true)],
    punch: "",
    question: "",
    body: "",
  };
}

export function normalizeSlide(raw: Partial<InstagramSlide> | null | undefined): InstagramSlide {
  const dialogues = Array.isArray(raw?.dialogues)
    ? raw.dialogues
        .map((item) => ({
          speaker: (item?.speaker ?? "").trim(),
          line: (item?.line ?? "").trim(),
          emphasis: Boolean(item?.emphasis),
        }))
        .filter((item) => item.speaker || item.line)
        .slice(0, 3)
    : [];
  while (dialogues.length < 3) {
    dialogues.push(emptyDialogue(false));
  }
  const firstHit = dialogues.findIndex((item) => item.emphasis);
  dialogues.forEach((item, index) => {
    item.emphasis = firstHit >= 0 ? index === firstHit : index === 2;
  });
  const headline = (raw?.headline ?? "").trim();
  const body = (raw?.body ?? "").trim();
  return {
    series: (raw?.series ?? "").trim() || SOCIAL_SERIES,
    headline,
    dialogues,
    punch: (raw?.punch ?? "").trim(),
    question: (raw?.question ?? "").trim(),
    body,
  };
}

export function cardCopy(slide: InstagramSlide): string {
  const lines = slide.dialogues
    .filter((item) => item.speaker || item.line)
    .map((item) =>
      item.speaker && item.line
        ? `${item.speaker}: ${item.line}`
        : item.line || item.speaker,
    );
  return [slide.series, slide.headline, ...lines, slide.punch, slide.question, slide.body]
    .filter(Boolean)
    .join("\n");
}

export function captionForCopy(post: InstagramPost): string {
  const tags = post.hashtags
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
    .join(" ");
  return [post.caption.trim(), tags].filter(Boolean).join("\n\n");
}
