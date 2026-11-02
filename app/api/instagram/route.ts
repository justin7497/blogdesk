import { asErrorMessage, jsonError } from "@/lib/api-error";
import {
  createInstagramPost,
  listInstagramPosts,
  purgeExpiredUnapprovedPosts,
} from "@/lib/instagram";
import type { SocialChannel } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const channel = new URL(request.url).searchParams.get("channel");
    await purgeExpiredUnapprovedPosts();
    const posts = await listInstagramPosts(
      channel === "instagram" || channel === "threads"
        ? (channel as SocialChannel)
        : undefined,
    );
    return Response.json({ posts });
  } catch (error) {
    return jsonError(asErrorMessage(error), 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      channel?: string;
      topic?: string;
      brief?: string;
      slotKey?: string;
      scheduledFor?: string;
    };
    const channel: SocialChannel =
      body.channel === "threads" ? "threads" : "instagram";
    const post = await createInstagramPost({
      channel,
      topic: (body.topic ?? "").trim(),
      brief: body.brief,
      slotKey: body.slotKey,
      scheduledFor: body.scheduledFor,
    });
    return Response.json({ post });
  } catch (error) {
    return jsonError(asErrorMessage(error), 500);
  }
}
