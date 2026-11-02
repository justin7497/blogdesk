import { getSettings } from "./db";
import { persistAndSignInstagramCard } from "./instagram-assets";
import { captionForCopy, normalizeSlide } from "./instagram-card";
import { renderInstagramCardPng } from "./instagram-card-render";
import {
  getInstagramPost,
  listInstagramPosts,
  markInstagramPublish,
} from "./instagram";
import { isPublishWindow } from "./instagram-schedule";
import { publishInstagramImage, publishThreadsText } from "./social-meta";
import { notifyPublishFailed } from "./social-push";
import type { InstagramPost } from "./types";

const MAX_PUBLISH_ATTEMPTS = 8;
const inflight = new Set<string>();

export type PublishResult = {
  published: InstagramPost[];
  skipped: { id: string; reason: string }[];
  failed: { id: string; error: string }[];
};

function brandFor(post: InstagramPost, handle: string): string {
  return `@${(handle || "soyeontem").replace(/^@/, "")}`;
}

async function publishOne(post: InstagramPost): Promise<InstagramPost> {
  const settings = await getSettings();
  const caption = captionForCopy(post).trim() || post.headline.trim();
  if (!caption) throw new Error("올릴 본문이 없습니다.");

  let remoteId = "";
  if (post.channel === "threads") {
    remoteId = await publishThreadsText({ settings, text: caption });
  } else {
    const slide = post.slides[0] ? normalizeSlide(post.slides[0]) : null;
    if (!slide) throw new Error("인스타 카드가 없습니다.");
    const png = await renderInstagramCardPng(
      slide,
      brandFor(post, settings.instagramUsername),
    );
    const imageUrl = await persistAndSignInstagramCard(post.id, 0, png);
    remoteId = await publishInstagramImage({
      settings,
      imageUrl,
      caption,
    });
  }

  return markInstagramPublish(
    post.id,
    {
      status: "posted",
      remotePostId: remoteId,
      postedAt: new Date().toISOString(),
      publishError: "",
      publishAttempts: 0,
    },
    "게시",
    post.channel === "threads" ? "스레드" : "인스타그램",
  );
}

export async function publishInstagramNow(id: string): Promise<InstagramPost> {
  const post = await getInstagramPost(id);
  if (!post) throw new Error("게시물을 찾지 못했습니다.");
  if (post.status === "posted" && post.remotePostId) return post;
  if (post.status === "hold" || post.status === "changes") {
    throw new Error("보류·수정 요청 글은 올리지 않습니다.");
  }
  if (inflight.has(post.id)) throw new Error("이미 올리는 중입니다.");
  inflight.add(post.id);
  try {
    return await publishOne(post);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "글을 올리지 못했습니다.";
    const marked = await markInstagramPublish(
      post.id,
      {
        status: post.status === "posted" ? "posted" : post.status,
        publishError: message,
        publishAttempts: (post.publishAttempts ?? 0) + 1,
      },
      "게시 실패",
      message,
    );
    await notifyPublishFailed(marked, message).catch(() => undefined);
    throw new Error(message);
  } finally {
    inflight.delete(post.id);
  }
}

export async function publishDueSocialPosts(
  now = new Date(),
): Promise<PublishResult> {
  const posts = await listInstagramPosts();
  const published: InstagramPost[] = [];
  const skipped: { id: string; reason: string }[] = [];
  const failed: { id: string; error: string }[] = [];

  for (const post of posts) {
    if (post.status === "posted" && post.remotePostId) {
      skipped.push({ id: post.id, reason: "이미 게시됨" });
      continue;
    }
    if (post.status === "hold" || post.status === "changes") {
      skipped.push({ id: post.id, reason: "보류·수정 요청" });
      continue;
    }
    if (!isPublishWindow(post.scheduledFor, now)) {
      skipped.push({ id: post.id, reason: "게시 시각이 아님" });
      continue;
    }
    if ((post.publishAttempts ?? 0) >= MAX_PUBLISH_ATTEMPTS) {
      skipped.push({ id: post.id, reason: "재시도 한도" });
      continue;
    }
    if (inflight.has(post.id)) {
      skipped.push({ id: post.id, reason: "진행 중" });
      continue;
    }
    try {
      published.push(await publishInstagramNow(post.id));
    } catch (error) {
      failed.push({
        id: post.id,
        error: error instanceof Error ? error.message : "게시 실패",
      });
    }
  }

  return { published, skipped, failed };
}
