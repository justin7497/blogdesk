import { getSettings } from "./db";
import {
  createInstagramPost,
  listInstagramPosts,
  purgeExpiredUnapprovedPosts,
} from "./instagram";
import {
  fallbackGenerated,
  generateSocialPost,
  openaiKey,
  siblingCaptionFor,
} from "./instagram-generate";
import {
  SOCIAL_PRODUCE_DAYS,
  upcomingSocialSlots,
  type SocialSlot,
} from "./instagram-schedule";
import { fetchRecentFeedCopy } from "./social-meta";
import { notifyApprovalReady } from "./social-push";
import type { InstagramPost, Settings } from "./types";

export type ProduceSkip = { key: string; reason: string };

export type ProduceResult = {
  created: InstagramPost[];
  skipped: ProduceSkip[];
  purged: InstagramPost[];
  missingKey: boolean;
};

const inflight = new Set<string>();
let producing: Promise<ProduceResult> | null = null;

async function produceOne(
  slot: SocialSlot,
  settings: Settings,
  apiKey: string,
  sibling: string,
  feedExamples: string[],
): Promise<InstagramPost> {
  let generated = fallbackGenerated(slot);
  let note = slot.angle;
  if (apiKey) {
    try {
      generated = await generateSocialPost({
        apiKey,
        channel: slot.channel,
        topic: slot.topic,
        brief: "",
        slot,
        siblingCaption: sibling,
        feedExamples,
        handle:
          slot.channel === "threads"
            ? settings.threadsUsername
            : settings.instagramUsername,
        displayName: settings.socialDisplayName,
        bio: settings.socialBio,
      });
      note = "슬롯 자동 생성";
    } catch (error) {
      note =
        error instanceof Error ? error.message.slice(0, 180) : "생성 실패, 초안만 넣음";
    }
  }
  return createInstagramPost({
    channel: slot.channel,
    topic: slot.topic,
    brief: note,
    headline: generated.headline,
    slides: generated.slides,
    caption: generated.caption,
    hashtags: generated.hashtags,
    scheduledFor: slot.scheduledFor,
    slotKey: slot.key,
    source: "auto",
  });
}

async function runProduce(days: number): Promise<ProduceResult> {
  const purged = await purgeExpiredUnapprovedPosts();
  const settings = await getSettings();
  const apiKey = openaiKey(settings);
  const slots = upcomingSocialSlots(new Date(), days);
  const posts = await listInstagramPosts();
  const feedIg = await fetchRecentFeedCopy(settings, "instagram");
  const feedTh = await fetchRecentFeedCopy(settings, "threads");
  const created: InstagramPost[] = [];
  const skipped: ProduceSkip[] = [];
  const ordered = [...slots].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.channel === b.channel) return a.scheduledFor.localeCompare(b.scheduledFor);
    return a.channel === "instagram" ? -1 : 1;
  });

  for (const slot of ordered) {
    if (posts.some((item) => item.slotKey === slot.key) || inflight.has(slot.key)) {
      skipped.push({ key: slot.key, reason: "이미 있음" });
      continue;
    }
    inflight.add(slot.key);
    try {
      const post = await produceOne(
        slot,
        settings,
        apiKey,
        siblingCaptionFor([...created, ...posts], slot),
        slot.channel === "threads" ? feedTh : feedIg,
      );
      created.push(post);
      posts.unshift(post);
    } finally {
      inflight.delete(slot.key);
    }
  }

  if (created.length) {
    try {
      await notifyApprovalReady(created);
    } catch {
      // 알림 실패가 슬롯 제작을 막지 않게 한다.
    }
  }

  return {
    created,
    skipped,
    purged,
    missingKey: !apiKey,
  };
}

export function produceSocialQueue(
  days = SOCIAL_PRODUCE_DAYS,
): Promise<ProduceResult> {
  if (producing) return producing;
  producing = runProduce(days).finally(() => {
    producing = null;
  });
  return producing;
}
