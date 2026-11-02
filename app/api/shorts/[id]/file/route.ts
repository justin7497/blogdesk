import { createReadStream, existsSync, statSync } from "node:fs";
import { Readable } from "node:stream";
import { jsonError } from "@/lib/api-error";
import { ensureJobFiles, findSource, getShortsJob, jobFile } from "@/lib/shorts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const job = await getShortsJob(id);
  if (!job) return jsonError("작업을 찾지 못했습니다.", 404);
  await ensureJobFiles(id);
  const kind = new URL(request.url).searchParams.get("kind") || "output";
  let filePath = "";
  let type = "application/octet-stream";
  let download = "";
  try {
    if (kind === "source") {
      filePath = findSource(id);
      type = job.mimeType || "video/mp4";
      download = job.filename || "source.mp4";
    } else if (kind === "voice") {
      filePath = jobFile(id, "voice");
      type = "audio/mpeg";
      download = "voice.mp3";
    } else {
      filePath = jobFile(id, "output");
      type = "video/mp4";
      download = `${job.title || "shorts"}.mp4`;
    }
  } catch {
    return jsonError("파일을 찾지 못했습니다.", 404);
  }
  if (!existsSync(filePath)) return jsonError("파일을 찾지 못했습니다.", 404);
  const stream = createReadStream(filePath);
  const webStream = Readable.toWeb(stream) as unknown as ReadableStream;
  return new Response(webStream, {
    headers: {
      "Content-Type": type,
      "Content-Length": String(statSync(filePath).size),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(download)}`,
      "Cache-Control": "no-store",
    },
  });
}
