import { asErrorMessage, jsonError } from "@/lib/api-error";
import { getPushPublicKey } from "@/lib/social-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const publicKey = await getPushPublicKey();
    return Response.json({ publicKey });
  } catch (error) {
    return jsonError(asErrorMessage(error), 500);
  }
}
