import { asErrorMessage, jsonError } from "@/lib/api-error";
import { getSettings } from "@/lib/db";
import { listElevenVoices } from "@/lib/elevenlabs";
import { listTypecastVoices, verifyTypecastCatalog } from "@/lib/typecast";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const settings = await getSettings();
    const eleven = { configured: Boolean(settings.elevenLabsApiKey) };
    const typecast = { configured: Boolean(settings.typecastApiKey) };
    const result: {
      ok: boolean;
      elevenlabs: {
        configured: boolean;
        ok?: boolean;
        count?: number;
        error?: string;
      };
      typecast: {
        configured: boolean;
        ok?: boolean;
        count?: number;
        error?: string;
        featured?: { label: string; found: boolean; name: string }[];
      };
    } = {
      ok: true,
      elevenlabs: eleven,
      typecast,
    };

    if (settings.elevenLabsApiKey) {
      try {
        const voices = await listElevenVoices(settings.elevenLabsApiKey);
        result.elevenlabs = {
          configured: true,
          ok: voices.length > 0,
          count: voices.length,
        };
        if (!voices.length) result.ok = false;
      } catch (error) {
        result.ok = false;
        result.elevenlabs = {
          configured: true,
          ok: false,
          error: asErrorMessage(error),
        };
      }
    }

    if (settings.typecastApiKey) {
      try {
        const voices = await listTypecastVoices(settings.typecastApiKey);
        const check = verifyTypecastCatalog(voices);
        result.typecast = {
          configured: true,
          ok: check.ok,
          count: check.count,
          featured: check.featured,
        };
        if (!check.ok) result.ok = false;
      } catch (error) {
        result.ok = false;
        result.typecast = {
          configured: true,
          ok: false,
          error: asErrorMessage(error),
        };
      }
    } else {
      result.ok = false;
      result.typecast = {
        configured: false,
        ok: false,
        error: "타입캐스트 API 키가 없습니다.",
      };
    }

    return Response.json(result);
  } catch (error) {
    return jsonError(asErrorMessage(error), 500);
  }
}
