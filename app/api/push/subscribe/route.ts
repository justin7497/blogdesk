import { asErrorMessage, jsonError } from "@/lib/api-error";
import {
  notifyPendingApprovals,
  removePushSubscription,
  savePushSubscription,
  sendDeskPush,
} from "@/lib/social-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
    if (body.action === "unsubscribe") {
      await removePushSubscription(body.endpoint ?? "");
      return Response.json({ ok: true });
    }
    const saved = await savePushSubscription({
      endpoint: body.endpoint ?? "",
      keys: {
        p256dh: body.keys?.p256dh ?? "",
        auth: body.keys?.auth ?? "",
      },
    });
    await sendDeskPush({
      title: "승인 알림이 켜졌습니다",
      body: "글이 만들어지면 폰으로 알려 드립니다. 올리기 30분 전에도 한 번 더 울립니다.",
      url: "/instagram",
      tag: "approval-on",
    });
    await notifyPendingApprovals();
    return Response.json(saved);
  } catch (error) {
    return jsonError(asErrorMessage(error), 500);
  }
}
