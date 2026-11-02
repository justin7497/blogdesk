import { asErrorMessage, jsonError } from "@/lib/api-error";
import { getSettings } from "@/lib/db";
import { analyzeShortsVideo } from "@/lib/shorts-analyze";
import {
  ensureJobFiles,
  findSource,
  getShortsJob,
  updateShortsJob,
} from "@/lib/shorts";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const job = await getShortsJob(id);
    if (!job) return jsonError("작업을 찾지 못했습니다.", 404);
    const body = (await request.json().catch(() => ({}))) as { remix?: boolean };
    const settings = await getSettings();
    await ensureJobFiles(id);
    const source = findSource(id);
    const script = await analyzeShortsVideo({
      settings,
      videoPath: source,
      durationSec: job.durationSec,
      jobId: id,
      remix: Boolean(body.remix || job.script),
    });
    const saved = await updateShortsJob(id, {
      status: "scripted",
      title: script.title,
      hook: script.hook,
      hookType: script.hookType,
      script: script.script,
      scriptAlt: script.scriptAlt,
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
