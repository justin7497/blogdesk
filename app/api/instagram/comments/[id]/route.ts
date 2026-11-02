import { asErrorMessage, jsonError } from "@/lib/api-error";
import { saveSocialComment } from "@/lib/social-comments";
import { sendSocialComment } from "@/lib/social-inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      reply?: string;
    };
    if (body.action === "skip") {
      const comment = await saveSocialComment(id, { status: "skipped", error: "" });
      return Response.json({ comment });
    }
    if (body.action === "save") {
      const comment = await saveSocialComment(id, {
        reply: (body.reply ?? "").trim(),
      });
      return Response.json({ comment });
    }
    if (body.action === "send") {
      if (body.reply?.trim()) {
        await saveSocialComment(id, { reply: body.reply.trim() });
      }
      const comment = await sendSocialComment(id);
      return Response.json({ comment });
    }
    return jsonError("알 수 없는 동작입니다.");
  } catch (error) {
    return jsonError(asErrorMessage(error), 500);
  }
}
