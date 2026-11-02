import type { SocialChannel } from "./types";

export const SOCIAL_SERIES = "퇴근 후 혼잣말";
export const SOCIAL_TIMEZONE = "Asia/Seoul";
export const SOCIAL_PRODUCE_DAYS = 2;

export type SocialSlotKind = "ig-am" | "ig-pm" | "th-noon" | "th-night";

export type SocialSlot = {
  key: string;
  channel: SocialChannel;
  kind: SocialSlotKind;
  date: string;
  scheduledFor: string;
  weekday: number;
  topic: string;
  angle: string;
  productHint: boolean;
  hashtags: string[];
};

const SLOT_CLOCK: Record<SocialSlotKind, { hour: number; minute: number; channel: SocialChannel }> =
  {
    "ig-am": { hour: 7, minute: 50, channel: "instagram" },
    "ig-pm": { hour: 19, minute: 0, channel: "instagram" },
    "th-noon": { hour: 12, minute: 10, channel: "threads" },
    "th-night": { hour: 21, minute: 30, channel: "threads" },
  };

const SLOT_LABEL: Record<SocialSlotKind, string> = {
  "ig-am": "인스타 출근",
  "ig-pm": "인스타 퇴근",
  "th-noon": "스레드 점심",
  "th-night": "스레드 밤",
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function seoulParts(date: Date): {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hour: number;
  minute: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SOCIAL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "0";
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    year: Number(read("year")),
    month: Number(read("month")),
    day: Number(read("day")),
    weekday: weekdayMap[read("weekday")] ?? 0,
    hour: Number(read("hour")),
    minute: Number(read("minute")),
  };
}

function addSeoulDays(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const utc = Date.UTC(year, (month ?? 1) - 1, (day ?? 1) + days, 3, 0, 0);
  const parts = seoulParts(new Date(utc));
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

function weekdayOf(ymd: string): number {
  const [year, month, day] = ymd.split("-").map(Number);
  return seoulParts(new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1, 3, 0, 0)))
    .weekday;
}

function tags(extra: string): string[] {
  return ["직장인공감", "퇴근후일상", extra, "회사생활", "소연템"];
}

function themeFor(
  weekday: number,
  kind: SocialSlotKind,
): { topic: string; angle: string; productHint: boolean; hashtags: string[] } {
  const productHint = weekday === 3 && kind === "ig-pm";
  const table: Record<
    number,
    Record<SocialSlotKind, { topic: string; angle: string; extra: string }>
  > = {
    1: {
      "ig-am": {
        topic: "월요일 출근 로딩",
        angle: "몸은 출근했는데 뇌는 아직 주말인 카드.",
        extra: "월요병",
      },
      "ig-pm": {
        topic: "월요일 퇴근 잔여 체력",
        angle: "하루를 넘긴 월요병, 집 현관에서 한숨.",
        extra: "월요일공감",
      },
      "th-noon": {
        topic: "점심인데 아직 월요병",
        angle: "인스타와 다른 문장으로 점심 혼잣말.",
        extra: "월요병",
      },
      "th-night": {
        topic: "월요일을 넘긴 혼잣말",
        angle: "오늘을 버틴 사람에게 하는 짧은 칭찬.",
        extra: "직장인일상",
      },
    },
    2: {
      "ig-am": {
        topic: "화요일 회사 모드",
        angle: "월요일이 아닌데도 로딩이 필요한 아침.",
        extra: "회사생활",
      },
      "ig-pm": {
        topic: "칼퇴는 하고 싶다",
        angle: "퇴근 20분은 양보 못 하는 대화.",
        extra: "칼퇴",
      },
      "th-noon": {
        topic: "오후만 되면 눈꺼풀",
        angle: "커피로 버티는지 정신력으로 버티는지.",
        extra: "오후졸음",
      },
      "th-night": {
        topic: "화요일 밤 체력",
        angle: "할 일은 남고 의욕은 퇴근한 밤.",
        extra: "퇴근후일상",
      },
    },
    3: {
      "ig-am": {
        topic: "수요일 허들",
        angle: "일주일의 중간인데 에너지는 바닥.",
        extra: "회사생활",
      },
      "ig-pm": {
        topic: "퇴근 후 나를 살린 꿀템",
        angle: "공감 뒤에 ‘그래서 내가 산 것’ 한 줄만. 상품이 먼저 나오면 안 된다.",
        extra: "힐링꿀템",
      },
      "th-noon": {
        topic: "수요일 점심 생존",
        angle: "오후를 넘기기 위한 혼잣말. 물건 광고 금지.",
        extra: "직장인공감",
      },
      "th-night": {
        topic: "수요일 밤 충전",
        angle: "내일을 위해 일찍 누우려다 실패하는 이야기.",
        extra: "퇴근후일상",
      },
    },
    4: {
      "ig-am": {
        topic: "목요일 야근 예감",
        angle: "캘린더에 야근이 써 있지 않아도 느낌이 온다.",
        extra: "야근",
      },
      "ig-pm": {
        topic: "체력이 먼저 퇴근함",
        angle: "일은 남고 배터리는 0%인 대화.",
        extra: "직장인체력",
      },
      "th-noon": {
        topic: "목요일 오후 버티기",
        angle: "불금은 내일인데 오늘은 아직 목요일.",
        extra: "회사생활",
      },
      "th-night": {
        topic: "내일 불금 기대",
        angle: "계획만 거창하고 체력은 이미 예약 취소.",
        extra: "불금",
      },
    },
    5: {
      "ig-am": {
        topic: "불금 계획은 거창함",
        angle: "출근 전엔 맛있는 거, 퇴근 전엔 이미 누울 생각.",
        extra: "불금",
      },
      "ig-pm": {
        topic: "불금 계획은 내가, 취소는 체력이",
        angle: "밖에서 불금 vs 집에서 충전.",
        extra: "금요일퇴근",
      },
      "th-noon": {
        topic: "금요일 낮의 나 vs 밤의 나",
        angle: "계획 세운 사람과 취소한 사람이 동일 인물.",
        extra: "불금",
      },
      "th-night": {
        topic: "전기장판 불금",
        angle: "인스타와 다른 문장으로 집에서 충전하는 밤.",
        extra: "퇴근후일상",
      },
    },
    6: {
      "ig-am": {
        topic: "쉬는 날만 눈이 떠짐",
        angle: "평일엔 못 일어나더니 토요일 아침엔 개운함.",
        extra: "주말공감",
      },
      "ig-pm": {
        topic: "주말인데 집에서 또 출근",
        angle: "빨래가 다음 일을 배정하는 집.",
        extra: "집안일",
      },
      "th-noon": {
        topic: "주말 집안일 연쇄",
        angle: "하나 끝내면 집이 다음 일을 준다.",
        extra: "살림공감",
      },
      "th-night": {
        topic: "토요일을 넘긴 혼잣말",
        angle: "내일도 일요일이라 안심하다가 살짝 불안.",
        extra: "주말공감",
      },
    },
    0: {
      "ig-am": {
        topic: "일요일 아침 예열",
        angle: "내일이 월요일이라는 사실을 아직 안 열고 싶음.",
        extra: "일요일",
      },
      "ig-pm": {
        topic: "내일 출근 생각",
        angle: "일요일 밤만 되면 시계가 빨라진다.",
        extra: "월요병",
      },
      "th-noon": {
        topic: "일요일 낮의 미루기",
        angle: "오늘 할 일을 내일의 나에게 넘기는 중.",
        extra: "주말공감",
      },
      "th-night": {
        topic: "일요일 밤 로딩",
        angle: "알람을 맞춰 놓고 주말을 배웅하는 글.",
        extra: "월요병",
      },
    },
  };
  const picked = table[weekday]?.[kind] ?? {
    topic: SOCIAL_SERIES,
    angle: "직장인 혼잣말.",
    extra: "직장인공감",
  };
  return {
    topic: picked.topic,
    angle: picked.angle,
    productHint,
    hashtags: tags(picked.extra),
  };
}

export function slotLabel(kind: SocialSlotKind): string {
  return SLOT_LABEL[kind];
}

export function socialSlotByKey(key: string, now = new Date()): SocialSlot | undefined {
  const trimmed = key.trim();
  if (!trimmed) return undefined;
  const upcoming = upcomingSocialSlots(now, 7).find((item) => item.key === trimmed);
  if (upcoming) return upcoming;
  const match = trimmed.match(
    /^(\d{4}-\d{2}-\d{2})-(ig-am|ig-pm|th-noon|th-night)$/,
  );
  if (!match?.[1] || !match[2]) return undefined;
  const date = match[1];
  const kind = match[2] as SocialSlotKind;
  const clock = SLOT_CLOCK[kind];
  const weekday = weekdayOf(date);
  const theme = themeFor(weekday, kind);
  return {
    key: trimmed,
    channel: clock.channel,
    kind,
    date,
    scheduledFor: `${date}T${pad(clock.hour)}:${pad(clock.minute)}`,
    weekday,
    topic: theme.topic,
    angle: theme.angle,
    productHint: theme.productHint,
    hashtags: theme.hashtags,
  };
}

function seoulStamp(now: Date): string {
  const parts = seoulParts(now);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

function scheduledStamp(scheduledFor: string): string | undefined {
  const match = scheduledFor.trim().match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (!match?.[1] || !match[2] || !match[3]) return undefined;
  return `${match[1]}T${match[2]}:${match[3]}`;
}

export function isScheduledPast(scheduledFor: string, now = new Date()): boolean {
  const due = scheduledStamp(scheduledFor);
  if (!due) return false;
  return due <= seoulStamp(now);
}

export function isDueForPost(
  scheduledFor: string,
  now = new Date(),
  leadMinutes = 30,
): boolean {
  const due = scheduledStamp(scheduledFor);
  if (!due) return false;
  return due <= seoulStamp(new Date(now.getTime() + leadMinutes * 60 * 1000));
}

export function isApprovalReminderWindow(
  scheduledFor: string,
  now = new Date(),
  leadMinutes = 30,
): boolean {
  const due = scheduledStamp(scheduledFor);
  if (!due) return false;
  const dueMs = Date.parse(`${due}:00+09:00`);
  if (!Number.isFinite(dueMs)) return false;
  const remaining = dueMs - now.getTime();
  return remaining > 0 && remaining <= leadMinutes * 60 * 1000;
}

export const SOCIAL_PUBLISH_WINDOW_MINUTES = 90;

export function isPublishWindow(
  scheduledFor: string,
  now = new Date(),
  windowMinutes = SOCIAL_PUBLISH_WINDOW_MINUTES,
): boolean {
  const due = scheduledStamp(scheduledFor);
  if (!due) return false;
  const dueMs = Date.parse(`${due}:00+09:00`);
  if (!Number.isFinite(dueMs)) return false;
  const elapsed = now.getTime() - dueMs;
  return elapsed >= 0 && elapsed <= windowMinutes * 60 * 1000;
}

export function isExpiredUnposted(
  scheduledFor: string,
  now = new Date(),
  windowMinutes = SOCIAL_PUBLISH_WINDOW_MINUTES,
): boolean {
  return isScheduledPast(scheduledFor, now) && !isPublishWindow(scheduledFor, now, windowMinutes);
}

export function upcomingSocialSlots(
  now = new Date(),
  days = SOCIAL_PRODUCE_DAYS,
): SocialSlot[] {
  const parts = seoulParts(now);
  const today = `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
  const kinds = Object.keys(SLOT_CLOCK) as SocialSlotKind[];
  const slots: SocialSlot[] = [];
  for (let offset = 0; offset < days; offset += 1) {
    const date = addSeoulDays(today, offset);
    const weekday = weekdayOf(date);
    for (const kind of kinds) {
      const clock = SLOT_CLOCK[kind];
      const scheduledFor = `${date}T${pad(clock.hour)}:${pad(clock.minute)}`;
      if (offset === 0) {
        const stamp = parts.hour * 60 + parts.minute;
        const due = clock.hour * 60 + clock.minute;
        if (stamp >= due) continue;
      }
      const theme = themeFor(weekday, kind);
      slots.push({
        key: `${date}-${kind}`,
        channel: clock.channel,
        kind,
        date,
        scheduledFor,
        weekday,
        topic: theme.topic,
        angle: theme.angle,
        productHint: theme.productHint,
        hashtags: theme.hashtags,
      });
    }
  }
  return slots;
}
