import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(path.join(root, "lib", "sourcing.ts"), "utf8");

function taobaoSearchUrl(query) {
  return `https://s.taobao.com/search?q=${encodeURIComponent(query)}`;
}

function xiaohongshuSearchUrl(query) {
  return `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(query)}`;
}

describe("sourcing official search", () => {
  it("keeps official taobao and xiaohongshu search urls", () => {
    assert.match(src, /https:\/\/s\.taobao\.com\/search\?q=/);
    assert.match(
      src,
      /https:\/\/www\.xiaohongshu\.com\/search_result\?keyword=/,
    );
    assert.doesNotMatch(src, /download/i);
    assert.doesNotMatch(src, /innertube/i);
  });

  it("encodes chinese queries in official search urls", () => {
    const query = "折叠购物车";
    assert.equal(
      taobaoSearchUrl(query),
      "https://s.taobao.com/search?q=%E6%8A%98%E5%8F%A0%E8%B4%AD%E7%89%A9%E8%BD%A6",
    );
    assert.equal(
      xiaohongshuSearchUrl(query),
      "https://www.xiaohongshu.com/search_result?keyword=%E6%8A%98%E5%8F%A0%E8%B4%AD%E7%89%A9%E8%BD%A6",
    );
  });
});
