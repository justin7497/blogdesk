import { asErrorMessage, jsonError } from "@/lib/api-error";
import { deleteShortsJob, getShortsJob, updateShortsJob } from "@/lib/shorts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const job = await getShortsJob(id);
    if (!job) return jsonError("작업을 찾지 못했습니다.", 404);
    return Response.json({ job });
  } catch (error) {
    return jsonError(asErrorMessage(error), 400);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as { script?: string; title?: string };
    const job = await getShortsJob(id);
    if (!job) return jsonError("작업을 찾지 못했습니다.", 404);
    const patch: Partial<typeof job> = {};
    if (typeof body.title === "string") {
      const title = body.title.trim();
      if (!title) return jsonError("이름을 입력해 주세요.");
      patch.title = title;
    }
    if (typeof body.script === "string") {
      const script = body.script.trim();
      patch.script = script;
      if (script) patch.status = "scripted";
    }
    const saved = await updateShortsJob(id, patch);
    return Response.json({ job: saved });
  } catch (error) {
    return jsonError(asErrorMessage(error), 400);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const job = await getShortsJob(id);
    if (!job) return jsonError("작업을 찾지 못했습니다.", 404);
    await deleteShortsJob(id);
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(asErrorMessage(error), 400);
  }
}
