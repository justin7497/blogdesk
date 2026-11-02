import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const file = path.join(process.cwd(), "fonts", "Pretendard-Bold.otf");
  const body = await readFile(file);
  return new Response(body, {
    headers: {
      "Content-Type": "font/otf",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
