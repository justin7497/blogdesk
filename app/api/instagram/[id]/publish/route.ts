import { asErrorMessage, jsonError } from "@/lib/api-error";
import { publishInstagramNow } from "@/lib/social-publish";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const post = await publishInstagramNow(id);
    return Response.json({ post });
  } catch (error) {
    return jsonError(asErrorMessage(error), 500);
  }
}
