import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";

export const CAPTION_MAX_WIDTH = 12;
export const CAPTION_MAX_LINES = 1;
export const FONT_FAMILY = "Pretendard";
export const SHORTS_WIDTH = 1080;
export const SHORTS_HEIGHT = 1920;
export const CAPTION_MARGIN_V = 640;
export const CAPTION_FONT_SIZE = 84;
export const CAPTION_OUTLINE = 7;
export const CAPTION_ALIGN = 8;

const HANGUL = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/;
const BREAK_AFTER = /[\s,.\?!/~…·]/;

export type CaptionCue = {
  start: number;
  end: number;
  text: string;
  style: "Hook" | "Body" | "Cta";
};

export function glyphWidth(ch: string): number {
  if (HANGUL.test(ch)) return 1;
  if (ch === " ") return 0.4;
  return 0.55;
}

export function displayWidth(text: string): number {
  let width = 0;
  for (const ch of text) width += glyphWidth(ch);
  return width;
}

function lastBreakIndex(text: string): number {
  for (let i = text.length - 1; i > 0; i -= 1) {
    if (BREAK_AFTER.test(text[i]!)) return i + 1;
  }
  return -1;
}

export function wrapCaptionLine(
  text: string,
  maxWidth = CAPTION_MAX_WIDTH,
): string[] {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return [];
  if (displayWidth(trimmed) <= maxWidth) return [trimmed];

  const lines: string[] = [];
  let current = "";
  for (const ch of trimmed) {
    const next = current + ch;
    if (displayWidth(next) <= maxWidth) {
      current = next;
      if (/[.?!…]$/.test(current.trim())) {
        lines.push(current.trim());
        current = "";
      }
      continue;
    }
    const cut = lastBreakIndex(current);
    if (cut > 0 && cut < current.length) {
      lines.push(current.slice(0, cut).trim());
      current = `${current.slice(cut).trim()}${ch}`;
    } else {
      lines.push(current.trim());
      current = ch;
    }
  }
  if (current.trim()) lines.push(current.trim());
  return lines.filter(Boolean);
}

export function chunkCaptionLines(
  lines: string[],
  maxLines = CAPTION_MAX_LINES,
): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < lines.length; i += maxLines) {
    chunks.push(lines.slice(i, i + maxLines).join("\n"));
  }
  return chunks;
}

export function scriptToCues(
  script: string,
  durationSec: number,
): CaptionCue[] {
  const paragraphs = script
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const chunks: { text: string; style: CaptionCue["style"]; weight: number }[] =
    [];

  const lastIndex = paragraphs.length - 1;
  paragraphs.forEach((paragraph, index) => {
    const wrapped = chunkCaptionLines(wrapCaptionLine(paragraph));
    wrapped.forEach((text, part) => {
      const isCta =
        index === lastIndex && part === wrapped.length - 1 && lastIndex > 0;
      chunks.push({
        text,
        style: isCta ? "Cta" : index === 0 ? "Hook" : "Body",
        weight: Math.max(displayWidth(text.replace(/\n/g, "")), 4),
      });
    });
  });

  if (chunks.length === 0) return [];

  const totalWeight = chunks.reduce((sum, chunk) => sum + chunk.weight, 0);
  const usable = Math.max(durationSec - 0.12, 0.8);
  const floor = Math.min(0.65, usable / chunks.length);
  let cursor = 0.04;
  return chunks.map((chunk, index) => {
    const share = (chunk.weight / totalWeight) * usable;
    const length = Math.max(share, floor);
    const start = cursor;
    const end =
      index === chunks.length - 1
        ? Math.max(durationSec - 0.04, start + 0.35)
        : Math.min(start + length, durationSec - 0.04);
    cursor = end;
    return { start, end, text: chunk.text, style: chunk.style };
  }).filter((cue) => cue.end > cue.start + 0.05);
}

function assTime(sec: number): string {
  const clamped = Math.max(0, sec);
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = clamped % 60;
  const whole = Math.floor(s);
  const cs = Math.min(99, Math.round((s - whole) * 100));
  return `${h}:${String(m).padStart(2, "0")}:${String(whole).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function assEscape(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/\n/g, "\\N");
}

function fadeTag(cue: CaptionCue): string {
  const ms = Math.round((cue.end - cue.start) * 1000);
  const fadeIn = Math.min(180, Math.max(80, Math.floor(ms * 0.22)));
  const fadeOut = Math.min(160, Math.max(70, Math.floor(ms * 0.18)));
  return `{\\an${CAPTION_ALIGN}\\fad(${fadeIn},${fadeOut})}`;
}

export function buildAssDocument(cues: CaptionCue[]): string {
  const events = cues
    .map(
      (cue) =>
        `Dialogue: 0,${assTime(cue.start)},${assTime(cue.end)},${cue.style},,0,0,0,,${fadeTag(cue)}${assEscape(cue.text)}`,
    )
    .join("\n");

  return `[Script Info]
Title: 쇼츠 자막
ScriptType: v4.00+
PlayResX: ${SHORTS_WIDTH}
PlayResY: ${SHORTS_HEIGHT}
LayoutResX: ${SHORTS_WIDTH}
LayoutResY: ${SHORTS_HEIGHT}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Hook,${FONT_FAMILY},${CAPTION_FONT_SIZE},&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,${CAPTION_OUTLINE},0,${CAPTION_ALIGN},56,56,${CAPTION_MARGIN_V},1
Style: Body,${FONT_FAMILY},${CAPTION_FONT_SIZE},&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,${CAPTION_OUTLINE},0,${CAPTION_ALIGN},56,56,${CAPTION_MARGIN_V},1
Style: Cta,${FONT_FAMILY},${CAPTION_FONT_SIZE},&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,${CAPTION_OUTLINE},0,${CAPTION_ALIGN},56,56,${CAPTION_MARGIN_V},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events}
`;
}

export function resolveCaptionFont(): { file: string; dir: string } {
  const bundled = path.join(process.cwd(), "fonts", "Pretendard-Bold.otf");
  const candidates = [
    bundled,
    path.join(__dirname, "..", "fonts", "Pretendard-Bold.otf"),
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    "C:\\Windows\\Fonts\\malgunbd.ttf",
  ];
  const file = candidates.find((candidate) => existsSync(candidate));
  if (!file) {
    throw new Error("한글 자막 폰트를 찾지 못했습니다. fonts/Pretendard-Bold.otf 가 필요합니다.");
  }
  return { file, dir: path.dirname(file) };
}

export async function writeCaptionsAss(
  script: string,
  durationSec: number,
  outputPath: string,
): Promise<CaptionCue[]> {
  const cues = scriptToCues(script, durationSec);
  await writeFile(outputPath, buildAssDocument(cues), "utf8");
  return cues;
}

export function assFilterArg(assPath: string, fontsDir: string): string {
  const file = assPath.replace(/\\/g, "/").replace(/:/g, "\\:");
  const dir = fontsDir.replace(/\\/g, "/").replace(/:/g, "\\:");
  return `ass='${file}':fontsdir='${dir}':original_size=${SHORTS_WIDTH}x${SHORTS_HEIGHT}`;
}
