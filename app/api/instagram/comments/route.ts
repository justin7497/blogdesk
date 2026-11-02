import { asErrorMessage, jsonError } from "@/lib/api-error";
import { addPastedComment, syncAndTickComments } from "@/lib/social-inbox";
import { listSocialComments } from "@/lib/social-comments";
import { notifyApprovalReminders } from "@/lib/social-push";
import { publishDueSocialPosts } from "@/lib/social-publish";
import type { SocialChannel } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function asChannel(value: string | undefined): SocialChannel | undefined {
  if (value === "instagram" || value === "threads") return value;
  return undefined;
}

export async function GET(request: Request) {
  try {
    const channel = asChannel(new URL(request.url).searchParams.get("channel") ?? "");
    const comments = await listSocialComments(channel);
    return Response.json({ comments });
  } catch (error) {
    return jsonError(asErrorMessage(error), 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      channel?: string;
      text?: string;
      author?: string;
      postHeadline?: string;
    };
    const channel = asChannel(body.channel);
    if (body.action === "add") {
      if (!channel) return jsonError("채널이 필요합니다.");
      const comment = await addPastedComment({
        channel,
        text: body.text ?? "",
        author: body.author,
        postHeadline: body.postHeadline,
      });
      return Response.json({ comment });
    }
    const result = await syncAndTickComments(channel);
    const posted = await publishDueSocialPosts();
    const reminded = await notifyApprovalReminders().catch(() => 0);
    return Response.json({ ...result, posted, reminded });
  } catch (error) {
    return jsonError(asErrorMessage(error), 500);
  }
}
