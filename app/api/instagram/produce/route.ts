import { asErrorMessage, jsonError } from "@/lib/api-error";
import { produceSocialQueue } from "@/lib/instagram-produce";
import { upcomingSocialSlots } from "@/lib/instagram-schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  try {
    return Response.json({
      slots: upcomingSocialSlots(),
    });
  } catch (error) {
    return jsonError(asErrorMessage(error), 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { days?: number };
    const days = Number(body.days);
    const result = await produceSocialQueue(
      Number.isFinite(days) && days > 0 ? Math.min(days, 3) : undefined,
    );
    return Response.json(result);
  } catch (error) {
    return jsonError(asErrorMessage(error), 500);
  }
}
