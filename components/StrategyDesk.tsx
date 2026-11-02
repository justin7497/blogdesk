"use client";

import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "vibe_daily_v1";

const DAYS: { week: number; focus: string; tasks: string[] }[] = [
  {
    week: 1,
    focus: "기반 · 제안 시작",
    tasks: [
      "네이버 블로그명·소개글 점검 (아래 SEO 키트 문구)",
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
    tasks: [
      "병의원·학원 등 5곳 제안",
      "시연=데모라고 명시",
      "기록",
    ],
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

const LINKS_COPY = `공식 사이트: https://www.vibeapptoday.com/
요금: https://www.vibeapptoday.com/#grow
문의: https://www.vibeapptoday.com/#contact
카카오: https://pf.kakao.com/_Bxgtxgn/chat
메일: contact@heartlinktoday.com`;

const PITCH_COPY = `안녕하세요, 바이브앱투데이입니다.
네이버 브랜드 블로그 대행과 매장 전용 앱을 중장기 월 정액으로 운영합니다.
글만 올리는 방식이 아니라, 작성 → 앱 컨펌 → 발행 → 조회를 한 화면에서 보실 수 있습니다.
10분만 화면 보여드리며 업종에 맞는 월 건수를 같이 잡아 드릴까요?
사이트: https://www.vibeapptoday.com/#contact
카카오: https://pf.kakao.com/_Bxgtxgn/chat
메일: contact@heartlinktoday.com`;

const FOOTER_COPY = `바이브앱투데이는 네이버 브랜드 블로그 대행과 매장 전용 앱을 중장기 월 정액으로 운영합니다.
글 작성 → 앱 컨펌 → 발행 → 조회 확인까지 한 화면입니다.
상담: https://www.vibeapptoday.com/#contact
카카오: https://pf.kakao.com/_Bxgtxgn/chat
메일: contact@heartlinktoday.com`;

function todayIso() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d;
}

function fmt(d: Date) {
  const w = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} (${w})`;
}

function CopyButton({ text, label = "복사" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn primary"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
    >
      {done ? "복사됨" : label}
    </button>
  );
}

function DailyChecklist() {
  const [start, setStart] = useState(todayIso());
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          start?: string;
          checks?: Record<string, boolean>;
        };
        if (parsed.start) setStart(parsed.start);
        if (parsed.checks) setChecks(parsed.checks);
      }
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ start, checks }));
  }, [start, checks, ready]);

  const { total, done, dayHint } = useMemo(() => {
    let t = 0;
    let d = 0;
    DAYS.forEach((day, i) => {
      day.tasks.forEach((_, ti) => {
        t += 1;
        if (checks[`d${i + 1}t${ti}`]) d += 1;
      });
    });
    const startD = new Date(`${start}T12:00:00`);
    const now = new Date(`${todayIso()}T12:00:00`);
    const diff = Math.floor((now.getTime() - startD.getTime()) / 86400000) + 1;
    let hint = "";
    if (diff >= 1 && diff <= DAYS.length) hint = `오늘은 Day ${diff} 권장`;
    else if (diff < 1) hint = "시작일 전입니다. 시작일을 오늘로 맞춰도 됩니다.";
    else hint = "28일 플랜이 끝났습니다. 시작일을 새로 잡으세요.";
    return { total: t, done: d, dayHint: hint, todayDay: Math.min(Math.max(diff, 1), DAYS.length) };
  }, [checks, start]);

  const todayDay = useMemo(() => {
    const startD = new Date(`${start}T12:00:00`);
    const now = new Date(`${todayIso()}T12:00:00`);
    const diff = Math.floor((now.getTime() - startD.getTime()) / 86400000) + 1;
    return Math.min(Math.max(diff, 1), DAYS.length);
  }, [start]);

  let lastWeek = 0;

  return (
    <section className="strategy-section" id="daily">
      <h2>★ 매일 체크리스트 (28일)</h2>
      <p className="muted">
        하루 할 일만 보고 체크하세요. 체크는 <b>이 브라우저에 저장</b>됩니다.
      </p>

      <div className="strategy-sticky">
        <div className="strategy-sticky-top">
          <b>
            진행률 {done} / {total}
          </b>
          <span className="muted">{dayHint}</span>
        </div>
        <div className="strategy-progress">
          <div style={{ width: total ? `${(done / total) * 100}%` : "0%" }} />
        </div>
        <div className="actions" style={{ marginTop: 10 }}>
          <label className="strategy-date-label">
            시작일
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value || todayIso())}
            />
          </label>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              document
                .getElementById(`day-${todayDay}`)
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            오늘로 이동
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              if (!confirm("모든 체크를 지울까요? 시작일은 유지됩니다.")) return;
              setChecks({});
            }}
          >
            체크 초기화
          </button>
        </div>
      </div>

      {DAYS.map((day, i) => {
        const showWeek = day.week !== lastWeek;
        lastWeek = day.week;
        const date = addDays(start, i);
        const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        const isToday = iso === todayIso();
        const dayDone = day.tasks.every((_, ti) => checks[`d${i + 1}t${ti}`]);
        return (
          <div key={i}>
            {showWeek ? (
              <div className="strategy-week">{day.week}주차</div>
            ) : null}
            <div
              id={`day-${i + 1}`}
              className={`strategy-day${dayDone ? " done" : ""}${isToday ? " today" : ""}`}
            >
              <h3>
                Day {i + 1} <span className="muted">{fmt(date)}</span>
              </h3>
              <p className="strategy-focus">{day.focus}</p>
              {day.tasks.map((task, ti) => {
                const id = `d${i + 1}t${ti}`;
                const on = !!checks[id];
                return (
                  <label key={id} className={`strategy-task${on ? " checked" : ""}`}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) =>
                        setChecks((prev) => ({ ...prev, [id]: e.target.checked }))
                      }
                    />
                    <span>{task}</span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
      <p className="muted">
        팁: 하루를 통째로 못 하면, 그날의 <b>첫 번째 칸만</b> 해도 진전입니다.
      </p>
    </section>
  );
}

export function StrategyDesk() {
  return (
    <div className="strategy-desk">
      <div className="page-head">
        <div>
          <h1>수주 전략 · 체크리스트</h1>
          <p>
            바이브앱투데이 블로그 대행 수주 본진. 홈은 클로저, 네이버 블로그는
            유입, 여기는 매일 할 일.
          </p>
        </div>
      </div>

      <nav className="strategy-toc panel">
        <b>목차</b>
        <a href="#daily">★ 매일 체크리스트 (28일)</a>
        <a href="#site">0. 공식 사이트</a>
        <a href="#win">A. 수주 전략</a>
        <a href="#timeline">B. 일정 (0~12주)</a>
        <a href="#weekly">C. 매주 루틴</a>
        <a href="#seo">D. SEO 세팅 키트</a>
        <a href="#quality">E. 네이버 품질 원칙</a>
      </nav>

      <DailyChecklist />

      <section className="strategy-section" id="site">
        <h2>0. 공식 사이트 — vibeapptoday.com</h2>
        <p className="muted">
          클로징·요금·문의의 기준점. 블로그·제안에 쓰는 링크·패키지·금액은{" "}
          <b>여기와 동일</b>하게.
        </p>
        <ul>
          <li>
            <b>홈</b> —{" "}
            <a href="https://www.vibeapptoday.com/" target="_blank" rel="noopener">
              www.vibeapptoday.com
            </a>
          </li>
          <li>
            <b>요금</b> —{" "}
            <a href="https://www.vibeapptoday.com/#grow" target="_blank" rel="noopener">
              /#grow
            </a>{" "}
            (Start 49만~ · Growth 89만~ · Store+ 149만~, VAT 별도)
          </li>
          <li>
            <b>시연</b> —{" "}
            <a href="https://store-hq-ljh.web.app/" target="_blank" rel="noopener">
              store-hq-ljh.web.app
            </a>{" "}
            (시연용)
          </li>
          <li>
            <b>문의</b> —{" "}
            <a href="https://www.vibeapptoday.com/#contact" target="_blank" rel="noopener">
              /#contact
            </a>
          </li>
          <li>
            <b>카카오</b> —{" "}
            <a href="https://pf.kakao.com/_Bxgtxgn/chat" target="_blank" rel="noopener">
              채널 채팅
            </a>
          </li>
          <li>
            <b>메일</b> —{" "}
            <a href="mailto:contact@heartlinktoday.com">contact@heartlinktoday.com</a>
          </li>
          <li>
            <b>네이버 블로그</b> —{" "}
            <a href="https://blog.naver.com/vibeapptoday" target="_blank" rel="noopener">
              blog.naver.com/vibeapptoday
            </a>
          </li>
        </ul>

        <div className="grid-stats strategy-kpi">
          <div className="stat">
            <span>Start · 월 49만~</span>
            <b style={{ fontSize: "1rem" }}>월 8회 · 전용 앱</b>
          </div>
          <div className="stat">
            <span>Growth · 월 89만~</span>
            <b style={{ fontSize: "1rem" }}>월 12회 · 컨펌·리포트</b>
          </div>
          <div className="stat">
            <span>Store+ · 월 149만~</span>
            <b style={{ fontSize: "1rem" }}>Growth + 매장 기능</b>
          </div>
          <div className="stat">
            <span>유튜브·영상</span>
            <b style={{ fontSize: "1rem" }}>별도 견적</b>
          </div>
        </div>

        <div className="panel" style={{ marginTop: 14 }}>
          <b>공식 URL 묶음</b>
          <pre className="strategy-pre">{LINKS_COPY}</pre>
          <CopyButton text={LINKS_COPY} label="공식 링크 묶음 복사" />
        </div>

        <h3>사이트 개선 우선순위</h3>
        <div className="card-grid">
          <div className="idea-card">
            <h3>P0 · Clients 로고</h3>
            <p className="muted">
              시연·후보를 Clients처럼 보이면 위험. 실계약/직영/자사앱만 남기거나
              라벨 분리.
            </p>
          </div>
          <div className="idea-card">
            <h3>P1 · 상위노출 카피</h3>
            <p className="muted">
              근거 없는 「상위노출」「문의↑」완화. 실측 전 숫자 금지.
            </p>
          </div>
          <div className="idea-card">
            <h3>P1 · 문의 폼</h3>
            <p className="muted">
              mailto만이면 이탈. 카카오 1순위 또는 폼 API.
            </p>
          </div>
        </div>
      </section>

      <section className="strategy-section" id="win">
        <h2>A. 수주 전략 한눈에</h2>
        <div className="panel">
          <b>포지션</b>
          <p style={{ marginBottom: 0 }}>
            글만 올리는 대행이 아니라, 작성 → 앱 컨펌 → 발행 → 조회까지 한
            화면으로 보는 <b>브랜드 블로그 대행 + 매장 전용 앱</b>.
          </p>
        </div>
        <h3>타깃 우선순위</h3>
        <ol>
          <li>
            <b>1순위</b> — 카페·병의원·학원·뷰티·주택 (지역+업종)
          </li>
          <li>
            <b>2순위</b> — “대행 써 봤는데 카톡만 온다”는 사장님
          </li>
          <li>
            <b>3순위</b> — 지인·직영·데모 가능 업종 (가짜 사례 금지)
          </li>
        </ol>
        <div className="grid-stats strategy-kpi">
          <div className="stat">
            <span>12주 목표</span>
            <b style={{ fontSize: "1rem" }}>상담 4~8 · 계약 1~2</b>
          </div>
          <div className="stat">
            <span>주간 콘텐츠</span>
            <b style={{ fontSize: "1rem" }}>글 1~2편 + CTA</b>
          </div>
          <div className="stat">
            <span>주간 아웃바운드</span>
            <b style={{ fontSize: "1rem" }}>제안 5곳</b>
          </div>
          <div className="stat">
            <span>광고</span>
            <b style={{ fontSize: "1rem" }}>글 4편 이후만</b>
          </div>
        </div>
        <ul>
          <li>팔지 말 것: 1페이지 보장, 없는 고객, 단기 순위 약속</li>
          <li>팔 것: 중장기 리듬, 앱 컨펌·조회, Start/Growth/Store+</li>
        </ul>
      </section>

      <section className="strategy-section" id="timeline">
        <h2>B. 일정별 진행 (0~12주)</h2>
        <div className="strategy-phase">
          <div className="strategy-when">0주차 · 기반</div>
          <h3>프로필·카테고리·문의 통로</h3>
          <p className="muted">프로필에 「블로그 대행」, 카톡·메일·사이트 열림.</p>
        </div>
        <div className="strategy-phase">
          <div className="strategy-when">1주차 · 첫 글 + 제안</div>
          <h3>발행 1 + 제안 5</h3>
          <p className="muted">계약 없어도 OK. 파이프라인만 열면 됨.</p>
        </div>
        <div className="strategy-phase">
          <div className="strategy-when">2~4주차 · 롱테일</div>
          <h3>업종·지역 글 + 매주 제안 5</h3>
          <p className="muted">누적 글 4~6편. 광고로 도망가지 않기.</p>
        </div>
        <div className="strategy-phase">
          <div className="strategy-when">5~8주차 · 클로징</div>
          <h3>앱·중장기 설득 · 상담 스크립트</h3>
          <p className="muted">상담 2건 이상 또는 파일럿 근접.</p>
        </div>
        <div className="strategy-phase">
          <div className="strategy-when">9~12주차 · 확장</div>
          <h3>검증된 글에만 소액 광고</h3>
          <p className="muted">KPI 점검 후 타깃·문구 수정이 광고 증액보다 우선.</p>
        </div>
      </section>

      <section className="strategy-section" id="weekly">
        <h2>C. 매주 반복 루틴</h2>
        <div className="panel">
          <p>
            <b>월</b> 제목 1개 · <b>화~수</b> 작성·발행 · <b>목</b> 제안 5 ·{" "}
            <b>금</b> 기록·다음 제목
          </p>
          <p className="muted" style={{ marginBottom: 0 }}>
            문의는 영업일 당일 답변. 견적만 달라고 하면 업종·월 건수·기간만 먼저
            묻기.
          </p>
        </div>
        <h3>제안 메시지</h3>
        <div className="panel">
          <pre className="strategy-pre">{PITCH_COPY}</pre>
          <CopyButton text={PITCH_COPY} label="제안 메시지 복사" />
        </div>
      </section>

      <section className="strategy-section" id="seo">
        <h2>D. SEO 세팅 키트</h2>
        <p className="muted">
          블로그(<code>blog.naver.com/vibeapptoday</code>)에 붙여 넣기.
        </p>
        <div className="panel">
          <b>블로그명</b>
          <p>바이브앱투데이 | 브랜드 블로그 대행</p>
          <CopyButton text="바이브앱투데이 | 브랜드 블로그 대행" />
        </div>
        <div className="panel" style={{ marginTop: 12 }}>
          <b>소개글</b>
          <p>
            네이버 브랜드 블로그 대행 + 매장 전용 앱. 글만 올리지 않고,
            확인·발행·조회까지 같이 보는 구조. 중장기 월 정액.
          </p>
          <CopyButton text="네이버 브랜드 블로그 대행 + 매장 전용 앱. 글만 올리지 않고, 확인·발행·조회까지 같이 보는 구조. 중장기 월 정액." />
        </div>
        <div className="panel" style={{ marginTop: 12 }}>
          <b>키워드</b>
          <p>
            블로그 대행, 브랜드 블로그 대행, 네이버 블로그 대행, 매장 전용 앱,
            카페 블로그 대행, 병의원 블로그 대행
          </p>
          <CopyButton text="블로그 대행, 브랜드 블로그 대행, 네이버 블로그 대행, 매장 전용 앱, 카페 블로그 대행, 병의원 블로그 대행" />
        </div>
        <h3>카테고리</h3>
        <ul>
          <li>
            <b>블로그 대행</b> — 서비스·비교·요금
          </li>
          <li>
            <b>업종별 사례</b> — 카페·병의원·학원·주택·뷰티
          </li>
          <li>
            <b>매장 전용 앱</b> — 컨펌·조회·Store+
          </li>
          <li>
            <b>운영 팁</b> — 키워드·발행 주기
          </li>
          <li>
            <b>공지·문의</b>
          </li>
        </ul>
        <h3>첫 8주 제목</h3>
        <ol>
          <li>
            <b>1주</b> 블로그 대행, 뭘 맡겨야 할까? 글만 올리는 대행 vs 전용 앱까지
          </li>
          <li>
            <b>2~3주</b> 카페 블로그 대행 — 지역 검색에 매장이 보이게
          </li>
          <li>
            <b>3~4주</b> 병의원 블로그 대행 — 신뢰 콘텐츠로 문의
          </li>
          <li>
            <b>4~5주</b> 학원·주택 블로그 대행, 업종별 키워드
          </li>
          <li>
            <b>5~6주</b> 조회수가 안 보이는 이유 (앱 컨펌)
          </li>
          <li>
            <b>6~7주</b> 한 달만 맡기면 순위가 안 붙는 이유
          </li>
          <li>
            <b>8~9주</b> 비용, 월 정액 기준 (Start·Growth·Store+)
          </li>
          <li>
            <b>10~12주</b> 블로그 + 인스타·페이스북·회사소개서
          </li>
        </ol>
        <div className="panel">
          <b>글 하단 공통 문단</b>
          <pre className="strategy-pre">{FOOTER_COPY}</pre>
          <CopyButton text={FOOTER_COPY} label="하단 문단 복사" />
        </div>
      </section>

      <section className="strategy-section" id="quality">
        <h2>E. 네이버 품질 원칙 (데스크 규칙)</h2>
        <div className="card-grid">
          <div className="idea-card">
            <h3>C-랭크</h3>
            <p className="muted">
              블로그마다 주제 하나. 클론이 아니라 서로 다른 전문 채널.
            </p>
          </div>
          <div className="idea-card">
            <h3>D.I.A+</h3>
            <p className="muted">
              제목은 질문, 첫 문단에 답. 표·리스트로 구조.
            </p>
          </div>
          <div className="idea-card">
            <h3>증거</h3>
            <p className="muted">
              현장 사진·숫자·기간. AI 이미지·스톡은 기본값 아님.
            </p>
          </div>
        </div>
        <div className="panel" style={{ marginTop: 12 }}>
          <h3 style={{ marginTop: 0 }}>하지 않는 것</h3>
          <ul className="muted" style={{ marginBottom: 0 }}>
            <li>이웃 추가·댓글 자동화</li>
            <li>한 글을 여러 블로그에 복제</li>
            <li>하루 5편 이상, 캡차 우회, 조회수 조작</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
