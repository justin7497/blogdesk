export const INTENTS = [
  { id: "info", label: "정보형" },
  { id: "review", label: "후기·경험" },
  { id: "process", label: "과정·방법" },
  { id: "price", label: "비용·범위" },
  { id: "local", label: "지역+업종" },
  { id: "faq", label: "FAQ" },
] as const;

export type Intent = (typeof INTENTS)[number]["id"];

export type TopicStatus =
  | "planned"
  | "draft"
  | "approved"
  | "copied"
  | "failed";

export type Honorific = "합니다" | "해요";

export type Account = {
  id: string;
  name: string;
  blogUrl: string;
  niche: string;
  region: string;
  tone: string;
  honorific: Honorific;
  forbidden: string;
  keywords: string[];
  dailyCap: number;
  evidenceNotes: string;
  sampleWriting: string;
  color: string;
  createdAt: string;
};

export type Topic = {
  id: string;
  accountId: string;
  date: string;
  keyword: string;
  intent: Intent;
  question: string;
  status: TopicStatus;
  draftId?: string;
  lastError?: string;
  createdAt: string;
};

export type DraftSection = {
  heading: string;
  body: string;
  kind: "text" | "list" | "table";
  listItems?: string[];
  table?: { headers: string[]; rows: string[][] };
  imageSlot?: string;
  imageUrl?: string;
};

export type UniquenessReport = {
  score: number;
  blocked: boolean;
  warning: boolean;
  matches: { accountName: string; title: string; score: number }[];
  notes: string[];
};

export type Draft = {
  id: string;
  topicId: string;
  accountId: string;
  titles: string[];
  selectedTitle: string;
  lead: string;
  leadImageUrl?: string;
  sections: DraftSection[];
  tags: string[];
  evidenceUsed: string;
  internalLinkHint: string;
  html: string;
  uniqueness: UniquenessReport;
  createdAt: string;
  updatedAt: string;
};

export type Provider = "openai" | "anthropic" | "gemini";

export type TtsProvider = "elevenlabs" | "typecast";

export type Settings = {
  provider: Provider;
  apiKey: string;
  model: string;
  openaiApiKey: string;
  elevenLabsApiKey: string;
  elevenLabsVoiceId: string;
  typecastApiKey: string;
  typecastVoiceId: string;
  ttsProvider: TtsProvider;
  elevenLabsSpeed: number;
  typecastSpeed: number;
  instagramUsername: string;
  threadsUsername: string;
  socialDisplayName: string;
  socialBio: string;
  metaAccessToken: string;
  threadsAccessToken: string;
  instagramUserId: string;
  threadsUserId: string;
  socialAutoReply: boolean;
};

export type ClientSettings = {
  provider: Provider;
  model: string;
  hasKey: boolean;
  hasOpenAI: boolean;
  hasElevenLabs: boolean;
  hasTypecast: boolean;
  apiKeyTail: string;
  openaiKeyTail: string;
  elevenLabsKeyTail: string;
  typecastKeyTail: string;
  elevenLabsVoiceId: string;
  typecastVoiceId: string;
  ttsProvider: TtsProvider;
  elevenLabsSpeed: number;
  typecastSpeed: number;
  instagramUsername: string;
  threadsUsername: string;
  socialDisplayName: string;
  socialBio: string;
  hasMetaToken: boolean;
  hasThreadsToken: boolean;
  instagramUserId: string;
  threadsUserId: string;
  socialAutoReply: boolean;
  instagramTokenOk: boolean | null;
  threadsTokenOk: boolean | null;
  instagramTokenError: string;
  threadsTokenError: string;
  tokenCheckedAt: string;
};

export type ShortsStatus =
  | "uploaded"
  | "scripted"
  | "voiced"
  | "done"
  | "error";

export type ShortsJob = {
  id: string;
  filename: string;
  mimeType: string;
  durationSec: number;
  status: ShortsStatus;
  title: string;
  script: string;
  scriptAlt: string;
  hook: string;
  hookType: string;
  voiceId: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export function defaultModel(provider: Provider): string {
  if (provider === "anthropic") return "claude-sonnet-4-20250514";
  if (provider === "gemini") return "gemini-2.5-flash";
  return "gpt-4o";
}

export function inferProvider(input: {
  provider?: string;
  apiKey?: string;
  model?: string;
}): Provider {
  const key = (input.apiKey ?? "").trim();
  const model = (input.model ?? "").trim().toLowerCase();
  if (key.startsWith("AIza") || model.includes("gemini")) return "gemini";
  if (key.startsWith("sk-ant")) return "anthropic";
  if (input.provider === "anthropic" || input.provider === "gemini" || input.provider === "openai") {
    return input.provider;
  }
  return "openai";
}

export type SourcingPlatform = "taobao" | "xiaohongshu" | "other";

export type SourcingLink = {
  id: string;
  product: string;
  platform: SourcingPlatform;
  url: string;
  note: string;
  createdAt: string;
};

export type SocialChannel = "instagram" | "threads";

export type InstagramPostStatus =
  | "draft"
  | "changes"
  | "hold"
  | "approved"
  | "posted";

export type InstagramDialogue = {
  speaker: string;
  line: string;
  emphasis: boolean;
};

export type InstagramSlide = {
  series: string;
  headline: string;
  dialogues: InstagramDialogue[];
  punch: string;
  question: string;
  body: string;
};

export type InstagramHistoryEvent = {
  at: string;
  action: string;
  note: string;
};

export type SocialCommentKind =
  | "empathy"
  | "vote"
  | "product"
  | "spam"
  | "other";

export type SocialCommentStatus =
  | "review"
  | "queued"
  | "ready"
  | "sent"
  | "skipped"
  | "failed";

export type SocialComment = {
  id: string;
  channel: SocialChannel;
  remotePostId: string;
  remoteCommentId: string;
  author: string;
  text: string;
  kind: SocialCommentKind;
  status: SocialCommentStatus;
  reply: string;
  replyAfter: string;
  postHeadline: string;
  remoteReplyId: string;
  error: string;
  retryCount: number;
  source: "meta" | "paste";
  createdAt: string;
  updatedAt: string;
};

export type InstagramPost = {
  id: string;
  channel: SocialChannel;
  status: InstagramPostStatus;
  topic: string;
  brief: string;
  headline: string;
  slides: InstagramSlide[];
  caption: string;
  hashtags: string[];
  scheduledFor: string;
  slotKey: string;
  source: "manual" | "auto";
  remotePostId: string;
  postedAt: string;
  publishError: string;
  publishAttempts: number;
  notifyReadyAt: string;
  notifyRemindAt: string;
  history: InstagramHistoryEvent[];
  createdAt: string;
  updatedAt: string;
};

export type Database = {
  settings: Settings;
  accounts: Account[];
  topics: Topic[];
  drafts: Draft[];
  sourcingLinks: SourcingLink[];
};

export const ACCOUNT_COLORS = [
  "#c4a574",
  "#7d9b8a",
  "#8fa4c4",
  "#c48a8a",
  "#a48fc4",
  "#c4b87d",
];

export const DEFAULT_SETTINGS: Settings = {
  provider: "openai",
  apiKey: "",
  model: "gpt-4o",
  openaiApiKey: "",
  elevenLabsApiKey: "",
  elevenLabsVoiceId: "uyVNoMrnUku1dZyVEXwD",
  typecastApiKey: "",
  typecastVoiceId: "",
  ttsProvider: "elevenlabs",
  elevenLabsSpeed: 1.1,
  typecastSpeed: 1.1,
  instagramUsername: "soyeontem",
  threadsUsername: "soyeontem",
  socialDisplayName: "소연",
  socialBio: "야근에 지쳐도 내 일상은 소중하니까. 퇴근 후 힐링 꿀템.",
  metaAccessToken: "",
  threadsAccessToken: "",
  instagramUserId: "",
  threadsUserId: "",
  socialAutoReply: true,
};
