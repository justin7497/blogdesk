import { asErrorMessage, jsonError } from "@/lib/api-error";
import { fetchYoutubeTranscript } from "@/lib/youtube-transcript";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { url?: string };
    const transcript = await fetchYoutubeTranscript(body.url || "");
    return Response.json(transcript);
  } catch (error) {
    return jsonError(asErrorMessage(error), 400);
  }
}
