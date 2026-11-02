import {
  CARD_HEIGHT,
  CARD_WIDTH,
  slideFileName,
} from "./instagram-card";
import type { InstagramPost, InstagramSlide } from "./types";

const FONT_URL = "/api/fonts/pretendard";
let fontReady: Promise<void> | null = null;

function loadCardFont(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  if (fontReady) return fontReady;
  fontReady = (async () => {
    try {
      const face = new FontFace("Pretendard", `url(${FONT_URL})`, {
        weight: "700",
      });
      const loaded = await face.load();
      document.fonts.add(loaded);
      await document.fonts.ready;
    } catch {
      /* Malgun Gothic fallback */
    }
  })();
  return fontReady;
}

function wrapToWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const source = text.replace(/\s+/g, " ").trim();
  if (!source) return [];
  const lines: string[] = [];
  let current = "";
  for (const ch of [...source]) {
    const next = current + ch;
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current.trim());
      current = ch.trimStart();
    } else {
      current = next;
    }
  }
  if (current.trim()) lines.push(current.trim());
  return lines;
}

function headlineLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const source = text.trim();
  const comma = source.search(/[,，]/);
  if (comma > 0 && comma < source.length - 1) {
    const left = source.slice(0, comma + 1).trim();
    const right = source.slice(comma + 1).trim();
    if (left && right) return [left, right];
  }
  return wrapToWidth(ctx, source || " ", maxWidth).slice(0, 2);
}

export async function drawInstagramCard(
  slide: InstagramSlide,
  _index: number,
  _total: number,
  brand = "@soyeontem",
): Promise<HTMLCanvasElement> {
  await loadCardFont();
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("카드를 그리지 못했습니다.");

  ctx.fillStyle = "#F4EFE6";
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  const font = (size: number) =>
    `700 ${size}px Pretendard, "Malgun Gothic", sans-serif`;

  ctx.fillStyle = "#6B6560";
  ctx.font = font(28);
  ctx.fillText(slide.series || "퇴근 후 혼잣말", 72, 110);

  ctx.fillStyle = "#161513";
  ctx.font = font(76);
  const headlines = headlineLines(ctx, slide.headline || " ", 936);
  let y = 230;
  for (const line of headlines) {
    ctx.fillText(line, 72, y);
    y += 94;
  }

  y += 36;
  ctx.font = font(40);
  for (const row of slide.dialogues.slice(0, 3)) {
    if (!row.speaker && !row.line) continue;
    const speaker = row.speaker ? `${row.speaker}: ` : "";
    ctx.fillStyle = "#6B6560";
    ctx.fillText(speaker, 72, y);
    const speakerWidth = ctx.measureText(speaker).width;
    ctx.fillStyle = row.emphasis ? "#C4161C" : "#161513";
    const line = wrapToWidth(ctx, row.line || "", 936 - speakerWidth)[0] ?? "";
    ctx.fillText(line, 72 + speakerWidth, y);
    y += 78;
  }

  y += 28;
  ctx.fillStyle = "#161513";
  ctx.font = font(44);
  for (const line of wrapToWidth(ctx, slide.punch || "", 936).slice(0, 2)) {
    ctx.fillText(line, 72, y);
    y += 62;
  }

  ctx.fillStyle = "#3F3A36";
  ctx.font = font(30);
  y = Math.max(y + 36, 1180);
  for (const line of wrapToWidth(ctx, slide.question || "", 936).slice(0, 2)) {
    ctx.fillText(line, 72, y);
    y += 42;
  }

  ctx.fillStyle = "#8A837C";
  ctx.font = font(24);
  ctx.fillText(brand, 72, CARD_HEIGHT - 64);
  return canvas;
}

export async function downloadCardPng(
  post: InstagramPost,
  index: number,
  brand = "@soyeontem",
): Promise<string> {
  const slide = post.slides[index];
  if (!slide) throw new Error("카드가 없습니다.");
  const canvas = await drawInstagramCard(slide, index, post.slides.length, brand);
  const dataUrl = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = slideFileName(post, index);
  a.click();
  return dataUrl;
}
