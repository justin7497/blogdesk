import { asErrorMessage, jsonError } from "@/lib/api-error";
import { produceSocialQueue } from "@/lib/instagram-produce";
import { syncAndTickComments } from "@/lib/social-inbox";
import { notifyApprovalReminders } from "@/lib/social-push";
import { publishDueSocialPosts } from "@/lib/social-publish";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function jobName(request: Request): string {
  const url = new URL(request.url);
  const fromQuery = (url.searchParams.get("job") ?? "").trim();
  if (fromQuery) return fromQuery;
  return "comments";
}

async function run(job: string) {
  if (job === "produce") {
    const result = await produceSocialQueue();
    return { job, ...result };
  }
  if (job === "publish") {
    const result = await publishDueSocialPosts();
    return { job, ...result };
  }
  const comments = await syncAndTickComments();
  const posted = await publishDueSocialPosts();
  const reminded = await notifyApprovalReminders().catch(() => 0);
  return { job: "comments", ...comments, posted, reminded };
}

export async function GET(request: Request) {
  try {
    return Response.json(await run(jobName(request)));
  } catch (error) {
    return jsonError(asErrorMessage(error), 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { job?: string };
    const job = (body.job || jobName(request)).trim() || "comments";
    return Response.json(await run(job));
  } catch (error) {
    return jsonError(asErrorMessage(error), 500);
  }
}
