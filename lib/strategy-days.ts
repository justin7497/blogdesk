export type StrategyDay = {
  week: number;
  focus: string;
  tasks: string[];
};

export const STRATEGY_DAYS: StrategyDay[] = [
  {
    week: 1,
    focus: "기반 · 제안 시작",
    tasks: [
      "네이버 블로그명·소개글 점검 (키트 D절 문구)",
      "카테고리 「블로그 대행」 만들기/이름 변경",
      "카카오·메일·사이트 문의가 오는지 테스트",
    ],
  },
  {
    week: 1,
    focus: "타깃 리스트",
    tasks: [
      "네이버 지도에서 지역+업종으로 매장 20곳 메모",
      "각 매장 연락 채널(카톡/인스타/플레이스) 적기",
      "시연 앱·홈 링크 북마크",
    ],
  },
  {
    week: 1,
    focus: "제안 Day",
    tasks: [
      "타깃 5곳에 제안 메시지 발송",
      "보낸 기록: 날짜/상호/채널 메모",
      "답 오면 당일 짧게 회신",
    ],
  },
  {
    week: 1,
    focus: "제안 Day",
    tasks: [
      "다른 타깃 5곳에 제안 발송",
      "무응답·거절도 기록에 남기기",
      "홈 #grow 요금 한 번 훑어보기",
    ],
  },
  {
    week: 1,
    focus: "블로그 다듬기",
    tasks: [
      "첫 글 하단 사이트·카카오·메일 링크 확인",
      "카테고리가 「앱 개발」이면 「블로그 대행」으로 정리",
      "다음 글 제목 후보 1개 정하기 (카페 or 병의원)",
    ],
  },
  {
    week: 1,
    focus: "가벼운 날",
    tasks: [
      "지난 제안 중 무응답 2곳만 한 줄 팔로업",
      "문의함·카톡 확인",
      "오늘은 여기까지 — 쉬어도 OK",
    ],
  },
  {
    week: 1,
    focus: "1주차 리뷰",
    tasks: [
      "이번 주: 제안 몇 통 / 답 몇 건 적기",
      "막힌 점 한 줄만 메모",
      "다음 주 글 제목 확정",
    ],
  },
  {
    week: 2,
    focus: "글 쓰기",
    tasks: [
      "「카페 블로그 대행」 원고 초안 작성",
      "제목·첫 문단에 키워드 넣기",
      "하단 공통 문단 붙이기",
    ],
  },
  {
    week: 2,
    focus: "발행",
    tasks: [
      "네이버에 글 발행 (본문 복사 활용)",
      "공식 사이트 링크 클릭되는지 확인",
      "발행 URL을 메모장에 저장",
    ],
  },
  {
    week: 2,
    focus: "제안 Day",
    tasks: [
      "카페 업종 위주 5곳 제안",
      "시연 링크 반드시 포함",
      "기록 업데이트",
    ],
  },
  {
    week: 2,
    focus: "제안 Day",
    tasks: [
      "다른 5곳 제안",
      "관심 있는 곳엔 시연 화면 한 줄 더 설명",
      "카톡 채널 응대 확인",
    ],
  },
  {
    week: 2,
    focus: "상담 연습",
    tasks: [
      "가상으로 상담 순서 적어보기: 시연→건수→Start/Growth",
      "사이트 #platform #grow 다시 보기",
      "제안 문구 약한 부분 한 줄 고치기",
    ],
  },
  {
    week: 2,
    focus: "가벼운 날",
    tasks: ["무응답 팔로업 2곳", "글 조회·이웃 반응만 확인", "휴식 OK"],
  },
  {
    week: 2,
    focus: "2주차 리뷰",
    tasks: [
      "누적 제안 수 / 상담 수 적기",
      "다음 글: 병의원 제목 확정",
      "잘된 제안 문장 저장",
    ],
  },
  {
    week: 3,
    focus: "글 쓰기",
    tasks: [
      "「병의원 블로그 대행」 초안",
      "키워드·첫 문단·하단 CTA",
      "이미지 자리만 잡아도 OK",
    ],
  },
  {
    week: 3,
    focus: "발행",
    tasks: [
      "병의원 글 발행",
      "이전 글과 내부적으로 주제가 이어지게",
      "URL 메모",
    ],
  },
  {
    week: 3,
    focus: "제안 Day",
    tasks: ["병의원·학원 등 5곳 제안", "시연=데모라고 명시", "기록"],
  },
  {
    week: 3,
    focus: "제안 Day",
    tasks: [
      "5곳 더 제안",
      "답 온 대화만 깊게",
      "견적 숫자는 대화 후에",
    ],
  },
  {
    week: 3,
    focus: "검색 심기",
    tasks: [
      "블로그 소개글·키워드 재확인",
      "글 3편의 제목에 「블로그 대행」계열 있는지 확인",
      "광고는 아직 안 함",
    ],
  },
  {
    week: 3,
    focus: "가벼운 날",
    tasks: ["팔로업 2곳", "문의 채널 확인", "휴식 OK"],
  },
  {
    week: 3,
    focus: "3주차 리뷰",
    tasks: [
      "상담 0이어도 패닉 금지 — 통수·기록만 보면 됨",
      "다음 주 주제: 조회/중장기 글",
      "개선 한 줄",
    ],
  },
  {
    week: 4,
    focus: "글 쓰기",
    tasks: [
      "「조회수가 안 보이는 이유」또는「한 달만 맡기면…」초안",
      "차별점(앱 컨펌) 분명히",
      "하단 CTA",
    ],
  },
  {
    week: 4,
    focus: "발행",
    tasks: [
      "4편째 글 발행",
      "시연·요금 링크 다시 확인",
      "SNS에 링크 공유는 선택",
    ],
  },
  {
    week: 4,
    focus: "제안 Day",
    tasks: [
      "5곳 제안 (이전 거절 제외 새 리스트)",
      "관심 리드에 화면 미팅 제안",
      "기록",
    ],
  },
  {
    week: 4,
    focus: "제안 Day",
    tasks: [
      "5곳 제안",
      "가능하면 짧은 통화/화면 공유 1건 잡기",
      "Growth 설명 연습",
    ],
  },
  {
    week: 4,
    focus: "정리",
    tasks: [
      "28일: 제안 총수 / 답변 / 상담 / 계약 메모",
      "뭐가 먹혔는지 한 줄",
      "다음 28일 시작일만 새로 잡기",
    ],
  },
  {
    week: 4,
    focus: "가벼운 날",
    tasks: ["팔로업만", "과로 금지", "오늘은 쉬어도 진전으로 칩니다"],
  },
  {
    week: 4,
    focus: "28일 마무리",
    tasks: [
      "체크리스트 진행률 확인",
      "못 한 Day는 버려도 됨 — 오늘부터 다시",
      "축하: 4주 파이프라인을 돌린 것",
    ],
  },
];

export const PITCH_TEXT = `안녕하세요, 바이브앱투데이입니다.
네이버 브랜드 블로그 대행과 매장 전용 앱을 중장기 월 정액으로 운영합니다.
글만 올리는 방식이 아니라, 작성 → 앱 컨펌 → 발행 → 조회를 한 화면에서 보실 수 있습니다.
10분만 화면 보여드리며 업종에 맞는 월 건수를 같이 잡아 드릴까요?
사이트: https://www.vibeapptoday.com/#contact
카카오: https://pf.kakao.com/_Bxgtxgn/chat
메일: contact@heartlinktoday.com`;

export const FOOTER_TEXT = `바이브앱투데이는 네이버 브랜드 블로그 대행과 매장 전용 앱을 중장기 월 정액으로 운영합니다.
글 작성 → 앱 컨펌 → 발행 → 조회 확인까지 한 화면입니다.
상담: https://www.vibeapptoday.com/#contact
카카오: https://pf.kakao.com/_Bxgtxgn/chat
메일: contact@heartlinktoday.com`;

export const LINKS_TEXT = `공식 사이트: https://www.vibeapptoday.com/
요금: https://www.vibeapptoday.com/#grow
문의: https://www.vibeapptoday.com/#contact
카카오: https://pf.kakao.com/_Bxgtxgn/chat
메일: contact@heartlinktoday.com`;
