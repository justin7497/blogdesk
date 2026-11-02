import { existsSync } from "node:fs";
import { asErrorMessage, jsonError } from "@/lib/api-error";
import { muxVoiceover, probeDuration } from "@/lib/ffmpeg";
import { writeCaptionsAss } from "@/lib/shorts-captions";
import {
  ensureJobFiles,
  findSource,
  getShortsJob,
  jobFile,
  saveJobFiles,
  updateShortsJob,
} from "@/lib/shorts";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const job = await getShortsJob(id);
    if (!job) return jsonError("작업을 찾지 못했습니다.", 404);
    const voice = jobFile(id, "voice");
    if (!existsSync(voice)) {
      return jsonError("음성이 없습니다. 먼저 음성을 만들어 주세요.");
    }
    await ensureJobFiles(id);
    const output = jobFile(id, "output");
    const captions = jobFile(id, "captions");
    const script = job.script.trim();
    let captionsPath: string | undefined;
    if (script) {
      const audioSec = await probeDuration(voice);
      await writeCaptionsAss(script, audioSec, captions);
      captionsPath = captions;
    }
    await muxVoiceover(findSource(id), voice, output, captionsPath);
    await saveJobFiles(id, ["output.mp4"]);
    const saved = await updateShortsJob(id, {
      status: "done",
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
