import type { Intent, TopicStatus } from "./types";

export const STATUS_LABEL: Record<TopicStatus, string> = {
  planned: "예정",
  draft: "초안",
  approved: "승인",
  copied: "복사 완료",
  failed: "막힘",
};

export const INTENT_LABEL: Record<Intent, string> = {
  info: "정보형",
  review: "후기·경험",
  process: "과정·방법",
  price: "비용·범위",
  local: "지역+업종",
  faq: "FAQ",
};

