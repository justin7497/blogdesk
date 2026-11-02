const ANNA_KIM_VOICE = "uyVNoMrnUku1dZyVEXwD"; // Anna Kim — Tender, Calm and Clear
export const SPEECH_SPEED = 1.1;
export const SPEECH_SPEEDS = [0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.5] as const;

export function clampSpeechSpeed(
  value: unknown,
  min = 0.5,
  max = 2,
): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return SPEECH_SPEED;
  return Math.min(max, Math.max(min, Math.round(n * 10) / 10));
}
const LIAM_VOICE = "TX3LPaxmHKxFdv7VOQHJ";
const SARAH_VOICE = "EXAVITQu4vr4xnSDxMaL";
const LEGACY_DEFAULTS = new Set([LIAM_VOICE, SARAH_VOICE]);
const DEFAULT_VOICE = ANNA_KIM_VOICE;

export type ElevenVoice = {
  voice_id: string;
  name: string;
  labels?: Record<string, string>;
};

type NamedVoice = { id?: string; voice_id?: string; name: string };

function voiceIdOf(voice: NamedVoice): string {
  return voice.id || voice.voice_id || "";
}

function isAnnaKim(name: string): boolean {
  return /anna\s*kim/i.test(name);
}

function isViv(name: string): boolean {
  return /^viv\b/i.test(name.trim());
}

export function isLegacyDefaultVoice(id?: string): boolean {
  return !id?.trim() || LEGACY_DEFAULTS.has(id.trim());
}

export function resolveVoiceId(id?: string): string {
  return isLegacyDefaultVoice(id) ? DEFAULT_VOICE : id!.trim();
}

export function voiceRank(name: string): number {
  if (isAnnaKim(name)) return 0;
  if (isViv(name)) return 1;
  return 2;
}

export function voiceOptionLabel(name: string): string {
  if (isAnnaKim(name)) return `${name} (쇼핑 기본)`;
  if (isViv(name)) return `${name} (테크)`;
  return name;
}

export function pickDefaultVoiceId(voices: NamedVoice[]): string {
  const anna = voices.find((voice) => isAnnaKim(voice.name));
  const viv = voices.find((voice) => isViv(voice.name));
  return (anna && voiceIdOf(anna)) || (viv && voiceIdOf(viv)) || DEFAULT_VOICE;
}

export async function listElevenVoices(
  apiKey: string,
): Promise<ElevenVoice[]> {
  const res = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": apiKey },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`ElevenLabs 보이스 목록 오류: ${res.status}`);
  }
  const data = (await res.json()) as { voices?: ElevenVoice[] };
  const voices = data.voices ?? [];
  return [...voices].sort((a, b) => {
    const rank = voiceRank(a.name) - voiceRank(b.name);
    if (rank !== 0) return rank;
    return a.name.localeCompare(b.name, "ko");
  });
}

function spokenElevenText(text: string): string {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ... ");
}

export async function synthesizeSpeech(input: {
  apiKey: string;
  voiceId?: string;
  text: string;
  speed?: number;
}): Promise<Buffer> {
  const voiceId = resolveVoiceId(input.voiceId);
  const speed = clampSpeechSpeed(input.speed, 0.25, 4);
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": input.apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: spokenElevenText(input.text),
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.38,
          similarity_boost: 0.8,
          style: 0.38,
          use_speaker_boost: true,
          speed,
        },
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`ElevenLabs TTS 오류: ${res.status} ${await res.text()}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

export { DEFAULT_VOICE, ANNA_KIM_VOICE };
