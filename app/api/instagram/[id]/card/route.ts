import { asErrorMessage, jsonError } from "@/lib/api-error";
import { persistInstagramCard } from "@/lib/instagram-assets";
import { normalizeSlide } from "@/lib/instagram-card";
import { renderInstagramCardPng } from "@/lib/instagram-card-render";
import { getSettings } from "@/lib/db";
import { getInstagramPost } from "@/lib/instagram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const post = await getInstagramPost(id);
    if (!post) return jsonError("게시물을 찾지 못했습니다.", 404);
    const slide = post.slides[0] ? normalizeSlide(post.slides[0]) : null;
    if (!slide) return jsonError("카드가 없습니다.", 404);
    const settings = await getSettings();
    const handle = (settings.instagramUsername || "soyeontem").replace(/^@/, "");
    const png = await renderInstagramCardPng(slide, `@${handle}`);
    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (error) {
    return jsonError(asErrorMessage(error), 500);
  }
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const post = await getInstagramPost(id);
    if (!post) return jsonError("게시물을 찾지 못했습니다.", 404);
    const body = (await request.json().catch(() => ({}))) as {
      slide?: number;
      dataUrl?: string;
    };
    const slide = Number(body.slide);
    if (!Number.isInteger(slide) || slide < 0 || slide > 5) {
      return jsonError("카드 번호가 올바르지 않습니다.");
    }
    const dataUrl = (body.dataUrl ?? "").trim();
    const match = dataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/]+=*)$/);
    if (!match?.[1]) return jsonError("PNG 데이터가 없습니다.");
    const png = Buffer.from(match[1], "base64");
    if (png.length > 6_000_000) return jsonError("카드 파일이 너무 큽니다.");
    await persistInstagramCard(id, slide, png);
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(asErrorMessage(error), 500);
  }
}
