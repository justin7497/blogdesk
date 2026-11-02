import type { SocialCommentKind, SocialCommentStatus } from "./types";

export const COMMENT_KIND_LABEL: Record<SocialCommentKind, string> = {
  empathy: "공감",
  vote: "투표",
  product: "상품 질문",
  spam: "스팸",
  other: "확인 필요",
};

export const COMMENT_STATUS_LABEL: Record<SocialCommentStatus, string> = {
  review: "승인 대기",
  queued: "자동 대기",
  ready: "복사 대기",
  sent: "보냄",
  skipped: "건너뜀",
  failed: "실패",
};
