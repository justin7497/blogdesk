import { writeFile } from "node:fs/promises";
import { asErrorMessage, jsonError } from "@/lib/api-error";
import { getSettings, updateDb } from "@/lib/db";
import {
  clampSpeechSpeed,
  resolveVoiceId,
  SPEECH_SPEED,
  synthesizeSpeech,
} from "@/lib/elevenlabs";
import { getShortsJob, jobFile, saveJobFiles, updateShortsJob } from "@/lib/shorts";
import { isTypecastVoiceId, synthesizeTypecast } from "@/lib/typecast";
import type { TtsProvider } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const job = await getShortsJob(id);
    if (!job) return jsonError("작업을 찾지 못했습니다.", 404);
    const body = (await request.json().catch(() => ({}))) as {
      script?: string;
      voiceId?: string;
      provider?: TtsProvider;
      speed?: number;
      model?: string;
    };
    const script = (body.script ?? job.script).trim();
    if (!script) return jsonError("대본이 없습니다. 먼저 대본을 만들어 주세요.");
    const settings = await getSettings();
    const requestedId = body.voiceId || job.voiceId || "";
    const provider: TtsProvider =
      body.provider === "typecast" || body.provider === "elevenlabs"
        ? body.provider
        : isTypecastVoiceId(requestedId)
          ? "typecast"
          : settings.ttsProvider;

    let voiceId = requestedId;
    let audio: Buffer;
    let speed = SPEECH_SPEED;
    if (provider === "typecast") {
      if (!settings.typecastApiKey) {
        return jsonError("설정에 타입캐스트 API 키를 넣어 주세요.");
      }
      voiceId = voiceId || settings.typecastVoiceId;
      if (!voiceId) {
        return jsonError("타입캐스트 보이스를 골라 주세요.");
      }
      speed = clampSpeechSpeed(body.speed ?? settings.typecastSpeed, 0.5, 2);
      audio = await synthesizeTypecast({
        apiKey: settings.typecastApiKey,
        voiceId,
        text: script,
        speed,
        model: body.model,
      });
    } else {
      if (!settings.elevenLabsApiKey) {
        return jsonError("설정에 ElevenLabs API 키를 넣어 주세요.");
      }
      voiceId = resolveVoiceId(voiceId || settings.elevenLabsVoiceId);
      speed = clampSpeechSpeed(body.speed ?? settings.elevenLabsSpeed, 0.25, 4);
      audio = await synthesizeSpeech({
        apiKey: settings.elevenLabsApiKey,
        voiceId,
        text: script,
        speed,
      });
    }

    await writeFile(jobFile(id, "voice"), audio);
    await saveJobFiles(id, ["voice.mp3"]);
    await updateDb((db) => {
      db.settings.ttsProvider = provider;
      if (provider === "typecast") {
        db.settings.typecastVoiceId = voiceId;
        db.settings.typecastSpeed = speed;
      } else {
        db.settings.elevenLabsVoiceId = voiceId;
        db.settings.elevenLabsSpeed = speed;
      }
    });
    const saved = await updateShortsJob(id, {
      status: "voiced",
      script,
      voiceId,
      error: undefined,
    });
    return Response.json({ job: saved });
  } catch (error) {
    const { id } = await params;
    await updateShortsJob(id, {
      status: "error",
      error: asErrorMessage(error),
    }).catch(() => undefined);
    return jsonError(asErrorMessage(error), 500);
  }
}
