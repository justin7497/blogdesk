import { asErrorMessage, jsonError } from "@/lib/api-error";
import { getSettings } from "@/lib/db";
import { getInstagramPost, listInstagramPosts, saveInstagramPost } from "@/lib/instagram";
import {
  generateSocialPost,
  openaiKey,
  siblingCaptionFor,
} from "@/lib/instagram-generate";
import { socialSlotByKey } from "@/lib/instagram-schedule";
import { fetchRecentFeedCopy } from "@/lib/social-meta";
import type { SocialChannel } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      id?: string;
      channel?: string;
      topic?: string;
      brief?: string;
      slotKey?: string;
    };
    const id = (body.id ?? "").trim();
    if (!id) return jsonError("게시물을 먼저 만들어 주세요.");
    const current = await getInstagramPost(id);
    if (!current) return jsonError("게시물을 찾지 못했습니다.");
    const settings = await getSettings();
    const apiKey = openaiKey(settings);
    if (!apiKey) return jsonError("설정에 OpenAI API 키를 넣어 주세요.");
    const channel: SocialChannel =
      body.channel === "threads" || current.channel === "threads"
        ? "threads"
        : "instagram";
    const slot = socialSlotByKey((body.slotKey || current.slotKey || "").trim());
    const posts = await listInstagramPosts();
    const feedExamples = await fetchRecentFeedCopy(settings, channel);
    const generated = await generateSocialPost({
      apiKey,
      channel,
      topic: (body.topic ?? current.topic).trim() || slot?.topic || "",
      brief: (body.brief ?? current.brief).trim(),
      slot,
      siblingCaption: siblingCaptionFor(posts, slot),
      feedExamples,
      handle:
        channel === "threads"
          ? settings.threadsUsername
          : settings.instagramUsername,
      displayName: settings.socialDisplayName,
      bio: settings.socialBio,
    });
    const post = await saveInstagramPost(
      id,
      {
        topic: (body.topic ?? current.topic).trim() || generated.headline,
        brief: (body.brief ?? current.brief).trim(),
        headline: generated.headline,
        slides: generated.slides,
        caption: generated.caption,
        hashtags: generated.hashtags,
      },
      "혼잣말 생성",
    );
    return Response.json({ post });
  } catch (error) {
    return jsonError(asErrorMessage(error), 500);
  }
}
