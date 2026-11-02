import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { resolveVoiceId } from "./elevenlabs";
import {
  DEFAULT_SOCIAL_BIO,
  DEFAULT_SOCIAL_HANDLE,
  DEFAULT_SOCIAL_NAME,
  normalizeHandle,
} from "./social-account";
import {
  DEFAULT_SETTINGS,
  type Account,
  type ClientSettings,
  type Database,
  type Draft,
  type Settings,
  type SourcingLink,
  type Topic,
} from "./types";

function storageBucketFor(projectId: string): string {
  return process.env.STORAGE_BUCKET?.trim() || `${projectId}-shorts`;
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "db.json");
const STATE_PATH = "desk/state";

let chain: Promise<unknown> = Promise.resolve();
let firestoreDb: Firestore | null = null;

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

function asSourcingLinks(raw: unknown): SourcingLink[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Partial<SourcingLink>;
      const url = typeof row.url === "string" ? row.url.trim() : "";
      if (!url) return null;
      const platform =
        row.platform === "taobao" || row.platform === "xiaohongshu"
          ? row.platform
          : "other";
      return {
        id: typeof row.id === "string" && row.id ? row.id : url,
        product: typeof row.product === "string" && row.product ? row.product : "제품",
        platform,
        url,
        note: typeof row.note === "string" ? row.note : "",
        createdAt:
          typeof row.createdAt === "string" && row.createdAt
            ? row.createdAt
            : new Date().toISOString(),
      } satisfies SourcingLink;
    })
    .filter((item): item is SourcingLink => Boolean(item))
    .slice(0, 50);
}

function emptyDb(): Database {
  return {
    settings: { ...DEFAULT_SETTINGS },
    accounts: [],
    topics: [],
    drafts: [],
    sourcingLinks: [],
  };
}

function normalize(parsed: Partial<Database> | undefined): Database {
  const settings = { ...DEFAULT_SETTINGS, ...parsed?.settings };
  settings.elevenLabsVoiceId = resolveVoiceId(settings.elevenLabsVoiceId);
  settings.ttsProvider =
    settings.ttsProvider === "typecast" ? "typecast" : "elevenlabs";
  settings.typecastApiKey = (settings.typecastApiKey || "").trim();
  settings.typecastVoiceId = (settings.typecastVoiceId || "").trim();
  settings.elevenLabsSpeed = Number(settings.elevenLabsSpeed) || 1.1;
  settings.typecastSpeed = Number(settings.typecastSpeed) || 1.1;
  settings.instagramUsername =
    normalizeHandle(settings.instagramUsername || "") || DEFAULT_SOCIAL_HANDLE;
  settings.threadsUsername =
    normalizeHandle(settings.threadsUsername || "") || DEFAULT_SOCIAL_HANDLE;
  settings.socialDisplayName =
    (settings.socialDisplayName || "").trim() || DEFAULT_SOCIAL_NAME;
  settings.socialBio = (settings.socialBio || "").trim() || DEFAULT_SOCIAL_BIO;
  settings.metaAccessToken = (settings.metaAccessToken || "").trim();
  settings.threadsAccessToken = (settings.threadsAccessToken || "").trim();
  settings.instagramUserId = (settings.instagramUserId || "").trim();
  settings.threadsUserId = (settings.threadsUserId || "").trim();
  settings.socialAutoReply = settings.socialAutoReply !== false;
  return {
    settings,
    accounts: parsed?.accounts ?? [],
    topics: parsed?.topics ?? [],
    drafts: parsed?.drafts ?? [],
    sourcingLinks: asSourcingLinks(parsed?.sourcingLinks),
  };
}

export function cloudProjectId(): string | undefined {
  return (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    undefined
  );
}

export function store(): Firestore {
  if (firestoreDb) return firestoreDb;
  const projectId = cloudProjectId();
  if (!getApps().length) {
    initializeApp(
      projectId
        ? { projectId, storageBucket: storageBucketFor(projectId) }
        : undefined,
    );
  }
  firestoreDb = getFirestore();
  return firestoreDb;
}

async function readDb(): Promise<Database> {
  if (cloudProjectId()) {
    const snap = await store().doc(STATE_PATH).get();
    return normalize(snap.data() as Partial<Database> | undefined);
  }
  try {
    const raw = await readFile(DB_PATH, "utf8");
    return normalize(JSON.parse(raw) as Partial<Database>);
  } catch {
    return emptyDb();
  }
}

async function writeDb(db: Database): Promise<void> {
  if (cloudProjectId()) {
    await store().doc(STATE_PATH).set(JSON.parse(JSON.stringify(db)));
    return;
  }
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

export function getDb(): Promise<Database> {
  return enqueue(readDb);
}

export function updateDb(
  mutator: (db: Database) => void | Database,
): Promise<Database> {
  return enqueue(async () => {
    const db = await readDb();
    const next = mutator(db) ?? db;
    await writeDb(next);
    return next;
  });
}

export async function getSettings(): Promise<Settings> {
  return (await getDb()).settings;
}

let socialEnsured = false;

export async function ensureSocialAccount(): Promise<Settings> {
  if (socialEnsured) return getSettings();
  const db = await updateDb((state) => {
    state.settings.instagramUsername =
      state.settings.instagramUsername || DEFAULT_SOCIAL_HANDLE;
    state.settings.threadsUsername =
      state.settings.threadsUsername || DEFAULT_SOCIAL_HANDLE;
    state.settings.socialDisplayName =
      state.settings.socialDisplayName || DEFAULT_SOCIAL_NAME;
    state.settings.socialBio = state.settings.socialBio || DEFAULT_SOCIAL_BIO;
  });
  socialEnsured = true;
  return db.settings;
}

function keyTail(value: string): string {
  const key = value.trim();
  return key.length >= 4 ? key.slice(-4) : "";
}

export async function getClientSettings(): Promise<ClientSettings> {
  const s = await getSettings();
  const { getSocialHealth } = await import("./social-health");
  const health = await getSocialHealth();
  const openaiFromMain =
    s.apiKey.startsWith("sk-") && !s.apiKey.startsWith("sk-ant");
  return {
    provider: s.provider,
    model: s.model,
    hasKey: Boolean(s.apiKey),
    hasOpenAI: Boolean(s.openaiApiKey || openaiFromMain),
    hasElevenLabs: Boolean(s.elevenLabsApiKey),
    hasTypecast: Boolean(s.typecastApiKey?.trim()),
    apiKeyTail: keyTail(s.apiKey),
    openaiKeyTail: keyTail(s.openaiApiKey) || (openaiFromMain ? keyTail(s.apiKey) : ""),
    elevenLabsKeyTail: keyTail(s.elevenLabsApiKey),
    typecastKeyTail: keyTail(s.typecastApiKey),
    elevenLabsVoiceId: resolveVoiceId(s.elevenLabsVoiceId),
    typecastVoiceId: s.typecastVoiceId || "",
    ttsProvider: s.ttsProvider === "typecast" ? "typecast" : "elevenlabs",
    elevenLabsSpeed: s.elevenLabsSpeed || 1.1,
    typecastSpeed: s.typecastSpeed || 1.1,
    instagramUsername: s.instagramUsername || DEFAULT_SOCIAL_HANDLE,
    threadsUsername: s.threadsUsername || DEFAULT_SOCIAL_HANDLE,
    socialDisplayName: s.socialDisplayName || DEFAULT_SOCIAL_NAME,
    socialBio: s.socialBio || DEFAULT_SOCIAL_BIO,
    hasMetaToken: Boolean(s.metaAccessToken?.trim()),
    hasThreadsToken: Boolean(s.threadsAccessToken?.trim()),
    instagramUserId: s.instagramUserId || "",
    threadsUserId: s.threadsUserId || "",
    socialAutoReply: s.socialAutoReply !== false,
    instagramTokenOk: health.instagram.checkedAt ? health.instagram.ok : null,
    threadsTokenOk: health.threads.checkedAt ? health.threads.ok : null,
    instagramTokenError: health.instagram.error,
    threadsTokenError: health.threads.error,
    tokenCheckedAt: health.instagram.checkedAt || health.threads.checkedAt,
  };
}

export async function getAccounts(): Promise<Account[]> {
  return (await getDb()).accounts;
}

export async function getAccount(id: string): Promise<Account | undefined> {
  return (await getDb()).accounts.find((a) => a.id === id);
}

export async function getTopics(): Promise<Topic[]> {
  return (await getDb()).topics;
}

export async function getTopic(id: string): Promise<Topic | undefined> {
  return (await getDb()).topics.find((t) => t.id === id);
}

export async function getDrafts(): Promise<Draft[]> {
  return (await getDb()).drafts;
}

export async function getDraft(id: string): Promise<Draft | undefined> {
  return (await getDb()).drafts.find((d) => d.id === id);
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function todayKst(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function countTopicsOnDate(topics: Topic[], accountId: string, date: string): number {
  return topics.filter(
    (t) => t.accountId === accountId && t.date === date && t.status !== "failed",
  ).length;
}
