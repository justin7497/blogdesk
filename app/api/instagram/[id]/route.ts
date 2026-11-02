import { asErrorMessage, jsonError } from "@/lib/api-error";
import {
  deleteInstagramPost,
  getInstagramPost,
  saveInstagramPost,
} from "@/lib/instagram";
import type { InstagramSlide } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const post = await getInstagramPost(id);
    if (!post) return jsonError("게시물을 찾지 못했습니다.", 404);
    return Response.json({ post });
  } catch (error) {
    return jsonError(asErrorMessage(error), 500);
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = (await request.json().catch(() => ({}))) as {
      topic?: string;
      brief?: string;
      headline?: string;
      slides?: InstagramSlide[];
      caption?: string;
      hashtags?: string[];
      scheduledFor?: string;
    };
    const post = await saveInstagramPost(id, {
      topic: body.topic,
      brief: body.brief,
      headline: body.headline,
      slides: body.slides,
      caption: body.caption,
      hashtags: body.hashtags,
      scheduledFor: body.scheduledFor,
    });
    return Response.json({ post });
  } catch (error) {
    return jsonError(asErrorMessage(error), 500);
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    await deleteInstagramPost(id);
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(asErrorMessage(error), 500);
  }
}
