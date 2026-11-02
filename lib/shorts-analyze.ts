import { readFile } from "node:fs/promises";
import path from "node:path";
import { extractFrames } from "./ffmpeg";
import { jobDir } from "./shorts";
import { normalizeHookType, shortsScriptPrompt } from "./shorts-script-prompt";
import type { Settings } from "./types";

export type ShortsScript = {
  title: string;
  hook: string;
  hookType: string;
  script: string;
  scriptAlt: string;
};

function openaiKey(settings: Settings): string {
  const dedicated = (settings.openaiApiKey ?? "").trim();
  if (dedicated.startsWith("sk-") && !dedicated.startsWith("sk-ant")) {
    return dedicated;
  }
  const main = (settings.apiKey ?? "").trim();
  if (main.startsWith("sk-") && !main.startsWith("sk-ant")) return main;
  return "";
}

function extractJson(text: string): ShortsScript {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced?.[1] ?? text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0) {
    throw new Error("모델이 JSON을 반환하지 않았습니다.");
  }
  const parsed = JSON.parse(raw.slice(start, end + 1)) as Partial<ShortsScript>;
  const script = (parsed.script ?? "").trim();
  if (!script) throw new Error("대본이 비어 있습니다.");
  return {
    title: (parsed.title ?? "").trim() || "쇼츠 대본",
    hook: (parsed.hook ?? "").trim(),
    hookType: normalizeHookType(parsed.hookType),
    script,
    scriptAlt: (parsed.scriptAlt ?? "").trim(),
  };
}

function openaiError(status: number, body: string): Error {
  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: string; code?: string };
    };
    if (parsed.error?.message) {
      return new Error(`OpenAI: ${parsed.error.message}`);
    }
  } catch {
    /* keep raw */
  }
  return new Error(`OpenAI 오류: ${status} ${body.slice(0, 240)}`);
}

async function openaiWithFrames(
  apiKey: string,
  images: { mime: string; data: string }[],
  durationSec: number,
  remix = false,
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: remix ? 0.85 : 0.6,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: shortsScriptPrompt(durationSec, remix) },
            ...images.map((img) => ({
              type: "image_url",
              image_url: { url: `data:${img.mime};base64,${img.data}` },
            })),
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw openaiError(res.status, await res.text());
  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  return data.choices[0]?.message?.content ?? "";
}

export async function analyzeShortsVideo(input: {
  settings: Settings;
  videoPath: string;
  durationSec: number;
  jobId: string;
  remix?: boolean;
}): Promise<ShortsScript> {
  const { settings, videoPath, durationSec, jobId, remix } = input;
  const apiKey = openaiKey(settings);
  if (!apiKey) {
    throw new Error("설정에 OpenAI API 키를 넣어 주세요. 쇼츠 대본은 gpt-4o를 사용합니다.");
  }
  const frames = await extractFrames(
    videoPath,
    path.join(jobDir(jobId), "frames"),
    8,
  );
  const images = await Promise.all(
    frames.map(async (file) => ({
      mime: "image/jpeg",
      data: (await readFile(file)).toString("base64"),
    })),
  );
  return extractJson(
    await openaiWithFrames(apiKey, images, durationSec, remix),
  );
}
