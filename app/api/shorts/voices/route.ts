import { asErrorMessage, jsonError } from "@/lib/api-error";
import { getSettings } from "@/lib/db";
import {
  DEFAULT_VOICE,
  listElevenVoices,
  pickDefaultVoiceId,
} from "@/lib/elevenlabs";
import { listTypecastVoices, pickTypecastVoiceId } from "@/lib/typecast";
import type { TtsProvider } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const settings = await getSettings();
    const requested = new URL(request.url).searchParams.get("provider");
    const provider: TtsProvider =
      requested === "typecast" || requested === "elevenlabs"
        ? requested
        : settings.ttsProvider === "typecast" && settings.typecastApiKey
          ? "typecast"
          : settings.elevenLabsApiKey
            ? "elevenlabs"
            : "typecast";

    if (provider === "typecast") {
      if (!settings.typecastApiKey) {
        return jsonError("설정에 타입캐스트 API 키를 넣어 주세요.", 400);
      }
      const voices = await listTypecastVoices(settings.typecastApiKey);
      const mapped = voices.map((voice) => ({
        id: voice.voice_id,
        name: voice.name,
        model: voice.model,
      }));
      return Response.json({
        provider,
        defaultVoice:
          settings.typecastVoiceId || pickTypecastVoiceId(mapped),
        voices: mapped,
        available: {
          elevenlabs: Boolean(settings.elevenLabsApiKey),
          typecast: true,
        },
      });
    }

    if (!settings.elevenLabsApiKey) {
      return jsonError("설정에 ElevenLabs API 키를 넣어 주세요.", 400);
    }
    const voices = await listElevenVoices(settings.elevenLabsApiKey);
    const mapped = voices.map((voice) => ({
      id: voice.voice_id,
      name: voice.name,
      labels: voice.labels ?? {},
    }));
    return Response.json({
      provider,
      defaultVoice: pickDefaultVoiceId(mapped) || DEFAULT_VOICE,
      voices: mapped,
      available: {
        elevenlabs: true,
        typecast: Boolean(settings.typecastApiKey),
      },
    });
  } catch (error) {
    return jsonError(asErrorMessage(error), 500);
  }
}
