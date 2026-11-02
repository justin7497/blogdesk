import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { cloudProjectId, newId, store } from "./db";
import type {
  SocialChannel,
  SocialComment,
  SocialCommentKind,
  SocialCommentStatus,
} from "./types";

const INDEX_PATH = "desk/comments";
const MAX_COMMENTS = 80;

let chain: Promise<unknown> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

function localFile(): string {
  return path.join(process.cwd(), "data", "instagram", "comments.json");
}

const KINDS: SocialCommentKind[] = [
  "empathy",
  "vote",
  "product",
  "spam",
  "other",
];
const STATUSES: SocialCommentStatus[] = [
  "review",
  "queued",
  "ready",
  "sent",
  "skipped",
  "failed",
];

function asComments(raw: unknown): SocialComment[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Partial<SocialComment>;
      const id = typeof row.id === "string" ? row.id : "";
      const text = typeof row.text === "string" ? row.text : "";
      if (!id || !text.trim()) return null;
      return {
        id,
        channel: row.channel === "threads" ? "threads" : "instagram",
        remotePostId: typeof row.remotePostId === "string" ? row.remotePostId : "",
        remoteCommentId:
          typeof row.remoteCommentId === "string" ? row.remoteCommentId : id,
        author: typeof row.author === "string" ? row.author : "",
        text: text.trim(),
        kind: KINDS.includes(row.kind as SocialCommentKind)
          ? (row.kind as SocialCommentKind)
          : "other",
        status: STATUSES.includes(row.status as SocialCommentStatus)
          ? (row.status as SocialCommentStatus)
          : "review",
        reply: typeof row.reply === "string" ? row.reply : "",
        replyAfter: typeof row.replyAfter === "string" ? row.replyAfter : "",
        postHeadline: typeof row.postHeadline === "string" ? row.postHeadline : "",
        remoteReplyId: typeof row.remoteReplyId === "string" ? row.remoteReplyId : "",
        error: typeof row.error === "string" ? row.error : "",
        retryCount: Number.isFinite(Number(row.retryCount))
          ? Math.max(0, Number(row.retryCount))
          : 0,
        source: row.source === "paste" ? "paste" : "meta",
        createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString(),
        updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : new Date().toISOString(),
      } satisfies SocialComment;
    })
    .filter((item): item is SocialComment => Boolean(item))
    .slice(0, MAX_COMMENTS);
}

async function readComments(): Promise<SocialComment[]> {
  if (cloudProjectId()) {
    const snap = await store().doc(INDEX_PATH).get();
    return asComments(snap.data()?.comments);
  }
  try {
    const raw = await readFile(localFile(), "utf8");
    return asComments(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

async function writeComments(comments: SocialComment[]): Promise<void> {
  const next = comments.slice(0, MAX_COMMENTS);
  if (cloudProjectId()) {
    await store().doc(INDEX_PATH).set({ comments: next });
    return;
  }
  await mkdir(path.dirname(localFile()), { recursive: true });
  await writeFile(localFile(), JSON.stringify(next, null, 2), "utf8");
}

export function listSocialComments(channel?: SocialChannel): Promise<SocialComment[]> {
  return enqueue(async () => {
    const comments = await readComments();
    if (!channel) return comments;
    return comments.filter((item) => item.channel === channel);
  });
}

export function upsertSocialComment(
  input: Omit<SocialComment, "id" | "createdAt" | "updatedAt"> & { id?: string },
): Promise<SocialComment> {
  return enqueue(async () => {
    const comments = await readComments();
    const remote = input.remoteCommentId.trim();
    const existing = comments.find(
      (item) =>
        item.remoteCommentId === remote &&
        item.channel === input.channel &&
        Boolean(remote),
    );
    const now = new Date().toISOString();
    if (existing) {
      return existing;
    }
    const row: SocialComment = {
      ...input,
      id: input.id || newId("cmt"),
      remoteCommentId: remote || newId("cmt"),
      createdAt: now,
      updatedAt: now,
    };
    await writeComments([row, ...comments].slice(0, MAX_COMMENTS));
    return row;
  });
}

export const MAX_REPLY_RETRIES = 4;

export function saveSocialComment(
  id: string,
  patch: Partial<
    Pick<
      SocialComment,
      "reply" | "status" | "replyAfter" | "remoteReplyId" | "error" | "retryCount"
    >
  >,
): Promise<SocialComment> {
  return enqueue(async () => {
    const comments = await readComments();
    const idx = comments.findIndex((item) => item.id === id);
    if (idx < 0) throw new Error("댓글을 찾지 못했습니다.");
    const next: SocialComment = {
      ...comments[idx]!,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    comments[idx] = next;
    await writeComments(comments);
    return next;
  });
}

export function dueSocialComments(now = new Date()): Promise<SocialComment[]> {
  return enqueue(async () => {
    const stamp = now.toISOString();
    return (await readComments()).filter((item) => {
      if (item.status === "queued") {
        return Boolean(item.replyAfter) && item.replyAfter <= stamp;
      }
      if (item.status !== "failed" || item.source !== "meta") return false;
      if ((item.retryCount ?? 0) >= MAX_REPLY_RETRIES) return false;
      return !item.replyAfter || item.replyAfter <= stamp;
    });
  });
}

export function requeueFailedComments(channel: SocialChannel): Promise<number> {
  return enqueue(async () => {
    const comments = await readComments();
    const now = new Date().toISOString();
    let count = 0;
    const next = comments.map((item) => {
      if (
        item.channel !== channel ||
        item.status !== "failed" ||
        item.source !== "meta" ||
        !item.reply.trim()
      ) {
        return item;
      }
      count += 1;
      return {
        ...item,
        status: "queued" as const,
        retryCount: 0,
        replyAfter: now,
        error: "토큰 복구 후 다시 보냅니다.",
        updatedAt: now,
      };
    });
    if (count) await writeComments(next);
    return count;
  });
}
