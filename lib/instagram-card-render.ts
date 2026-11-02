import { createCanvas, GlobalFonts, type SKRSContext2D } from "@napi-rs/canvas";
import path from "node:path";
import { CARD_HEIGHT, CARD_WIDTH } from "./instagram-card";
import type { InstagramSlide } from "./types";

let fontReady = false;

function ensureFont(): void {
  if (fontReady) return;
  GlobalFonts.registerFromPath(
    path.join(process.cwd(), "fonts", "Pretendard-Bold.otf"),
    "Pretendard",
  );
  fontReady = true;
}

function wrapToWidth(ctx: SKRSContext2D, text: string, maxWidth: number): string[] {
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

function headlineLines(ctx: SKRSContext2D, text: string, maxWidth: number): string[] {
  const source = text.trim();
  const comma = source.search(/[,，]/);
  if (comma > 0 && comma < source.length - 1) {
    const left = source.slice(0, comma + 1).trim();
    const right = source.slice(comma + 1).trim();
    if (left && right) return [left, right];
  }
  return wrapToWidth(ctx, source || " ", maxWidth).slice(0, 2);
}

export async function renderInstagramCardPng(
  slide: InstagramSlide,
  brand = "@soyeontem",
): Promise<Buffer> {
  ensureFont();
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext("2d");
  const font = (size: number) => `700 ${size}px Pretendard`;

  ctx.fillStyle = "#F4EFE6";
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

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
  return canvas.toBuffer("image/png");
}
