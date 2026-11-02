import { asErrorMessage, jsonError } from "@/lib/api-error";
import { getSettings } from "@/lib/db";
import {
  generateSourcingQueries,
  openaiKey,
  SOURCING_SCENES,
  type SourcingScene,
} from "@/lib/sourcing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

function isScene(value: string): value is SourcingScene {
  return SOURCING_SCENES.some((item) => item.id === value);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      keyword?: string;
      scene?: string;
      image?: { mime?: string; data?: string };
    };
    const keyword = (body.keyword ?? "").trim();
    const rawScene = body.scene || "general";
    const scene: SourcingScene = isScene(rawScene) ? rawScene : "general";
    const mime = (body.image?.mime || "").trim();
    const data = (body.image?.data || "").replace(/\s/g, "");
    const image =
      mime && data && ALLOWED_MIME.has(mime)
        ? { mime, data }
        : undefined;
    if (!keyword && !image) {
      return jsonError("검색어나 제품 사진을 넣어 주세요.");
    }
    if (data && data.length > 6_000_000) {
      return jsonError("사진이 너무 큽니다. 4MB 이하로 올려 주세요.");
    }
    const settings = await getSettings();
    const apiKey = openaiKey(settings);
    if (!apiKey) {
      return jsonError("설정에 OpenAI API 키를 넣어 주세요.");
    }
    const result = await generateSourcingQueries({
      apiKey,
      keyword,
      scene,
      image,
    });
    return Response.json(result);
  } catch (error) {
    return jsonError(asErrorMessage(error), 500);
  }
}
