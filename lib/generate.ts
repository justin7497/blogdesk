import { draftToHtml } from "./html";
import { scoreUniqueness } from "./similarity";
import type {
  Account,
  Draft,
  DraftSection,
  Intent,
  Settings,
  Topic,
} from "./types";

const INTENT_HINT: Record<Intent, string> = {
  info: "검색 질문에 바로 답하는 정보형. 정의 → 판단 기준 → 실수 → 정리.",
  review: "직접 겪었다는 톤. 과정, 수치, 전과 후. 허위 후기는 만들지 말 것. 증거 노트만 사실로 사용.",
  process: "순서대로 따라 할 수 있는 방법. 1-2-3 단계와 각 단계에서 놓치는 점.",
  price: "단정적인 최저가 금지. 범위·조건·추가비용. 증거 노트의 숫자만 사용.",
  local: "지역명과 업종을 자연스럽게. 같은 문장 반복 금지. 동네 맥락(교통, 상권, 대상) 한 줄.",
  faq: "독자가 실제로 묻는 질문 4~6개. 각 답은 두괄식 2~4문장.",
};

export type GeneratedPayload = {
  titles: string[];
  selectedTitle: string;
  lead: string;
  sections: DraftSection[];
  tags: string[];
  evidenceUsed: string;
  internalLinkHint: string;
};

function extractJson(text: string): GeneratedPayload {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced?.[1] ?? text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0) {
    throw new Error("모델이 JSON을 반환하지 않았습니다.");
  }
  return JSON.parse(raw.slice(start, end + 1)) as GeneratedPayload;
}

export function buildPrompt(params: {
  account: Account;
  topic: Topic;
  siblingTitles: string[];
}): string {
  const { account, topic, siblingTitles } = params;
  const siblings =
    siblingTitles.length > 0
      ? siblingTitles.slice(0, 12).map((t) => `- ${t}`).join("\n")
      : "(없음)";

  return `당신은 네이버 블로그 운영 데스크의 작성기다. 아래 계정 하나만 대변한다. 다른 블로그 말투를 섞지 마라.

[계정]
이름: ${account.name}
업종/주제: ${account.niche}
지역: ${account.region || "없음"}
말투: ${account.tone || "담담한 전문가"}
어미: ${account.honorific}체
금지 표현: ${account.forbidden || "효과 보장, 1등, 무조건, 순위 보장"}
대표 키워드: ${account.keywords.join(", ") || topic.keyword}
이 계정만의 증거(사실로만 사용, 없으면 '경험 슬롯'으로 비워 두라고 표시):
${account.evidenceNotes || "(없음 — 일반론만 쓰지 말고, [경험 보강 필요]를 본문에 표시)"}
말투 샘플:
${account.sampleWriting || "(없음)"}

[이번 글]
키워드: ${topic.keyword}
의도: ${topic.intent} — ${INTENT_HINT[topic.intent]}
독자가 검색하는 질문: ${topic.question || topic.keyword + " 어떻게 고르나요?"}

[2026 네이버 규칙]
- 제목은 질문형이거나 '확인해야 할 N가지'처럼 의도가 보이게.
- 첫 2~3문장에서 질문에 답한다. 감성 서론 금지.
- 본문 공백 제외 1800~2800자.
- 소제목(h2)은 검색 가능한 질문.
- 표 하나 또는 리스트 하나를 반드시 넣는다.
- 섹션마다 이미지 슬롯: 무엇을 찍어야 하는지 구체적으로. 스톡/AI 이미지 설명 금지. 현장·자료 사진.
- 키워드를 같은 문장에 반복하지 말 것.
- 다른 계정에서 이미 쓴 제목과 닮게 쓰지 말 것:
${siblings}
- 의료·부동산·학원이면 단정·보장 표현 금지.
- 광고 문장, 쿠팡 링크, 이웃 홍보 넣지 말 것.
- 내부 링크 힌트는 이 블로그에서 다음에 쓰면 좋은 글 제목 한 줄.

JSON만 반환:
{
  "titles": ["제목1","제목2","제목3"],
  "selectedTitle": "제목1",
  "lead": "두괄식 도입 2~3문장",
  "sections": [
    {
      "heading": "질문형 소제목",
      "body": "본문",
      "kind": "text | list | table",
      "listItems": ["..."],
      "table": { "headers": ["",""], "rows": [["",""]] },
      "imageSlot": "촬영할 장면"
    }
  ],
  "tags": ["태그"],
  "evidenceUsed": "이 글에 넣은 증거 한 줄",
  "internalLinkHint": "같은 블로그 다음 글 제목"
}
sections는 3~5개. kind가 text면 listItems/table 생략. 하나는 반드시 list 또는 table.`;
}

async function callOpenAI(settings: Settings, prompt: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: settings.model || "gpt-4o",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: "네이버 블로그 에디터. JSON만 출력한다.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI 오류: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  return data.choices[0]?.message?.content ?? "";
}

async function callAnthropic(settings: Settings, prompt: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": settings.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: settings.model || "claude-sonnet-4-20250514",
      max_tokens: 4000,
      temperature: 0.7,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Anthropic 오류: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as {
    content: { type: string; text?: string }[];
  };
  return data.content.find((c) => c.type === "text")?.text ?? "";
}

async function callGemini(settings: Settings, prompt: string): Promise<string> {
  const model = settings.model.trim() || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const flash = /flash/i.test(model);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "x-goog-api-key": settings.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: "네이버 블로그 에디터. JSON만 출력한다." }],
      },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: "application/json",
        ...(flash ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Gemini 오류: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as {
    candidates?: {
      content?: { parts?: { text?: string; thought?: boolean }[] };
    }[];
  };
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((p) => !p.thought)
    .map((p) => p.text ?? "")
    .join("")
    .trim();
}

export function localFallback(account: Account, topic: Topic): GeneratedPayload {
  const q = topic.question || `${topic.keyword}, 어디서부터 보면 되나요?`;
  const title = q.endsWith("?") || q.endsWith("요") ? q : `${q} 확인할 점`;
  const region = account.region ? `${account.region} ` : "";
  const end = account.honorific === "해요" ? "요" : "니다";
  const lead = `${region}${topic.keyword}를 고를 때 먼저 볼 것은 광고 문장이 아니라 조건과 범위입${end}. 아래 기준으로 보면 실패 확률이 줄어듭${end}.`;
  return {
    titles: [
      title,
      `${topic.keyword} 전에 확인할 ${account.honorific === "해요" ? "것들" : "항목"}`,
      `${region}${account.niche}에서 ${topic.keyword} 묻는 이유`,
    ],
    selectedTitle: title,
    lead,
    sections: [
      {
        heading: `${topic.keyword}를 찾는 사람이 진짜 알고 싶은 것은?`,
        body: account.evidenceNotes
          ? `이 블로그 기준으로 말하면: ${account.evidenceNotes}`
          : "[경험 보강 필요] 실제 사례·숫자·사진을 이 자리에 넣으세요. 설정에 API 키를 넣으면 초안을 다시 씁니다.",
        kind: "text",
        imageSlot: `${account.niche} 현장 또는 자료 한 컷`,
      },
      {
        heading: "한눈에 보는 판단 기준은?",
        body: "표의 항목을 자기 상황에 대입해 보세요.",
        kind: "table",
        table: {
          headers: ["기준", "보면 되는 것", "피하면 좋은 것"],
          rows: [
            ["범위", "어디에 해당하는지", "막연한 최상급"],
            ["조건", "기간·대상·제외", "무조건·보장"],
            ["증거", "사진·수치·과정", "출처 없는 후기"],
          ],
        },
        imageSlot: "표와 같이 둘 실제 견적서/체크리스트 사진",
      },
      {
        heading: "자주 하는 실수는?",
        body: "",
        kind: "list",
        listItems: [
          "키워드만 반복하고 조건은 안 적는 글만 읽고 결정하기",
          "사진 없이 분위기 문장만 있는 글을 근거로 삼기",
          "같은 내용이 여러 블로그에 복붙된 글을 신뢰하기",
        ],
        imageSlot: "실수 사례를 보여주는 메모 또는 비교 컷",
      },
    ],
    tags: [topic.keyword, account.niche, account.region, topic.intent].filter(
      Boolean,
    ),
    evidenceUsed: account.evidenceNotes || "보강 필요",
    internalLinkHint: `${account.niche} ${topic.keyword} 체크리스트`,
  };
}

export async function generateDraftContent(params: {
  account: Account;
  topic: Topic;
  settings: Settings;
  otherDrafts: Draft[];
  accounts: Account[];
}): Promise<Omit<Draft, "id" | "createdAt" | "updatedAt">> {
  const { account, topic, settings, otherDrafts, accounts } = params;
  const siblingTitles = otherDrafts
    .filter((d) => d.accountId !== account.id)
    .map((d) => d.selectedTitle);

  let payload: GeneratedPayload;
  if (!settings.apiKey) {
    payload = localFallback(account, topic);
  } else {
    const prompt = buildPrompt({ account, topic, siblingTitles });
    const raw =
      settings.provider === "anthropic"
        ? await callAnthropic(settings, prompt)
        : settings.provider === "gemini"
          ? await callGemini(settings, prompt)
          : await callOpenAI(settings, prompt);
    payload = extractJson(raw);
  }

  const sections: DraftSection[] = (payload.sections ?? []).map((s) => ({
    heading: s.heading,
    body: s.body ?? "",
    kind: s.kind === "list" || s.kind === "table" ? s.kind : "text",
    listItems: s.listItems,
    table: s.table,
    imageSlot: s.imageSlot,
  }));

  const titles = (payload.titles ?? []).filter(Boolean).slice(0, 3);
  const selectedTitle = payload.selectedTitle || titles[0] || topic.keyword;
  if (!titles.includes(selectedTitle)) titles.unshift(selectedTitle);

  const uniqueness = scoreUniqueness({
    candidate: {
      selectedTitle,
      lead: payload.lead,
      sections,
      accountId: account.id,
    },
    others: otherDrafts,
    accounts,
  });

  const html = draftToHtml({
    lead: payload.lead,
    sections,
    internalLinkHint: payload.internalLinkHint ?? "",
  });

  return {
    topicId: topic.id,
    accountId: account.id,
    titles: titles.length ? titles : [selectedTitle],
    selectedTitle,
    lead: payload.lead,
    sections,
    tags: payload.tags ?? [],
    evidenceUsed: payload.evidenceUsed ?? "",
    internalLinkHint: payload.internalLinkHint ?? "",
    html,
    uniqueness,
  };
}
