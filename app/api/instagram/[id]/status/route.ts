import { asErrorMessage, jsonError } from "@/lib/api-error";
import { setInstagramStatus } from "@/lib/instagram";
import type { InstagramPostStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function isStatus(value: string): value is InstagramPostStatus {
  return (
    value === "draft" ||
    value === "changes" ||
    value === "hold" ||
    value === "approved"
  );
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = (await request.json().catch(() => ({}))) as {
      status?: string;
      note?: string;
    };
    const status = body.status || "";
    if (!isStatus(status)) return jsonError("상태를 확인해 주세요.");
    const post = await setInstagramStatus(id, status, body.note);
    return Response.json({ post });
  } catch (error) {
    return jsonError(asErrorMessage(error), 500);
  }
}
