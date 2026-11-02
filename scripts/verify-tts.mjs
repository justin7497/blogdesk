import assert from "node:assert/strict";
import test from "node:test";

const FEATURED = [
  { match: /민주|minju/i, label: "민주" },
  { match: /필재|piljae/i, label: "필재" },
];

function featuredIndex(name) {
  return FEATURED.findIndex((item) => item.match.test(name));
}

test("민주·필재 이름을 추천 보이스로 인식한다", () => {
  assert.equal(featuredIndex("민주"), 0);
  assert.equal(featuredIndex("Minju"), 0);
  assert.equal(featuredIndex("필재"), 1);
  assert.equal(featuredIndex("Piljae"), 1);
  assert.equal(featuredIndex("Anna Kim"), -1);
});

test("추천 두 명이 목록 앞에 온다", () => {
  const names = ["발키리", "필재", "VIV", "민주"];
  const sorted = [...names].sort(
    (a, b) => featuredIndex(a) - featuredIndex(b),
  );
  assert.deepEqual(
    sorted.filter((name) => featuredIndex(name) >= 0),
    ["민주", "필재"],
  );
});

const liveUrl =
  process.env.VERIFY_TTS_URL ||
  (process.env.npm_lifecycle_event === "verify:tts:live"
    ? "https://blogdesk-ljh.web.app"
    : "");
if (liveUrl) {
  test("배포된 TTS 검증 API가 타입캐스트를 찾는다", async () => {
    const res = await fetch(new URL("/api/shorts/verify-tts", liveUrl));
    assert.equal(res.ok, true, `verify-tts HTTP ${res.status}`);
    const data = await res.json();
    assert.equal(data.typecast?.configured, true, data.typecast?.error || "타입캐스트 키가 없습니다");
    assert.equal(data.typecast?.ok, true, JSON.stringify(data.typecast));
    for (const label of ["민주", "필재"]) {
      const hit = data.typecast.featured?.find((item) => item.label === label);
      assert.ok(hit?.found, `${label} 보이스를 찾지 못했습니다`);
    }
  });
}
