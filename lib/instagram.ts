import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { cloudProjectId, newId, store } from "./db";
import { persistInstagramPost } from "./instagram-assets";
import { emptySlide, normalizeSlide } from "./instagram-card";
import { isExpiredUnposted } from "./instagram-schedule";
import type {
  InstagramHistoryEvent,
  InstagramPost,
  InstagramPostStatus,
  InstagramSlide,
  SocialChannel,
} from "./types";

const INDEX_PATH = "desk/instagram";
const MAX_POSTS = 60;
const MAX_HISTORY = 40;

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
  return path.join(process.cwd(), "data", "instagram", "posts.json");
}

function asSlides(raw: unknown): InstagramSlide[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const slide = normalizeSlide(item as Partial<InstagramSlide>);
      if (
        !slide.headline.trim() &&
        !slide.body.trim() &&
        !slide.punch.trim() &&
        !slide.question.trim() &&
        !slide.dialogues.some((row) => row.speaker || row.line)
      ) {
        return null;
      }
      return slide;
    })
    .filter((item): item is InstagramSlide => Boolean(item))
    .slice(0, 1);
}

function asHistory(raw: unknown): InstagramHistoryEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Partial<InstagramHistoryEvent>;
      return {
        at: typeof row.at === "string" ? row.at : new Date().toISOString(),
        action: typeof row.action === "string" ? row.action : "기록",
        note: typeof row.note === "string" ? row.note : "",
      };
    })
    .filter((item): item is InstagramHistoryEvent => Boolean(item))
    .slice(0, MAX_HISTORY);
}

export function asInstagramPosts(raw: unknown): InstagramPost[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Partial<InstagramPost>;
      const id = typeof row.id === "string" ? row.id : "";
      if (!id) return null;
      const status: InstagramPostStatus =
        row.status === "approved" ||
        row.status === "posted" ||
        row.status === "changes" ||
        row.status === "hold"
          ? row.status
          : "draft";
      return {
        id,
        channel: row.channel === "threads" ? "threads" : "instagram",
        status,
        topic: typeof row.topic === "string" ? row.topic : "",
        brief: typeof row.brief === "string" ? row.brief : "",
        headline: typeof row.headline === "string" ? row.headline : "",
        slides: asSlides(row.slides),
        caption: typeof row.caption === "string" ? row.caption : "",
        hashtags: Array.isArray(row.hashtags)
          ? row.hashtags.map((tag) => String(tag).replace(/^#/, "")).filter(Boolean)
          : [],
        scheduledFor: typeof row.scheduledFor === "string" ? row.scheduledFor : "",
        slotKey: typeof row.slotKey === "string" ? row.slotKey : "",
        source: row.source === "auto" ? "auto" : "manual",
        remotePostId: typeof row.remotePostId === "string" ? row.remotePostId : "",
        postedAt: typeof row.postedAt === "string" ? row.postedAt : "",
        publishError: typeof row.publishError === "string" ? row.publishError : "",
        publishAttempts: Number.isFinite(Number(row.publishAttempts))
          ? Math.max(0, Number(row.publishAttempts))
          : 0,
        notifyReadyAt: typeof row.notifyReadyAt === "string" ? row.notifyReadyAt : "",
        notifyRemindAt: typeof row.notifyRemindAt === "string" ? row.notifyRemindAt : "",
        history: asHistory(row.history),
        createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString(),
        updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : new Date().toISOString(),
      } satisfies InstagramPost;
    })
    .filter((item): item is InstagramPost => Boolean(item))
    .slice(0, MAX_POSTS);
}

async function readPosts(): Promise<InstagramPost[]> {
  if (cloudProjectId()) {
    const snap = await store().doc(INDEX_PATH).get();
    return asInstagramPosts(snap.data()?.posts);
  }
  try {
    const raw = await readFile(localFile(), "utf8");
    return asInstagramPosts(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

async function writePosts(posts: InstagramPost[]): Promise<void> {
  const next = posts.slice(0, MAX_POSTS);
  if (cloudProjectId()) {
    await store().doc(INDEX_PATH).set({ posts: next });
    return;
  }
  await mkdir(path.dirname(localFile()), { recursive: true });
  await writeFile(localFile(), JSON.stringify(next, null, 2), "utf8");
}

function stamp(
  post: InstagramPost,
  action: string,
  note = "",
): InstagramPost {
  const event: InstagramHistoryEvent = {
    at: new Date().toISOString(),
    action,
    note,
  };
  return {
    ...post,
    updatedAt: event.at,
    history: [event, ...post.history].slice(0, MAX_HISTORY),
  };
}

export function listInstagramPosts(channel?: SocialChannel): Promise<InstagramPost[]> {
  return enqueue(async () => {
    const posts = await readPosts();
    if (!channel) return posts;
    return posts.filter((item) => item.channel === channel);
  });
}

export function getInstagramPost(id: string): Promise<InstagramPost | undefined> {
  return enqueue(async () => (await readPosts()).find((item) => item.id === id));
}

export function createInstagramPost(input: {
  channel: SocialChannel;
  topic: string;
  brief?: string;
  headline?: string;
  slides?: InstagramSlide[];
  caption?: string;
  hashtags?: string[];
  scheduledFor?: string;
  slotKey?: string;
  source?: "manual" | "auto";
}): Promise<InstagramPost> {
  return enqueue(async () => {
    const posts = await readPosts();
    const slotKey = (input.slotKey ?? "").trim();
    if (slotKey) {
      const existing = posts.find((item) => item.slotKey === slotKey);
      if (existing) return existing;
    }
    const now = new Date().toISOString();
    const topic = input.topic.trim() || "퇴근 후 혼잣말";
    const post: InstagramPost = stamp(
      {
        id: newId("ig"),
        channel: input.channel,
        status: "draft",
        topic,
        brief: (input.brief ?? "").trim(),
        headline: (input.headline ?? "").trim() || topic,
        slides: input.slides?.length
          ? input.slides.map((slide) => normalizeSlide(slide)).slice(0, 1)
          : [emptySlide(topic)],
        caption: (input.caption ?? "").trim(),
        hashtags: (input.hashtags ?? []).map((tag) => tag.replace(/^#/, "")).filter(Boolean),
        scheduledFor: input.scheduledFor ?? "",
        slotKey,
        source: input.source === "auto" ? "auto" : "manual",
        remotePostId: "",
        postedAt: "",
        publishError: "",
        publishAttempts: 0,
        notifyReadyAt: "",
        notifyRemindAt: "",
        history: [],
        createdAt: now,
        updatedAt: now,
      },
      input.source === "auto" ? "자동 제작" : "작성 시작",
      input.channel === "threads" ? "스레드" : "인스타그램",
    );
    const next = [post, ...posts].slice(0, MAX_POSTS);
    await writePosts(next);
    await persistInstagramPost(post);
    return post;
  });
}

export function saveInstagramPost(
  id: string,
  patch: Partial<
    Pick<
      InstagramPost,
      | "topic"
      | "brief"
      | "headline"
      | "slides"
      | "caption"
      | "hashtags"
      | "scheduledFor"
      | "slotKey"
      | "source"
    >
  >,
  historyNote = "수정",
): Promise<InstagramPost> {
  return enqueue(async () => {
    const posts = await readPosts();
    const idx = posts.findIndex((item) => item.id === id);
    if (idx < 0) throw new Error("게시물을 찾지 못했습니다.");
    const current = posts[idx]!;
    const next = stamp(
      {
        ...current,
        topic: patch.topic ?? current.topic,
        brief: patch.brief ?? current.brief,
        headline: patch.headline ?? current.headline,
        slides: patch.slides
          ? patch.slides.map((slide) => normalizeSlide(slide)).slice(0, 1)
          : current.slides,
        caption: patch.caption ?? current.caption,
        hashtags: patch.hashtags ?? current.hashtags,
        scheduledFor: patch.scheduledFor ?? current.scheduledFor,
        slotKey: patch.slotKey ?? current.slotKey,
        source: patch.source ?? current.source,
      },
      historyNote,
    );
    posts[idx] = next;
    await writePosts(posts);
    await persistInstagramPost(next);
    return next;
  });
}

export function setInstagramStatus(
  id: string,
  status: InstagramPostStatus,
  note = "",
): Promise<InstagramPost> {
  return enqueue(async () => {
    const posts = await readPosts();
    const idx = posts.findIndex((item) => item.id === id);
    if (idx < 0) throw new Error("게시물을 찾지 못했습니다.");
    if (posts[idx]?.status === "posted") {
      throw new Error("이미 올린 글은 상태를 바꿀 수 없습니다.");
    }
    const label =
      status === "approved"
        ? "승인"
        : status === "posted"
          ? "게시"
          : status === "changes"
            ? "수정 요청"
            : status === "hold"
              ? "보류"
              : "작성중";
    if (status === "changes" && !note.trim()) {
      throw new Error("수정 요청 이유를 적어 주세요.");
    }
    const next = stamp({ ...posts[idx]!, status }, label, note.trim());
    posts[idx] = next;
    await writePosts(posts);
    await persistInstagramPost(next);
    return next;
  });
}

export function deleteInstagramPost(id: string): Promise<void> {
  return enqueue(async () => {
    const posts = (await readPosts()).filter((item) => item.id !== id);
    await writePosts(posts);
  });
}

export function purgeExpiredUnapprovedPosts(
  now = new Date(),
): Promise<InstagramPost[]> {
  return enqueue(async () => {
    const posts = await readPosts();
    const deleted: InstagramPost[] = [];
    const kept: InstagramPost[] = [];
    for (const post of posts) {
      if (post.status !== "posted" && isExpiredUnposted(post.scheduledFor, now)) {
        deleted.push(post);
      } else {
        kept.push(post);
      }
    }
    if (deleted.length) await writePosts(kept);
    return deleted;
  });
}

export function markInstagramNotify(
  id: string,
  patch: Partial<Pick<InstagramPost, "notifyReadyAt" | "notifyRemindAt">>,
): Promise<InstagramPost | undefined> {
  return enqueue(async () => {
    const posts = await readPosts();
    const idx = posts.findIndex((item) => item.id === id);
    if (idx < 0) return undefined;
    const current = posts[idx]!;
    const next: InstagramPost = {
      ...current,
      notifyReadyAt: patch.notifyReadyAt ?? current.notifyReadyAt,
      notifyRemindAt: patch.notifyRemindAt ?? current.notifyRemindAt,
      updatedAt: new Date().toISOString(),
    };
    posts[idx] = next;
    await writePosts(posts);
    return next;
  });
}

export function markInstagramPublish(
  id: string,
  patch: Partial<
    Pick<
      InstagramPost,
      "status" | "remotePostId" | "postedAt" | "publishError" | "publishAttempts"
    >
  >,
  action: string,
  note = "",
): Promise<InstagramPost> {
  return enqueue(async () => {
    const posts = await readPosts();
    const idx = posts.findIndex((item) => item.id === id);
    if (idx < 0) throw new Error("게시물을 찾지 못했습니다.");
    const current = posts[idx]!;
    const next = stamp(
      {
        ...current,
        status: patch.status ?? current.status,
        remotePostId: patch.remotePostId ?? current.remotePostId,
        postedAt: patch.postedAt ?? current.postedAt,
        publishError: patch.publishError ?? current.publishError,
        publishAttempts: patch.publishAttempts ?? current.publishAttempts,
      },
      action,
      note,
    );
    posts[idx] = next;
    await writePosts(posts);
    await persistInstagramPost(next);
    return next;
  });
}
