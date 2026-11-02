import { openaiKey } from "./instagram-generate";
import type {
  Settings,
  SocialComment,
  SocialCommentKind,
} from "./types";

const EMPATHY =
  /ㅋㅋ+|ㅎㅎ+|공감|나도|진짜|ㅠ+|ㅜ+|맞아요|인정|개공감|공감됨|완전|실화/;
const VOTE = /vs|밖에서|집에서|충전|불금|커피|정신력|설거지|빨래|화장실/;
const PRODUCT = /어디|링크|얼마|구매|사면|제품|템\s*뭐|뭐야|쿠팡|타오/;
const SPAM =
  /https?:\/\/|bit\.ly|팔로우백|맞팔|홍보|카톡|텔레그램|도박|대출|수익|클릭하면/;

export function classifyComment(text: string): SocialCommentKind {
  const value = text.trim();
  if (!value) return "other";
  if (SPAM.test(value)) return "spam";
  if (PRODUCT.test(value)) return "product";
  if (VOTE.test(value)) return "vote";
  if (EMPATHY.test(value)) return "empathy";
  return "other";
}

export function canAutoReply(kind: SocialCommentKind): boolean {
  return kind === "empathy" || kind === "vote";
}

function pick(id: string, items: string[]): string {
  let n = 0;
  for (const ch of id) n = (n + ch.charCodeAt(0)) % 997;
  return items[n % items.length] ?? items[0] ?? "";
}

export function templateReply(input: {
  id: string;
  kind: SocialCommentKind;
  text: string;
}): string {
  if (input.kind === "spam") return "";
  if (input.kind === "product") return "이건 확인하고 답할게요. 지금은 기억나는 대로 적어두면 위험해서요.";
  if (input.kind === "vote") {
    if (/집|충전|눕|전기장판/.test(input.text)) {
      return pick(input.id, [
        "나도 집에서 충전 쪽… 전기장판이 이김 😂",
        "밖으로 나가려다 현관에서 체력이 취소함. 집 편 인정.",
      ]);
    }
    if (/밖|놀|불금/.test(input.text)) {
      return pick(input.id, [
        "나가기로 했으면 존중합니다. 난 이미 누움 🫠",
        "불금은 밖에서 쓰는 사람이 영웅이에요. 난 집에서 응원.",
      ]);
    }
    return "투표 고마워요. 나는 일단 체력 편 😂";
  }
  if (input.kind === "empathy") {
    return pick(input.id, [
      "진짜… 나만 그런 줄 알았는데 😂",
      "공감 감사합니다. 오늘도 일단 눕는 쪽으로.",
      "이 댓글 보고 안도했어요. 우리만 그런 게 아니었네 🫠",
      "맞아요. 계획은 거창하고 실행은 이불.",
    ]);
  }
  return "남겨줘서 고마워요. 천천히 읽고 다시 올게요.";
}

export function replyDelayMs(id: string): number {
  let n = 0;
  for (const ch of id) n = (n + ch.charCodeAt(0)) % 25;
  return (15 + n) * 60 * 1000;
}

export async function composeReply(input: {
  settings: Settings;
  comment: Pick<SocialComment, "id" | "kind" | "text" | "postHeadline">;
}): Promise<string> {
  const fallback = templateReply(input.comment);
  if (input.comment.kind === "spam") return "";
  const apiKey = openaiKey(input.settings);
  if (!apiKey || input.comment.kind === "empathy" || input.comment.kind === "vote") {
    return fallback;
  }
  const name = input.settings.socialDisplayName || "소연";
  const handle = (
    input.settings.threadsUsername ||
    input.settings.instagramUsername ||
    "soyeontem"
  ).replace(/^@/, "");
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.6,
        messages: [
          {
            role: "user",
            content: `너는 ${name}(@${handle})다. 댓글에 한두 줄로 답한다. 광고·링크·과한 이모지 금지. 🫠😂는 가끔만.
원글: ${input.comment.postHeadline || "퇴근 후 혼잣말"}
댓글 종류: ${input.comment.kind}
댓글: ${input.comment.text}
JSON만: {"reply":"답신"}`,
          },
        ],
      }),
    });
    if (!res.ok) return fallback;
    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    const text = data.choices[0]?.message?.content ?? "";
    const match = text.match(/"reply"\s*:\s*"([^"]+)"/);
    const reply = (match?.[1] ?? "").trim();
    return reply || fallback;
  } catch {
    return fallback;
  }
}
