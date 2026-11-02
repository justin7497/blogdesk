import type { Settings, SourcingPlatform } from "./types";

export const SOURCING_SCENES = [
  { id: "general", label: "일반" },
  { id: "review", label: "사용 후기" },
  { id: "howto", label: "사용 방법" },
  { id: "unbox", label: "개봉" },
  { id: "real", label: "실사용" },
] as const;

export type SourcingScene = (typeof SOURCING_SCENES)[number]["id"];

export type SourcingQuery = {
  zh: string;
  ko: string;
  kind: string;
};

export type SourcingResult = {
  productKo: string;
  queries: SourcingQuery[];
};

export function taobaoSearchUrl(query: string): string {
  return `https://s.taobao.com/search?q=${encodeURIComponent(query)}`;
}

export function xiaohongshuSearchUrl(query: string): string {
  return `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(query)}`;
}

export function platformFromUrl(url: string): SourcingPlatform {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.includes("taobao.com") || host.includes("tmall.com")) {
      return "taobao";
    }
    if (host.includes("xiaohongshu.com") || host.includes("xhslink.com")) {
      return "xiaohongshu";
    }
  } catch {
    /* ignore */
  }
  return "other";
}

export function openaiKey(settings: Settings): string {
  const dedicated = (settings.openaiApiKey ?? "").trim();
  if (dedicated.startsWith("sk-") && !dedicated.startsWith("sk-ant")) {
    return dedicated;
  }
  const main = (settings.apiKey ?? "").trim();
  if (main.startsWith("sk-") && !main.startsWith("sk-ant")) return main;
  return "";
}

function sceneLine(scene: SourcingScene): string {
  if (scene === "review") return "사용 후기·리뷰 영상에 맞는 검색어를 우선한다.";
  if (scene === "howto") return "사용 방법·조립·설치 영상에 맞는 검색어를 우선한다.";
  if (scene === "unbox") return "개봉·언박싱 영상에 맞는 검색어를 우선한다.";
  if (scene === "real") return "실제 사용·현장 영상에 맞는 검색어를 우선한다.";
  return "제품명과 실사용 검색어를 섞는다.";
}

export function sourcingPrompt(keyword: string, scene: SourcingScene): string {
  const hint = keyword.trim()
    ? `한국어 검색어: ${keyword.trim()}`
    : "사진은 제품 이미지이다. 화면에 보이는 제품만 보고 검색어를 만들어라.";
  return `너는 한국 쇼핑 쇼츠 기획자다. 타오바오와 샤오홍슈(小红书) 공식 검색창에 넣을 중국어 검색어를 만든다.
${hint}
장면: ${sceneLine(scene)}

규칙은 이렇다.
- 화면에 없거나 확인되지 않은 브랜드·스펙·효과를 만들지 마라.
- 중국어 간체 검색어. 타오바오·샤오홍슈에서 실제로 쓰이는 짧은 말.
- 한국어 해설을 같이 달아라.
- 검색어 4~6개. 제품명, 사용 장면, 후기 톤을 섞어라.
- 최고, 1등, 완치, 기적 같은 허위 표현 금지.

JSON만 반환:
{"productKo":"한국어 제품명","queries":[{"zh":"中文检索词","ko":"한국어 뜻","kind":"product"}]}`;
}

function extractJson(text: string): SourcingResult {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced?.[1] ?? text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0) {
    throw new Error("모델이 JSON을 반환하지 않았습니다.");
  }
  const parsed = JSON.parse(raw.slice(start, end + 1)) as Partial<SourcingResult>;
  const queries = (parsed.queries ?? [])
    .map((item) => ({
      zh: (item.zh ?? "").trim(),
      ko: (item.ko ?? "").trim(),
      kind: (item.kind ?? "").trim() || "product",
    }))
    .filter((item) => item.zh)
    .slice(0, 6);
  if (queries.length === 0) throw new Error("검색어를 만들지 못했습니다.");
  return {
    productKo: (parsed.productKo ?? "").trim() || queries[0]?.ko || "제품",
    queries,
  };
}

export async function generateSourcingQueries(input: {
  apiKey: string;
  keyword: string;
  scene: SourcingScene;
  image?: { mime: string; data: string };
}): Promise<SourcingResult> {
  const content: unknown[] = [
    { type: "text", text: sourcingPrompt(input.keyword, input.scene) },
  ];
  if (input.image) {
    content.push({
      type: "image_url",
      image_url: {
        url: `data:${input.image.mime};base64,${input.image.data}`,
      },
    });
  }
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.4,
      messages: [{ role: "user", content }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI 오류: ${res.status} ${body.slice(0, 240)}`);
  }
  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  return extractJson(data.choices[0]?.message?.content ?? "");
}
