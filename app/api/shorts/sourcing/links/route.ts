import { asErrorMessage, jsonError } from "@/lib/api-error";
import { getDb, updateDb } from "@/lib/db";
import { platformFromUrl } from "@/lib/sourcing";
import type { SourcingLink } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function newId(): string {
  return `src_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function GET() {
  try {
    const db = await getDb();
    return Response.json({ links: db.sourcingLinks });
  } catch (error) {
    return jsonError(asErrorMessage(error), 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      product?: string;
      url?: string;
      note?: string;
    };
    const url = (body.url ?? "").trim();
    const product = (body.product ?? "").trim();
    const note = (body.note ?? "").trim();
    if (!url) return jsonError("링크를 넣어 주세요.");
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return jsonError("http 또는 https 주소만 저장할 수 있습니다.");
      }
    } catch {
      return jsonError("링크 형식이 올바르지 않습니다.");
    }
    const item: SourcingLink = {
      id: newId(),
      product: product || "제품",
      platform: platformFromUrl(url),
      url,
      note,
      createdAt: new Date().toISOString(),
    };
    const db = await updateDb((state) => {
      state.sourcingLinks = [item, ...state.sourcingLinks].slice(0, 50);
    });
    return Response.json({ link: item, links: db.sourcingLinks });
  } catch (error) {
    return jsonError(asErrorMessage(error), 500);
  }
}

export async function DELETE(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id") || "";
    if (!id) return jsonError("삭제할 링크가 없습니다.");
    const db = await updateDb((state) => {
      state.sourcingLinks = state.sourcingLinks.filter((item) => item.id !== id);
    });
    return Response.json({ links: db.sourcingLinks });
  } catch (error) {
    return jsonError(asErrorMessage(error), 500);
  }
}
