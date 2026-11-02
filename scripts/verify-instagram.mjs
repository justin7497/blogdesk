import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const card = readFileSync(path.join(root, "lib", "instagram-card.ts"), "utf8");
const draw = readFileSync(path.join(root, "lib", "instagram-card-draw.ts"), "utf8");
const gen = readFileSync(
  path.join(root, "lib", "instagram-generate.ts"),
  "utf8",
);
const schedule = readFileSync(
  path.join(root, "lib", "instagram-schedule.ts"),
  "utf8",
);
const desk = readFileSync(
  path.join(root, "components", "InstagramDesk.tsx"),
  "utf8",
);
const produce = readFileSync(
  path.join(root, "lib", "instagram-produce.ts"),
  "utf8",
);
const reply = readFileSync(path.join(root, "lib", "social-reply.ts"), "utf8");
const meta = readFileSync(path.join(root, "lib", "social-meta.ts"), "utf8");
const inbox = readFileSync(path.join(root, "components", "SocialInbox.tsx"), "utf8");

function wrapCardLines(text, maxChars) {
  const source = text.replace(/\s+/g, " ").trim();
  if (!source) return [];
  const lines = [];
  let current = "";
  for (const ch of [...source]) {
    const next = current + ch;
    if (next.length > maxChars && current) {
      lines.push(current.trim());
      current = ch.trimStart();
    } else {
      current = next;
    }
  }
  if (current.trim()) lines.push(current.trim());
  return lines.slice(0, 8);
}

describe("instagram desk", () => {
  it("keeps 1080x1350 card size", () => {
    assert.match(card, /CARD_WIDTH = 1080/);
    assert.match(card, /CARD_HEIGHT = 1350/);
  });

  it("wraps korean card lines", () => {
    const lines = wrapCardLines("출근은 했는데 아직 로딩 중이다", 8);
    assert.equal(lines.length > 1, true);
    assert.equal(lines.every((line) => line.length <= 8), true);
  });

  it("writes the live monologue card here instead of a chatgpt paste", () => {
    assert.match(gen, /gpt-4o/);
    assert.match(gen, /SOCIAL_SERIES/);
    assert.match(gen, /소연템/);
    assert.match(gen, /dialogues/);
    assert.match(gen, /출근은 했는데/);
    assert.match(gen, /fetchRecentFeedCopy|feedExamples/);
    assert.match(schedule, /퇴근 후 혼잣말/);
    assert.match(desk, /여기서 만들기/);
    assert.match(desk, /참고 메모/);
    assert.match(desk, /스레드는 카드 없이/);
    assert.match(desk, /th-preview/);
    assert.doesNotMatch(desk, /ChatGPT로 만들기/);
    assert.doesNotMatch(gen, /캐러셀 3~5장/);
    assert.doesNotMatch(gen, /제품 소개/);
    assert.doesNotMatch(gen, /graph\.facebook\.com/);
  });

  it("draws the cream soyeontem card", () => {
    assert.match(draw, /#F4EFE6/);
    assert.match(draw, /#C4161C/);
    assert.match(draw, /퇴근 후 혼잣말/);
    assert.doesNotMatch(draw, /#163224/);
  });

  it("fills two instagram and two threads slots a day", () => {
    assert.match(schedule, /07:50|hour: 7, minute: 50/);
    assert.match(schedule, /hour: 19, minute: 0/);
    assert.match(schedule, /hour: 12, minute: 10/);
    assert.match(schedule, /hour: 21, minute: 30/);
    assert.match(produce, /자동 생성|슬롯 자동/);
    assert.match(desk, /부족한 슬롯 채우기/);
    assert.match(desk, /is-done/);
    assert.match(schedule, /isScheduledPast/);
    assert.match(produce, /purgeExpiredUnapprovedPosts/);
    assert.doesNotMatch(desk, /접이식 카트/);
  });

  it("deletes unapproved posts after the slot time", () => {
    const instagram = readFileSync(path.join(root, "lib", "instagram.ts"), "utf8");
    assert.match(instagram, /status !== "posted"/);
    assert.match(instagram, /isExpiredUnposted/);
    assert.match(instagram, /purgeExpiredUnapprovedPosts/);
    assert.match(desk, /시간이 지난 미게시/);
  });

  it("publishes approved posts to instagram and threads", () => {
    const publish = readFileSync(path.join(root, "lib", "social-publish.ts"), "utf8");
    const render = readFileSync(
      path.join(root, "lib", "instagram-card-render.ts"),
      "utf8",
    );
    assert.match(publish, /publishDueSocialPosts/);
    assert.match(publish, /publishInstagramImage/);
    assert.match(publish, /publishThreadsText/);
    assert.match(meta, /media_publish/);
    const assets = readFileSync(
      path.join(root, "lib", "instagram-assets.ts"),
      "utf8",
    );
    assert.match(assets, /instagramCardPublicUrl/);
    assert.doesNotMatch(assets, /getSignedUrl/);
    assert.match(render, /@napi-rs\/canvas/);
    assert.match(desk, /지금 올리기/);
    assert.match(desk, /승인을 안 해도/);
    assert.match(desk, /승인 알림/);
    assert.match(schedule, /isPublishWindow/);
    assert.match(schedule, /isExpiredUnposted/);
    assert.match(schedule, /isApprovalReminderWindow/);
    const push = readFileSync(path.join(root, "lib", "social-push.ts"), "utf8");
    const produceSrc = readFileSync(
      path.join(root, "lib", "instagram-produce.ts"),
      "utf8",
    );
    assert.match(push, /notifyApprovalReady/);
    assert.match(push, /notifyApprovalReminders/);
    assert.match(produceSrc, /notifyApprovalReady/);
  });

  it("auto-replies only to empathy and votes via official meta apis", () => {
    assert.match(reply, /canAutoReply/);
    assert.match(reply, /kind === "empathy"/);
    assert.match(meta, /graph\.instagram\.com/);
    assert.match(meta, /graph\.threads\.net/);
    assert.match(meta, /fetchRecentFeedCopy/);
    assert.doesNotMatch(meta, /instagram\.com\/api\/v1/);
    assert.match(inbox, /댓글 자동 답신/);
    assert.match(inbox, /15~40분/);
  });

  it("wakes on a schedule, checks tokens, and retries failed replies", () => {
    const inboxLib = readFileSync(path.join(root, "lib", "social-inbox.ts"), "utf8");
    const comments = readFileSync(path.join(root, "lib", "social-comments.ts"), "utf8");
    const cron = readFileSync(
      path.join(root, "app", "api", "cron", "social", "route.ts"),
      "utf8",
    );
    const health = readFileSync(path.join(root, "lib", "social-health.ts"), "utf8");
    assert.match(meta, /pingChannelMe/);
    assert.match(health, /checkSocialTokens/);
    assert.match(comments, /MAX_REPLY_RETRIES/);
    assert.match(comments, /requeueFailedComments/);
    assert.match(inboxLib, /refreshSocialAuth/);
    assert.match(cron, /syncAndTickComments/);
    assert.match(cron, /produceSocialQueue/);
    assert.match(desk, /토큰 확인 필요/);
    assert.match(desk, /지금 올릴 글/);
    assert.match(inbox, /확인 필요/);
  });

  it("binds soyeontem as the social account", () => {
    const social = readFileSync(
      path.join(root, "lib", "social-account.ts"),
      "utf8",
    );
    assert.match(social, /soyeontem/);
    assert.match(gen, /@\$\{handle\}/);
  });
});
