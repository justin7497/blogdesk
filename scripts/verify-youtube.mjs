import assert from "node:assert/strict";
import test from "node:test";

const ID_RE = /^[a-zA-Z0-9_-]{11}$/;

function extractYoutubeId(input) {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (ID_RE.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0] || "";
      return ID_RE.test(id) ? id : null;
    }
    if (host === "youtube.com" || host.endsWith(".youtube.com")) {
      const fromQuery = url.searchParams.get("v") || "";
      if (ID_RE.test(fromQuery)) return fromQuery;
      const match = url.pathname.match(
        /\/(?:shorts|embed|live|v)\/([a-zA-Z0-9_-]{11})/,
      );
      if (match?.[1]) return match[1];
    }
  } catch {
    return null;
  }
  return null;
}

test("유튜브 주소에서 영상 ID를 뽑는다", () => {
  assert.equal(
    extractYoutubeId("https://www.youtube.com/watch?v=dQw4w9wgGcQ"),
    "dQw4w9wgGcQ",
  );
  assert.equal(extractYoutubeId("https://youtu.be/dQw4w9wgGcQ"), "dQw4w9wgGcQ");
  assert.equal(
    extractYoutubeId("https://www.youtube.com/shorts/dQw4w9wgGcQ"),
    "dQw4w9wgGcQ",
  );
  assert.equal(extractYoutubeId("dQw4w9wgGcQ"), "dQw4w9wgGcQ");
  assert.equal(extractYoutubeId("not-a-url"), null);
});
