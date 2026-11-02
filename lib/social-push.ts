import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import webpush from "web-push";
import { cloudProjectId, store } from "./db";
import { listInstagramPosts, markInstagramNotify } from "./instagram";
import { isApprovalReminderWindow } from "./instagram-schedule";
import type { InstagramPost, SocialChannel } from "./types";

const PUSH_PATH = "desk/push";
const MAX_SUBS = 8;
const VAPID_MAILTO = "mailto:desk@blogdesk-ljh.web.app";

export type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

type PushSubscriptionRecord = PushSubscriptionInput & { createdAt: string };

type PushStore = {
  vapidPublicKey: string;
  vapidPrivateKey: string;
  subscriptions: PushSubscriptionRecord[];
};

function localFile(): string {
  return path.join(process.cwd(), "data", "push.json");
}

function asSub(raw: unknown): PushSubscriptionRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Partial<PushSubscriptionRecord>;
  const endpoint = typeof row.endpoint === "string" ? row.endpoint.trim() : "";
  const p256dh =
    row.keys && typeof row.keys.p256dh === "string" ? row.keys.p256dh.trim() : "";
  const auth =
    row.keys && typeof row.keys.auth === "string" ? row.keys.auth.trim() : "";
  if (!endpoint.startsWith("https://") || !p256dh || !auth) return null;
  return {
    endpoint,
    keys: { p256dh, auth },
    createdAt:
      typeof row.createdAt === "string" && row.createdAt
        ? row.createdAt
        : new Date().toISOString(),
  };
}

function asStore(raw: unknown): PushStore {
  const row = raw && typeof raw === "object" ? (raw as Partial<PushStore>) : {};
  return {
    vapidPublicKey:
      typeof row.vapidPublicKey === "string" ? row.vapidPublicKey : "",
    vapidPrivateKey:
      typeof row.vapidPrivateKey === "string" ? row.vapidPrivateKey : "",
    subscriptions: Array.isArray(row.subscriptions)
      ? row.subscriptions
          .map(asSub)
          .filter((item): item is PushSubscriptionRecord => Boolean(item))
          .slice(0, MAX_SUBS)
      : [],
  };
}

async function readStore(): Promise<PushStore> {
  if (cloudProjectId()) {
    const snap = await store().doc(PUSH_PATH).get();
    return asStore(snap.data());
  }
  try {
    return asStore(JSON.parse(await readFile(localFile(), "utf8")) as unknown);
  } catch {
    return asStore(undefined);
  }
}

async function writeStore(next: PushStore): Promise<void> {
  const payload = JSON.parse(JSON.stringify(next)) as PushStore;
  if (cloudProjectId()) {
    await store().doc(PUSH_PATH).set(payload);
    return;
  }
  await mkdir(path.dirname(localFile()), { recursive: true });
  await writeFile(localFile(), JSON.stringify(payload, null, 2), "utf8");
}

async function withKeys(): Promise<PushStore> {
  const current = await readStore();
  if (current.vapidPublicKey && current.vapidPrivateKey) return current;
  const keys = webpush.generateVAPIDKeys();
  const next: PushStore = {
    ...current,
    vapidPublicKey: keys.publicKey,
    vapidPrivateKey: keys.privateKey,
  };
  await writeStore(next);
  return next;
}

function channelLabel(channel: SocialChannel): string {
  return channel === "threads" ? "스레드" : "인스타그램";
}

function channelPath(channel: SocialChannel): string {
  return channel === "threads" ? "/threads" : "/instagram";
}

function postLine(post: InstagramPost): string {
  const when = post.scheduledFor.replace("T", " ").slice(0, 16);
  return `${channelLabel(post.channel)} ${when} · ${post.headline || post.topic}`;
}

function applyVapid(state: PushStore): void {
  webpush.setVapidDetails(
    VAPID_MAILTO,
    state.vapidPublicKey,
    state.vapidPrivateKey,
  );
}

async function dropEndpoint(endpoint: string): Promise<void> {
  const state = await readStore();
  const next = state.subscriptions.filter((item) => item.endpoint !== endpoint);
  if (next.length !== state.subscriptions.length) {
    await writeStore({ ...state, subscriptions: next });
  }
}

export async function getPushPublicKey(): Promise<string> {
  return (await withKeys()).vapidPublicKey;
}

export async function savePushSubscription(
  input: PushSubscriptionInput,
): Promise<{ ok: true; count: number }> {
  const parsed = asSub(input);
  if (!parsed) throw new Error("알림 구독 정보가 올바르지 않습니다.");
  const state = await withKeys();
  const rest = state.subscriptions.filter(
    (item) => item.endpoint !== parsed.endpoint,
  );
  await writeStore({
    ...state,
    subscriptions: [parsed, ...rest].slice(0, MAX_SUBS),
  });
  return { ok: true, count: Math.min(rest.length + 1, MAX_SUBS) };
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  await dropEndpoint(endpoint.trim());
}

export async function sendDeskPush(input: {
  title: string;
  body: string;
  url: string;
  tag?: string;
}): Promise<number> {
  const state = await withKeys();
  if (!state.subscriptions.length) return 0;
  applyVapid(state);
  const payload = JSON.stringify({
    title: input.title,
    body: input.body,
    url: input.url,
    tag: input.tag || "desk",
  });
  let sent = 0;
  for (const sub of state.subscriptions) {
    try {
      await webpush.sendNotification(sub, payload, { TTL: 60 * 60 });
      sent += 1;
    } catch (error) {
      const status =
        error && typeof error === "object" && "statusCode" in error
          ? Number((error as { statusCode?: number }).statusCode)
          : 0;
      if (status === 404 || status === 410) await dropEndpoint(sub.endpoint);
    }
  }
  return sent;
}

export async function notifyApprovalReady(
  posts: InstagramPost[],
): Promise<number> {
  const pending = posts.filter(
    (item) =>
      (item.status === "draft" || item.status === "approved") &&
      !item.notifyReadyAt,
  );
  if (!pending.length) return 0;
  const title =
    pending.length === 1
      ? "승인할 글이 준비됐어요"
      : `승인할 글 ${pending.length}편이 준비됐어요`;
  const sent = await sendDeskPush({
    title,
    body: pending.slice(0, 3).map(postLine).join("\n"),
    url: channelPath(pending[0]!.channel),
    tag: "approval-ready",
  });
  if (!sent) return 0;
  const at = new Date().toISOString();
  await Promise.all(
    pending.map((item) => markInstagramNotify(item.id, { notifyReadyAt: at })),
  );
  return sent;
}

export async function notifyPendingApprovals(): Promise<number> {
  const posts = (await listInstagramPosts()).filter(
    (item) => item.status === "draft" || item.status === "approved",
  );
  if (!posts.length) return 0;
  return sendDeskPush({
    title:
      posts.length === 1
        ? "지금 승인 대기 글이 있습니다"
        : `지금 승인 대기 ${posts.length}편`,
    body: posts.slice(0, 3).map(postLine).join("\n"),
    url: channelPath(posts[0]!.channel),
    tag: "approval-pending",
  });
}

export async function notifyApprovalReminders(
  now = new Date(),
): Promise<number> {
  const posts = await listInstagramPosts();
  let sent = 0;
  for (const post of posts) {
    if (
      post.status === "posted" ||
      post.status === "hold" ||
      post.status === "changes"
    ) {
      continue;
    }
    if (post.notifyRemindAt) continue;
    if (!isApprovalReminderWindow(post.scheduledFor, now)) continue;
    const n = await sendDeskPush({
      title: "곧 올라갑니다. 지금 확인해 주세요",
      body: postLine(post),
      url: channelPath(post.channel),
      tag: `approval-remind-${post.id}`,
    });
    if (!n) continue;
    await markInstagramNotify(post.id, {
      notifyRemindAt: new Date().toISOString(),
    });
    sent += n;
  }
  return sent;
}

export async function notifyPublishFailed(
  post: InstagramPost,
  error: string,
): Promise<void> {
  if ((post.publishAttempts ?? 0) !== 1) return;
  await sendDeskPush({
    title: `${channelLabel(post.channel)} 게시에 실패했습니다`,
    body: (error || postLine(post)).slice(0, 140),
    url: channelPath(post.channel),
    tag: `publish-fail-${post.id}`,
  });
}
