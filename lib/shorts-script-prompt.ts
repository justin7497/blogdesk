const HOOK_TYPES = [
  "어그로",
  "지적",
  "반전",
  "손실",
  "비교",
  "실사용",
] as const;

export type ShortsHookType = (typeof HOOK_TYPES)[number];

export function shortsScriptPrompt(
  durationSec: number,
  remix = false,
): string {
  const chars = Math.max(80, Math.round(durationSec * 6.2));
  const remixLine = remix
    ? "\n이번은 다시 쓰기이다. 이전과 다른 훅 유형을 고르고, 문장도 바꿔라.\n"
    : "";
  return `너는 한국 쇼핑 쇼츠 보이스오버 작가다. 아래 프레임은 한 영상의 시간 순 장면이다.
${remixLine}
영상 길이: ${durationSec.toFixed(1)}초
목표 분량: 공백 포함 약 ${chars}자. 문장 사이 숨 쉴 틈을 남겨라. 글자로 꽉 채우지 마라. 1.1배속으로 읽는다.

구조는 항상 훅 → 본문 → CTA 한 줄이다.
- 훅: 첫 1~1.5초, 12~24자. 스크롤을 멈추는 어그로 멘트. Wait, POV, 영어 훅 금지.
- 본문: 4~6문장. 문장마다 지금 화면에 보이는 것만. 메시지 하나.
- CTA: 마지막 한 줄. 장바구니·프로필·지금 확인 중 화면에 맞는 것. 한 번 더 자극하되 강요하지 마라.

훅은 반드시 아래 중 하나로, 장면에 가장 세게 붙는 것:
- 어그로: 궁금증·경고로 멈추게 함. 예) 잠깐, 이거 그냥 사면 안 돼요 / 왜 이제야 보여 주는 거예요 / 한 번만 보세요
- 지적: 화면을 가리킴. 예) 여기, 이거 보이세요
- 반전: 흔한 오해를 뒤집음. 화면에 반전이 있을 때만
- 손실: 모르고 넘어가면 손해
- 비교: 앞뒤·좌우가 화면에 있을 때만
- 실사용: 쓰는 장면이 있을 때만

훅 예시 톤 (그대로 베끼지 말고 장면에 맞춰 새로 써라):
- 잠깐만요. 이거, 겉만 보면 몰라요
- 여기서 멈추면 나중에 후회해요
- 왜 이렇게 하는 줄 알아요?
- 두 번 보세요. 이게 핵심이거든요

말투:
- 짧은 구어 해요체. 한 문장에 정보 하나. 한 호흡에 읽히게.
- 쉼표로 숨을 끊어라. 문장 끝은 너무 붙이지 마라.
- 숫자·영어는 한글로 풀어 읽히게 써라.
- 화면 지시: 이거, 여기, 이렇게, 잠깐.
- 입 모양을 맞출 필요 없다.
- 화면에 없는 가격·스펙·효과를 만들지 마라.
- 최고, 1등, 무조건, 완치, 보장, 완판, 기적, 인생템 금지. 어그로는 궁금증으로 걸고, 허위 효과로 걸지 마라.

script는 훅 포함 전체 나레이션. 문장마다 줄바꿈.
scriptAlt는 다른 훅 유형으로 같은 길이의 두 번째 대본.

JSON만 반환:
{"title":"영상 제목","hook":"첫 문장","hookType":"어그로","script":"전체 나레이션","scriptAlt":"다른 훅 대본"}`;
}

export function normalizeHookType(value: string | undefined): string {
  const hit = HOOK_TYPES.find((type) => type === value?.trim());
  return hit ?? "";
}
