import { clampSpeechSpeed } from "./elevenlabs";

export const TYPECAST_FEATURED: { match: RegExp; label: string; hint: string }[] = [
  { match: /민주|minju/i, label: "민주", hint: "쇼핑" },
  { match: /필재|piljae/i, label: "필재", hint: "남성" },
];

export type TypecastVoice = {
  voice_id: string;
  name: string;
  model?: string;
  voice_type?: string;
  use_cases?: string[];
};

export type TypecastCatalogCheck = {
  ok: boolean;
  count: number;
  featured: { label: string; found: boolean; name: string }[];
};

type NamedVoice = { id?: string; voice_id?: string; name: string };

type RawVoice = {
  voice_id?: string;
  voice_type?: string;
  use_cases?: string[];
  voice_name?: { kor?: string; eng?: string };
  name?: string;
  models?: { version?: string }[];
};

function voiceIdOf(voice: NamedVoice): string {
  return voice.id || voice.voice_id || "";
}

export function isTypecastVoiceId(id?: string): boolean {
  return Boolean(id && /^(tc_|uc_)/i.test(id.trim()));
}

function displayName(voice: RawVoice): string {
  return (
    voice.voice_name?.kor?.trim() ||
    voice.voice_name?.eng?.trim() ||
    voice.name?.trim() ||
    voice.voice_id ||
    "타입캐스트"
  );
}

export function featuredTypecastIndex(name: string): number {
  return TYPECAST_FEATURED.findIndex((item) => item.match.test(name));
}

export function typecastVoiceLabel(name: string): string {
  const hit = TYPECAST_FEATURED.find((item) => item.match.test(name));
  if (!hit) return name;
  return hit.hint ? `${hit.label} (${hit.hint})` : hit.label;
}

export function verifyTypecastCatalog(
  voices: { name: string }[],
): TypecastCatalogCheck {
  const featured = TYPECAST_FEATURED.map((item) => {
    const hit = voices.find((voice) => item.match.test(voice.name));
    return {
      label: item.label,
      found: Boolean(hit),
      name: hit?.name || "",
    };
  });
  return {
    ok: featured.every((item) => item.found),
    count: voices.length,
    featured,
  };
}

function voiceRank(voice: TypecastVoice): number {
  const featured = featuredTypecastIndex(voice.name);
  if (featured >= 0) return featured;
  if (voice.voice_type === "custom") return 10;
  if (voice.use_cases?.some((item) => /ad/i.test(item))) return 11;
  return 12;
}

export function pickTypecastVoiceId(voices: NamedVoice[]): string {
  for (const item of TYPECAST_FEATURED) {
    const hit = voices.find((voice) => item.match.test(voice.name));
    if (hit) return voiceIdOf(hit);
  }
  return voiceIdOf(voices[0] || { name: "" });
}

function asVoiceList(data: unknown): RawVoice[] {
  if (Array.isArray(data)) return data as RawVoice[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["voices", "data", "results", "items"]) {
      if (Array.isArray(obj[key])) return obj[key] as RawVoice[];
    }
  }
  return [];
}

function mapVoices(raw: RawVoice[]): TypecastVoice[] {
  return raw
    .filter((voice) => voice.voice_id)
    .map((voice) => {
      const versions = (voice.models ?? [])
        .map((model) => model.version)
        .filter((version): version is string => Boolean(version));
      return {
        voice_id: voice.voice_id as string,
        name: displayName(voice),
        model: versions.includes("ssfm-v30")
          ? "ssfm-v30"
          : versions[0] || "ssfm-v30",
        voice_type: voice.voice_type,
        use_cases: voice.use_cases,
      };
    });
}

function normalizeTypecastKey(apiKey: string): string {
  return apiKey
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/^Bearer\s+/i, "")
    .replace(/^["']|["']$/g, "")
    .trim();
}

function applyAuth(
  headers: Headers,
  key: string,
  mode: "x-api-key" | "bearer" | "both",
) {
  if (mode === "x-api-key" || mode === "both") headers.set("X-API-KEY", key);
  if (mode === "bearer" || mode === "both") {
    headers.set("Authorization", `Bearer ${key}`);
  }
}

async function typecastRequest(
  path: string,
  apiKey: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = path.startsWith("http") ? path : `https://api.typecast.ai${path}`;
  const key = normalizeTypecastKey(apiKey);
  if (!key) {
    throw new Error("타입캐스트 API 키가 없습니다. 설정에서 다시 저장해 주세요.");
  }
  const modes = ["x-api-key", "bearer", "both"] as const;
  let last: Response | undefined;
  for (const [index, mode] of modes.entries()) {
    const headers = new Headers(init.headers);
    headers.delete("Accept");
    headers.set("User-Agent", "blogdesk-shorts/1.0");
    applyAuth(headers, key, mode);
    const res = await fetch(url, { ...init, headers, cache: "no-store" });
    if (res.status !== 401) return res;
    last = res;
    if (index < modes.length - 1) await res.text().catch(() => undefined);
  }
  return last as Response;
}

export async function listTypecastVoices(
  apiKey: string,
): Promise<TypecastVoice[]> {
  const res = await typecastRequest("/v3/voices", apiKey);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `타입캐스트 보이스 목록 오류: ${res.status} ${body.slice(0, 240)}`,
    );
  }
  const voices = mapVoices(asVoiceList(await res.json()));
  return voices.sort((a, b) => {
    const rank = voiceRank(a) - voiceRank(b);
    if (rank !== 0) return rank;
    return a.name.localeCompare(b.name, "ko");
  });
}

export function splitSpokenLines(text: string): string[] {
  const byBreak = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (byBreak.length >= 2) return byBreak.slice(0, 25);
  return text
    .split(/(?<=[.?!…])\s+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 25);
}

function ttsOutput(speed?: number) {
  return {
    audio_tempo: clampSpeechSpeed(speed, 0.5, 2),
    audio_format: "mp3" as const,
    volume: 100,
  };
}

function composeSegments(
  voiceId: string,
  lines: string[],
  model: string,
  speed?: number,
) {
  const last = lines.length - 1;
  const segments: Record<string, unknown>[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const prompt =
      i === 0
        ? { emotion_type: "preset", emotion_preset: "toneup", emotion_intensity: 1.1 }
        : i === last && last > 0
          ? { emotion_type: "preset", emotion_preset: "toneup", emotion_intensity: 1.08 }
          : {
              emotion_type: "smart",
              previous_text: lines[i - 1] || "",
              next_text: lines[i + 1] || "",
            };
    segments.push({
      type: "tts",
      voice_id: voiceId,
      text: lines[i],
      model,
      language: "kor",
      prompt,
      output: ttsOutput(speed),
    });
    if (i < last) {
      segments.push({
        type: "pause",
        duration_seconds: i === 0 ? 0.32 : 0.28,
      });
    }
  }
  return segments;
}

async function postTypecastAudio(
  apiKey: string,
  path: string,
  body: unknown,
): Promise<Buffer> {
  const res = await typecastRequest(path, apiKey, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    if (res.status === 403 && /UNUSUAL_ACTIVITY/i.test(err)) {
      throw new Error(
        "타입캐스트가 무료 계정 이상 사용으로 음성 생성을 막았습니다. 스튜디오 요금제와 별도로 API 플랜이 필요합니다. ElevenLabs로 만들거나, typecast.ai 에서 API 구독 후 다시 시도해 주세요.",
      );
    }
    if (res.status === 402) {
      throw new Error("타입캐스트 API 크레딧이 부족합니다. API 플랜을 확인해 주세요.");
    }
    throw new Error(`타입캐스트 TTS 오류: ${res.status} ${err.slice(0, 240)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

export async function synthesizeTypecast(input: {
  apiKey: string;
  voiceId: string;
  text: string;
  speed?: number;
  model?: string;
}): Promise<Buffer> {
  const text = input.text.trim();
  if (!text) throw new Error("대본이 없습니다.");
  if (text.length > 2000) {
    throw new Error("타입캐스트는 대본 2000자까지 한 번에 읽을 수 있습니다.");
  }
  const model = input.model || "ssfm-v30";
  const lines = splitSpokenLines(text);
  const simpleBody = {
    voice_id: input.voiceId,
    text,
    model,
    language: "kor",
    prompt: { emotion_type: "smart" },
    output: ttsOutput(input.speed),
  };
  if (lines.length >= 2) {
    try {
      return await postTypecastAudio(input.apiKey, "/v1/text-to-speech/compose", {
        segments: composeSegments(input.voiceId, lines, model, input.speed),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (
        message.includes("이상 사용") ||
        message.includes("크레딧") ||
        message.includes(" 429 ")
      ) {
        throw error;
      }
    }
  }
  return postTypecastAudio(input.apiKey, "/v1/text-to-speech", simpleBody);
}
