"use server";

import { revalidatePath } from "next/cache";
import {
  countTopicsOnDate,
  getDb,
  newId,
  todayKst,
  updateDb,
} from "./db";
import { generateDraftContent } from "./generate";
import { draftToHtml } from "./html";
import { scoreUniqueness } from "./similarity";
import { resolveVoiceId } from "./elevenlabs";
import {
  DEFAULT_SOCIAL_BIO,
  DEFAULT_SOCIAL_HANDLE,
  DEFAULT_SOCIAL_NAME,
  normalizeHandle,
} from "./social-account";
import {
  ACCOUNT_COLORS,
  DEFAULT_SETTINGS,
  defaultModel,
  inferProvider,
  type Account,
  type DraftSection,
  type Honorific,
  type Intent,
  type Settings,
  type TopicStatus,
} from "./types";

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/accounts");
  revalidatePath("/calendar");
  revalidatePath("/settings");
  revalidatePath("/editor", "layout");
}

function keepSecret(value: string | undefined): boolean {
  const incoming = (value ?? "").trim();
  return !incoming || incoming.includes("•");
}

export async function saveSettings(input: Settings) {
  try {
    const provider = inferProvider(input);
    const incoming = input.apiKey.trim();
    const keepExisting = keepSecret(incoming);
    const incomingEleven = (input.elevenLabsApiKey ?? "").trim();
    const keepEleven = keepSecret(incomingEleven);
    const incomingOpenAI = (input.openaiApiKey ?? "").trim();
    const keepOpenAI = keepSecret(incomingOpenAI);
    const incomingTypecast = (input.typecastApiKey ?? "").trim();
    const keepTypecast = keepSecret(incomingTypecast);
    const incomingMeta = (input.metaAccessToken ?? "").trim();
    const keepMeta = keepSecret(incomingMeta);
    const incomingThreads = (input.threadsAccessToken ?? "").trim();
    const keepThreads = keepSecret(incomingThreads);
    await updateDb((db) => {
      db.settings = {
        ...db.settings,
        provider,
        apiKey: keepExisting ? db.settings.apiKey : incoming,
        model: input.model.trim() || defaultModel(provider),
        openaiApiKey: keepOpenAI
          ? db.settings.openaiApiKey || ""
          : incomingOpenAI,
        elevenLabsApiKey: keepEleven
          ? db.settings.elevenLabsApiKey || ""
          : incomingEleven,
        elevenLabsVoiceId: resolveVoiceId(
          (input.elevenLabsVoiceId ?? "").trim() ||
            db.settings.elevenLabsVoiceId ||
            DEFAULT_SETTINGS.elevenLabsVoiceId,
        ),
        typecastApiKey: keepTypecast
          ? db.settings.typecastApiKey || ""
          : incomingTypecast,
        typecastVoiceId:
          (input.typecastVoiceId ?? "").trim() ||
          db.settings.typecastVoiceId ||
          "",
        ttsProvider:
          !keepTypecast && incomingTypecast
            ? "typecast"
            : input.ttsProvider === "typecast" || input.ttsProvider === "elevenlabs"
              ? input.ttsProvider
              : db.settings.ttsProvider || "elevenlabs",
        instagramUsername:
          normalizeHandle(input.instagramUsername || "") ||
          db.settings.instagramUsername ||
          DEFAULT_SOCIAL_HANDLE,
        threadsUsername:
          normalizeHandle(input.threadsUsername || "") ||
          db.settings.threadsUsername ||
          DEFAULT_SOCIAL_HANDLE,
        socialDisplayName:
          (input.socialDisplayName || "").trim() ||
          db.settings.socialDisplayName ||
          DEFAULT_SOCIAL_NAME,
        socialBio:
          (input.socialBio || "").trim() ||
          db.settings.socialBio ||
          DEFAULT_SOCIAL_BIO,
        metaAccessToken: keepMeta ? db.settings.metaAccessToken || "" : incomingMeta,
        threadsAccessToken: keepThreads
          ? db.settings.threadsAccessToken || ""
          : incomingThreads,
        instagramUserId: (input.instagramUserId || "").trim() || db.settings.instagramUserId || "",
        threadsUserId: (input.threadsUserId || "").trim() || db.settings.threadsUserId || "",
        socialAutoReply: input.socialAutoReply !== false,
      };
    });
    const { refreshSocialAuth } = await import("./social-inbox");
    await refreshSocialAuth().catch(() => undefined);
    revalidatePath("/settings");
    revalidatePath("/shorts");
    revalidatePath("/instagram");
    revalidatePath("/threads");
    return {
      ok: true as const,
      provider,
      keptApiKey: keepExisting,
      keptOpenAI: keepOpenAI,
      keptElevenLabs: keepEleven,
      keptTypecast: keepTypecast,
      keptMeta: keepMeta,
      keptThreads: keepThreads,
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "저장에 실패했습니다.",
    };
  }
}

export async function upsertAccount(input: Partial<Account> & { id?: string }) {
  const name = (input.name ?? "").trim();
  const niche = (input.niche ?? "").trim();
  if (!name || !niche) {
    return { ok: false as const, error: "이름과 업종은 필수입니다." };
  }
  const dailyCap = Math.min(3, Math.max(1, Number(input.dailyCap) || 1));
  const keywords = (input.keywords ?? [])
    .map((k) => k.trim())
    .filter(Boolean);

  let id = input.id;
  await updateDb((db) => {
    if (id) {
      const idx = db.accounts.findIndex((a) => a.id === id);
      if (idx < 0) return;
      db.accounts[idx] = {
        ...db.accounts[idx],
        name,
        blogUrl: (input.blogUrl ?? "").trim(),
        niche,
        region: (input.region ?? "").trim(),
        tone: (input.tone ?? "").trim(),
        honorific: (input.honorific as Honorific) || "합니다",
        forbidden: (input.forbidden ?? "").trim(),
        keywords,
        dailyCap,
        evidenceNotes: (input.evidenceNotes ?? "").trim(),
        sampleWriting: (input.sampleWriting ?? "").trim(),
        color: input.color || db.accounts[idx].color,
      };
    } else {
      id = newId("acc");
      db.accounts.push({
        id,
        name,
        blogUrl: (input.blogUrl ?? "").trim(),
        niche,
        region: (input.region ?? "").trim(),
        tone: (input.tone ?? "").trim() || "담담한 전문가",
        honorific: (input.honorific as Honorific) || "합니다",
        forbidden: (input.forbidden ?? "").trim(),
        keywords,
        dailyCap,
        evidenceNotes: (input.evidenceNotes ?? "").trim(),
        sampleWriting: (input.sampleWriting ?? "").trim(),
        color:
          input.color ||
          ACCOUNT_COLORS[db.accounts.length % ACCOUNT_COLORS.length],
        createdAt: new Date().toISOString(),
      });
    }
  });
  revalidateAll();
  return { ok: true as const, id };
}

export async function deleteAccount(id: string) {
  await updateDb((db) => {
    db.accounts = db.accounts.filter((a) => a.id !== id);
    db.topics = db.topics.filter((t) => t.accountId !== id);
    db.drafts = db.drafts.filter((d) => d.accountId !== id);
  });
  revalidateAll();
}

export async function createTopic(input: {
  accountId: string;
  date: string;
  keyword: string;
  intent: Intent;
  question: string;
}) {
  const keyword = input.keyword.trim();
  if (!keyword) return { ok: false as const, error: "키워드가 필요합니다." };

  const db = await getDb();
  const account = db.accounts.find((a) => a.id === input.accountId);
  if (!account) return { ok: false as const, error: "계정을 찾을 수 없습니다." };

  const used = countTopicsOnDate(db.topics, account.id, input.date);
  if (used >= account.dailyCap) {
    return {
      ok: false as const,
      error: `${account.name}은 하루 ${account.dailyCap}편까지입니다. (${input.date})`,
    };
  }

  const id = newId("top");
  await updateDb((d) => {
    d.topics.push({
      id,
      accountId: input.accountId,
      date: input.date,
      keyword,
      intent: input.intent,
      question: input.question.trim(),
      status: "planned",
      createdAt: new Date().toISOString(),
    });
  });
  revalidateAll();
  return { ok: true as const, id };
}

export async function moveTopic(id: string, date: string) {
  const db = await getDb();
  const topic = db.topics.find((t) => t.id === id);
  if (!topic) return { ok: false as const, error: "주제를 찾을 수 없습니다." };
  const account = db.accounts.find((a) => a.id === topic.accountId);
  if (!account) return { ok: false as const, error: "계정 없음" };
  const used = countTopicsOnDate(
    db.topics.filter((t) => t.id !== id),
    topic.accountId,
    date,
  );
  if (used >= account.dailyCap) {
    return {
      ok: false as const,
      error: `${account.name} 하루 한도 ${account.dailyCap}편을 넘습니다.`,
    };
  }
  await updateDb((d) => {
    const t = d.topics.find((x) => x.id === id);
    if (t) t.date = date;
  });
  revalidateAll();
  return { ok: true as const };
}

export async function deleteTopic(id: string) {
  await updateDb((db) => {
    const topic = db.topics.find((t) => t.id === id);
    db.topics = db.topics.filter((t) => t.id !== id);
    if (topic?.draftId) {
      db.drafts = db.drafts.filter((d) => d.id !== topic.draftId);
    }
  });
  revalidateAll();
}

export async function setTopicStatus(id: string, status: TopicStatus) {
  await updateDb((db) => {
    const t = db.topics.find((x) => x.id === id);
    if (t) t.status = status;
  });
  revalidateAll();
}

export async function generateForTopic(topicId: string) {
  const db = await getDb();
  const topic = db.topics.find((t) => t.id === topicId);
  if (!topic) return { ok: false as const, error: "주제가 없습니다." };
  const account = db.accounts.find((a) => a.id === topic.accountId);
  if (!account) return { ok: false as const, error: "계정이 없습니다." };

  try {
    const content = await generateDraftContent({
      account,
      topic,
      settings: db.settings,
      otherDrafts: db.drafts.filter((d) => d.topicId !== topicId),
      accounts: db.accounts,
    });

    let draftId = topic.draftId;
    await updateDb((d) => {
      const now = new Date().toISOString();
      if (draftId) {
        const idx = d.drafts.findIndex((x) => x.id === draftId);
        if (idx >= 0) {
          d.drafts[idx] = { ...d.drafts[idx], ...content, updatedAt: now };
        }
      } else {
        draftId = newId("dft");
        d.drafts.push({
          id: draftId,
          ...content,
          createdAt: now,
          updatedAt: now,
        });
      }
      const t = d.topics.find((x) => x.id === topicId);
      if (t) {
        t.draftId = draftId;
        t.status = content.uniqueness.blocked ? "failed" : "draft";
        t.lastError = content.uniqueness.blocked
          ? content.uniqueness.notes[0]
          : undefined;
      }
    });
    revalidateAll();
    return { ok: true as const, draftId, blocked: content.uniqueness.blocked };
  } catch (err) {
    const message = err instanceof Error ? err.message : "생성 실패";
    await updateDb((d) => {
      const t = d.topics.find((x) => x.id === topicId);
      if (t) {
        t.status = "failed";
        t.lastError = message;
      }
    });
    revalidateAll();
    return { ok: false as const, error: message };
  }
}

export async function saveDraft(input: {
  id: string;
  selectedTitle: string;
  titles: string[];
  lead: string;
  sections: DraftSection[];
  tags: string[];
  evidenceUsed: string;
  internalLinkHint: string;
}) {
  const sections = input.sections;
  await updateDb((db) => {
    const draft = db.drafts.find((d) => d.id === input.id);
    if (!draft) return;
    draft.selectedTitle = input.selectedTitle;
    draft.titles = input.titles;
    draft.lead = input.lead;
    draft.sections = sections;
    draft.tags = input.tags;
    draft.evidenceUsed = input.evidenceUsed;
    draft.internalLinkHint = input.internalLinkHint;
    draft.html = draftToHtml(draft);
    draft.uniqueness = scoreUniqueness({
      candidate: draft,
      others: db.drafts.filter((d) => d.id !== draft.id),
      accounts: db.accounts,
    });
    draft.updatedAt = new Date().toISOString();
  });
  revalidateAll();
}

export async function markCopied(topicId: string) {
  await updateDb((db) => {
    const t = db.topics.find((x) => x.id === topicId);
    if (t) t.status = "copied";
  });
  revalidateAll();
}

export async function planWeek(accountId: string, startDate?: string) {
  const db = await getDb();
  const account = db.accounts.find((a) => a.id === accountId);
  if (!account) return { ok: false as const, error: "계정 없음" };
  if (account.keywords.length === 0) {
    return { ok: false as const, error: "계정에 키워드를 먼저 넣으세요." };
  }

  const start = startDate || todayKst();
  const intents: Intent[] = ["info", "local", "process", "faq", "review", "price"];
  const created: string[] = [];

  await updateDb((d) => {
    const acc = d.accounts.find((a) => a.id === accountId);
    if (!acc) return;
    for (let i = 0; i < 7; i += 1) {
      const date = addDays(start, i);
      const used = countTopicsOnDate(d.topics, accountId, date);
      const slots = Math.max(0, acc.dailyCap - used);
      for (let s = 0; s < slots; s += 1) {
        const kw =
          acc.keywords[(d.topics.length + i + s) % acc.keywords.length];
        const intent = intents[(i + s) % intents.length];
        const id = newId("top");
        d.topics.push({
          id,
          accountId,
          date,
          keyword: kw,
          intent,
          question: `${kw}, 어떻게 보면 되나요?`,
          status: "planned",
          createdAt: new Date().toISOString(),
        });
        created.push(id);
      }
    }
  });
  revalidateAll();
  return { ok: true as const, count: created.length };
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const kst = new Date(dt.getTime() + 9 * 60 * 60 * 1000);
  const yy = kst.getUTCFullYear();
  const mm = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(kst.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
