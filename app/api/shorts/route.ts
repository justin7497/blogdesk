import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { asErrorMessage, jsonError } from "@/lib/api-error";
import { probeDuration } from "@/lib/ffmpeg";
import {
  createShortsJob,
  deleteShortsJob,
  jobDir,
  listShortsJobs,
  saveJobFiles,
  updateShortsJob,
} from "@/lib/shorts";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const MAX_BYTES = 80 * 1024 * 1024;
const EXT: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/x-m4v": "m4v",
};

function extFromFile(file: File): string {
  const byMime = EXT[file.type];
  if (byMime) return byMime;
  const name = file.name.toLowerCase();
  if (name.endsWith(".mp4")) return "mp4";
  if (name.endsWith(".webm")) return "webm";
  if (name.endsWith(".mov")) return "mov";
  if (name.endsWith(".m4v")) return "m4v";
  return "";
}

export async function GET() {
  return Response.json({ jobs: await listShortsJobs() });
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size < 1) {
      return jsonError("영상 파일을 올려 주세요.");
    }
    if (file.size > MAX_BYTES) {
      return jsonError("영상은 80MB 이하만 올릴 수 있습니다.");
    }
    const ext = extFromFile(file);
    if (!ext) {
      return jsonError("mp4, webm, mov 파일만 올릴 수 있습니다.");
    }

    const job = await createShortsJob({
      filename: file.name,
      mimeType: file.type || `video/${ext}`,
      durationSec: 0,
    });
    const dest = path.join(jobDir(job.id), `source.${ext}`);
    await writeFile(dest, Buffer.from(await file.arrayBuffer()));
    const durationSec = await probeDuration(dest);
    if (durationSec > 90) {
      await rm(jobDir(job.id), { recursive: true, force: true });
      await deleteShortsJob(job.id);
      return jsonError("90초 이하 영상만 사용할 수 있습니다.");
    }
    const saved = await updateShortsJob(job.id, { durationSec });
    await saveJobFiles(job.id);
    return Response.json({ job: saved });
  } catch (error) {
    return jsonError(asErrorMessage(error), 500);
  }
}
