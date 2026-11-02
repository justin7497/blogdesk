import { emptySlide, normalizeSlide } from "./instagram-card";
import { SOCIAL_SERIES, type SocialSlot } from "./instagram-schedule";
import type {
  InstagramDialogue,
  InstagramPost,
  InstagramSlide,
  Settings,
  SocialChannel,
} from "./types";

export type GeneratedSocialPost = {
  headline: string;
  slides: InstagramSlide[];
  caption: string;
  hashtags: string[];
};

export function openaiKey(settings: Settings): string {
  const dedicated = (settings.openaiApiKey ?? "").trim();
  if (dedicated.startsWith("sk-") && !dedicated.startsWith("sk-ant")) {
    return dedicated;
  }
  const main = (settings.apiKey ?? "").trim();
  if (main.startsWith("sk-") && !main.startsWith("sk-ant")) return main;
  return "";
}

function withSoyeontem(tags: string[]): string[] {
  const cleaned = tags
    .map((tag) => tag.replace(/^#/, "").trim())
    .filter(Boolean)
    .filter((tag, index, list) => list.indexOf(tag) === index);
  const without = cleaned.filter((tag) => tag !== "소연템").slice(0, 4);
  return [...without, "소연템"];
}

function extractJson(text: string, fallbackTags: string[]): GeneratedSocialPost {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced?.[1] ?? text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0) {
    throw new Error("모델이 JSON을 반환하지 않았습니다.");
  }
  const parsed = JSON.parse(raw.slice(start, end + 1)) as Partial<GeneratedSocialPost> & {
    slides?: Array<Partial<InstagramSlide>>;
  };
  const slides = (parsed.slides ?? [])
    .map((item) => normalizeSlide(item))
    .filter((item) => item.headline || item.punch || item.body)
    .slice(0, 1);
  const hashtags = withSoyeontem(parsed.hashtags ?? fallbackTags);
  const caption = (parsed.caption ?? "").trim();
  if (!caption && slides.length === 0) {
    throw new Error("본문을 만들지 못했습니다.");
  }
  const headline =
    (parsed.headline ?? "").trim() || slides[0]?.headline || SOCIAL_SERIES;
  return {
    headline,
    slides: slides.length > 0 ? slides : [normalizeSlide({ headline, body: caption.slice(0, 80) })],
    caption,
    hashtags,
  };
}

function fallbackDialogues(slot: SocialSlot): InstagramDialogue[] {
  if (slot.kind === "ig-am" || slot.kind === "th-noon") {
    return [
      { speaker: "회사", line: "지금 출근한 거 맞아?", emphasis: false },
      { speaker: "집", line: "이불 각은 아직 유효해.", emphasis: false },
      { speaker: "뇌", line: "로딩 바 안 움직임.", emphasis: true },
    ];
  }
  if (slot.kind === "ig-pm") {
    return [
      { speaker: "회사", line: "내일 것도 오늘 끝낼래?", emphasis: false },
      { speaker: "현관", line: "신발만 벗어도 반 퇴근이야.", emphasis: false },
      { speaker: "체력", line: "나는 이미 퇴근했어.", emphasis: true },
    ];
  }
  return [
    { speaker: "할 일", line: "아직 세 개 남았는데.", emphasis: false },
    { speaker: "이불", line: "그건 내일 나 담당이야.", emphasis: false },
    { speaker: "의지", line: "배터리 3%야.", emphasis: true },
  ];
}

export function fallbackGenerated(slot: SocialSlot): GeneratedSocialPost {
  const slide = emptySlide(slot.topic);
  slide.headline = slot.topic.includes(",") ? slot.topic : `${slot.topic}, 아직 로딩 중.`;
  slide.dialogues = fallbackDialogues(slot);
  slide.question =
    slot.channel === "instagram" ? "오늘 남은 체력 몇 %야?" : "나만 그래?";
  slide.punch = slot.angle;
  return {
    headline: slide.headline,
    slides: [slide],
    caption: slot.angle,
    hashtags: withSoyeontem(slot.hashtags),
  };
}

export function siblingCaptionFor(
  posts: Array<Pick<InstagramPost, "channel" | "caption" | "slotKey" | "scheduledFor">>,
  slot?: SocialSlot,
): string {
  if (!slot || slot.channel !== "threads") return "";
  const match = posts.find(
    (item) =>
      item.channel === "instagram" &&
      item.caption.trim() &&
      (item.slotKey.startsWith(`${slot.date}-ig-`) ||
        item.scheduledFor.startsWith(slot.date)),
  );
  return match?.caption ?? "";
}

export function socialPostPrompt(input: {
  channel: SocialChannel;
  topic: string;
  brief: string;
  handle?: string;
  displayName?: string;
  bio?: string;
  slot?: SocialSlot;
  siblingCaption?: string;
  feedExamples?: string[];
}): string {
  const isThreads = input.channel === "threads";
  const channel = isThreads
    ? "스레드(Threads). 이미지 카드 없음. caption이 곧 게시물이다."
    : "인스타그램 피드. 카드는 반드시 1장. 캐러셀 금지.";
  const brief = input.brief.trim()
    ? `작성자가 넣은 참고 메모(문장 복붙 금지, 상황만 반영):\n${input.brief.trim()}`
    : input.slot
    ? `초안 없음. 슬롯 각도:\n${input.slot.angle}`
    : "초안이 없다. 주제만 보고 새로 써라.";
  const handle = (input.handle || "soyeontem").replace(/^@/, "");
  const name = input.displayName?.trim() || "소연";
  const bio = input.bio?.trim() || "야근에 지쳐도 내 일상은 소중하니까. 퇴근 후 힐링 꿀템.";
  const sibling = input.siblingCaption?.trim()
    ? `같은 날 다른 채널 본문(문장 복붙 금지):\n${input.siblingCaption.trim()}`
    : "";
  const live = (input.feedExamples ?? [])
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
  const liveBlock = live.length
    ? `최근 실제 올린 본문 말투(문장·훅 복붙 금지, 리듬만 맞춰라):\n${live
        .map((item, index) => `${index + 1}. ${item}`)
        .join("\n")}`
    : "";
  const productRule = input.slot?.productHint
    ? "이번만 공감 뒤에 ‘그래서 내가 산 것’을 한 줄 넣어도 된다. 상품명·스펙이 훅이 되면 안 된다."
    : "상품·공구·카트·캠핑·수납 소개를 하지 마라. 공감 혼잣말만.";
  return `너는 ${name}(@${handle}) 계정의 한국어 소셜 에디터다. ChatGPT 창이 아니라 이 데스크에서 바로 쓴다.
계정 소개: ${bio}
시리즈: ${SOCIAL_SERIES}
채널: ${channel}
주제: ${input.topic.trim() || SOCIAL_SERIES}
${brief}
${sibling}
${liveBlock}

${
    isThreads
      ? `스레드 글 샘플 리듬(문장 복붙 금지):
- 짧은 문단. 첫 줄이 훅. 대상과 혼잣말. 마지막에 질문.
- 회사: 대사 / 빨강 강조 같은 카드 대본을 본문에 넣지 마라.`
      : `실제 피드 카드 샘플(구조만 복제, 문장은 새로):
1) headline "출근은 했는데, 아직 로딩 중이다." / 회사: 9시인데 왜 안 들어와. / 집: 아직 주말 모드야. / 뇌: 재부팅 중... (빨강) / punch 몸은 출근, 머리는 주말. / question 월요일 로딩 몇 %야?
2) headline "퇴근은 했는데, 체력은 현관에 두고 옴." / 회사: 내일 것도 오늘 끝낼래? / 현관: 신발만 벗어도 반 퇴근이야. / 체력: 나는 이미 퇴근했어. (빨강) / punch 일은 내일, 오늘은 누움. / question 오늘 남은 체력 몇 %야?`
  }

말투:
- 1인칭 직장인 혼잣말. 짧은 문장. 🫠 😂 🤍 만 가끔.
- 회사/집/뇌/체력/현관/이불처럼 대상을 인물로 대화시킨다.
- 확인되지 않은 효과·1등·완치·기적을 넣지 마라.
- 샘플 문장을 그대로 쓰지 마라. 이번 주제·요일·슬롯에 맞게 새로 써라.
${productRule}

${
    isThreads
      ? `스레드:
- 카드·slides·dialogues를 채우지 마라. headline은 첫 줄 훅만.
- caption이 게시물 전부다. 문단을 짧게 끊고 마지막에 질문.`
      : `카드 1장 구조(크림 배경 1080×1350, 인스타 화면과 동일):
- series는 항상 "${SOCIAL_SERIES}"
- headline 훅. 가능하면 쉼표로 두 덩어리. 예: 출근은 했는데, 아직 로딩 중이다.
- dialogues 정확히 3개. speaker + line. 그중 한 줄만 emphasis true (보통 세 번째, 빨간 글)
- punch 짧은 대조 한 줄
- question 맨 아래 숫자/% 질문 또는 A vs B
- 카드 문구를 caption에 그대로 반복하지 마라. 캡션은 더 긴 혼잣말.`
  }

캡션:
- 첫 줄이 훅. 인스타 2200자 이하.
- 스레드는 문단을 짧게 끊고, 마지막에 질문.
- 해시태그는 한글 5개. 마지막은 반드시 소연템. 영어 태그 금지.

JSON만 반환:
{"headline":"훅","slides":[{"series":"${SOCIAL_SERIES}","headline":"훅","dialogues":[{"speaker":"나","line":"대사","emphasis":false}],"punch":"결론","question":"질문","body":""}],"caption":"본문","hashtags":["직장인공감","퇴근후일상","회사생활","주제","소연템"]}`;
}

export async function generateSocialPost(input: {
  apiKey: string;
  channel: SocialChannel;
  topic: string;
  brief: string;
  handle?: string;
  displayName?: string;
  bio?: string;
  slot?: SocialSlot;
  siblingCaption?: string;
  feedExamples?: string[];
}): Promise<GeneratedSocialPost> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.7,
      messages: [
        {
          role: "user",
          content: socialPostPrompt({
            channel: input.channel,
            topic: input.topic,
            brief: input.brief,
            handle: input.handle,
            displayName: input.displayName,
            bio: input.bio,
            slot: input.slot,
            siblingCaption: input.siblingCaption,
            feedExamples: input.feedExamples,
          }),
        },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI 오류: ${res.status} ${body.slice(0, 240)}`);
  }
  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  return extractJson(
    data.choices[0]?.message?.content ?? "",
    input.slot?.hashtags ?? ["직장인공감", "퇴근후일상", "회사생활", "소연템"],
  );
}
