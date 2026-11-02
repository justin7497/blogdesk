import { getSettings } from "./db";
import {
  checkSocialTokens,
  getSocialHealth,
  tokenRecovered,
} from "./social-health";
import {
  dueSocialComments,
  listSocialComments,
  MAX_REPLY_RETRIES,
  requeueFailedComments,
  saveSocialComment,
  upsertSocialComment,
} from "./social-comments";
import { fetchRemoteComments, hasChannelToken, sendRemoteReply } from "./social-meta";
import {
  canAutoReply,
  classifyComment,
  composeReply,
  replyDelayMs,
} from "./social-reply";
import type { Settings, SocialChannel, SocialComment } from "./types";

function ownHandle(settings: Settings, channel: SocialChannel): string {
  const handle =
    channel === "threads" ? settings.threadsUsername : settings.instagramUsername;
  return (handle || "soyeontem").replace(/^@/, "").toLowerCase();
}

function isOwnComment(settings: Settings, comment: {
  channel: SocialChannel;
  author: string;
}): boolean {
  const author = comment.author.replace(/^@/, "").toLowerCase();
  if (!author) return false;
  return author === ownHandle(settings, comment.channel);
}

async function ingestComment(
  settings: Settings,
  input: {
    channel: SocialChannel;
    remotePostId: string;
    remoteCommentId: string;
    author: string;
    text: string;
    postHeadline: string;
    source: "meta" | "paste";
  },
): Promise<SocialComment | null> {
  if (isOwnComment(settings, input)) return null;
  const kind = classifyComment(input.text);
  const reply = await composeReply({
    settings,
    comment: {
      id: input.remoteCommentId,
      kind,
      text: input.text,
      postHeadline: input.postHeadline,
    },
  });
  const auto = settings.socialAutoReply !== false && canAutoReply(kind);
  const now = Date.now();
  return upsertSocialComment({
    channel: input.channel,
    remotePostId: input.remotePostId,
    remoteCommentId: input.remoteCommentId,
    author: input.author,
    text: input.text,
    kind,
    status: kind === "spam" ? "skipped" : auto ? "queued" : "review",
    reply,
    replyAfter: auto ? new Date(now + replyDelayMs(input.remoteCommentId)).toISOString() : "",
    postHeadline: input.postHeadline,
    remoteReplyId: "",
    error: "",
    retryCount: 0,
    source: input.source,
  });
}

export async function syncSocialComments(channel?: SocialChannel): Promise<{
  imported: number;
  skipped: number;
  errors: string[];
  missingToken: boolean;
}> {
  const settings = await getSettings();
  if (channel && !hasChannelToken(settings, channel)) {
    return {
      imported: 0,
      skipped: 0,
      errors: [
        channel === "threads"
          ? "설정에 스레드 액세스 토큰과 사용자 ID를 넣으면 댓글을 가져옵니다."
          : "설정에 인스타그램 액세스 토큰과 사용자 ID를 넣으면 댓글을 가져옵니다.",
      ],
      missingToken: true,
    };
  }
  const remote = await fetchRemoteComments(settings, channel);
  const existing = await listSocialComments(channel);
  const known = new Set(existing.map((item) => `${item.channel}:${item.remoteCommentId}`));
  let imported = 0;
  let skipped = 0;
  for (const item of remote.comments) {
    if (known.has(`${item.channel}:${item.remoteCommentId}`)) {
      skipped += 1;
      continue;
    }
    const saved = await ingestComment(settings, {
      ...item,
      source: "meta",
    });
    if (saved) imported += 1;
    else skipped += 1;
  }
  return {
    imported,
    skipped,
    errors: remote.errors,
    missingToken: false,
  };
}

export async function addPastedComment(input: {
  channel: SocialChannel;
  text: string;
  author?: string;
  postHeadline?: string;
}): Promise<SocialComment> {
  const text = input.text.trim();
  if (!text) throw new Error("댓글 내용을 붙여 넣으세요.");
  const settings = await getSettings();
  const remoteCommentId = `paste-${input.channel}-${Buffer.from(text).toString("base64url").slice(0, 24)}`;
  const saved = await ingestComment(settings, {
    channel: input.channel,
    remotePostId: "",
    remoteCommentId,
    author: (input.author || "").trim() || "익명",
    text,
    postHeadline: (input.postHeadline || "").trim(),
    source: "paste",
  });
  if (!saved) throw new Error("내 댓글에는 답하지 않습니다.");
  return saved;
}

export async function sendSocialComment(id: string): Promise<SocialComment> {
  const settings = await getSettings();
  const comments = await listSocialComments();
  const current = comments.find((item) => item.id === id);
  if (!current) throw new Error("댓글을 찾지 못했습니다.");
  if (current.status === "skipped" || current.status === "sent") return current;
  const reply = current.reply.trim();
  if (!reply) throw new Error("답신 문장이 없습니다.");
  if (!hasChannelToken(settings, current.channel) || current.source === "paste") {
    return saveSocialComment(id, {
      status: "ready",
      error: "Meta로 보내려면 토큰이 필요합니다. 지금은 복사해서 달면 됩니다.",
    });
  }
  const health = await getSocialHealth();
  if (health[current.channel].checkedAt && !health[current.channel].ok) {
    return current;
  }
  try {
    const remoteReplyId = await sendRemoteReply({
      settings,
      channel: current.channel,
      remoteCommentId: current.remoteCommentId,
      reply,
    });
    return saveSocialComment(id, {
      status: "sent",
      remoteReplyId,
      error: "",
      retryCount: 0,
    });
  } catch (error) {
    const tries = (current.retryCount ?? 0) + 1;
    const retryAfter = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    return saveSocialComment(id, {
      status: "failed",
      error: error instanceof Error ? error.message : "답신을 보내지 못했습니다.",
      retryCount: tries,
      replyAfter: tries < MAX_REPLY_RETRIES ? retryAfter : "",
    });
  }
}

export async function tickSocialReplies(): Promise<{
  sent: number;
  ready: number;
  failed: number;
}> {
  const due = await dueSocialComments();
  let sent = 0;
  let ready = 0;
  let failed = 0;
  for (const item of due) {
    const next = await sendSocialComment(item.id);
    if (next.status === "sent") sent += 1;
    else if (next.status === "ready") ready += 1;
    else if (next.status === "failed") failed += 1;
  }
  return { sent, ready, failed };
}

export async function refreshSocialAuth(): Promise<{
  recovered: SocialChannel[];
  requeued: number;
}> {
  const { prev, next } = await checkSocialTokens();
  const recovered: SocialChannel[] = [];
  let requeued = 0;
  for (const channel of ["instagram", "threads"] as SocialChannel[]) {
    if (!tokenRecovered(prev, next, channel)) continue;
    recovered.push(channel);
    requeued += await requeueFailedComments(channel);
  }
  return { recovered, requeued };
}

export async function syncAndTickComments(channel?: SocialChannel): Promise<{
  imported: number;
  skipped: number;
  sent: number;
  ready: number;
  failed: number;
  errors: string[];
  missingToken: boolean;
  requeued: number;
}> {
  const auth = await refreshSocialAuth();
  const sync = await syncSocialComments(channel);
  const tick = await tickSocialReplies();
  return { ...sync, ...tick, requeued: auth.requeued };
}
