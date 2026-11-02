import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { cloudProjectId, getSettings, store } from "./db";
import { pingChannelMe } from "./social-meta";
import type { SocialChannel } from "./types";

const HEALTH_PATH = "desk/meta-health";

export type ChannelHealth = {
  ok: boolean;
  error: string;
  username: string;
  checkedAt: string;
};

export type SocialHealth = {
  instagram: ChannelHealth;
  threads: ChannelHealth;
};

function emptyChannel(): ChannelHealth {
  return { ok: false, error: "", username: "", checkedAt: "" };
}

function asChannelHealth(raw: unknown): ChannelHealth {
  if (!raw || typeof raw !== "object") return emptyChannel();
  const row = raw as Partial<ChannelHealth>;
  return {
    ok: row.ok === true,
    error: typeof row.error === "string" ? row.error : "",
    username: typeof row.username === "string" ? row.username : "",
    checkedAt: typeof row.checkedAt === "string" ? row.checkedAt : "",
  };
}

function asHealth(raw: unknown): SocialHealth {
  const row = raw && typeof raw === "object" ? (raw as Partial<SocialHealth>) : {};
  return {
    instagram: asChannelHealth(row.instagram),
    threads: asChannelHealth(row.threads),
  };
}

function localFile(): string {
  return path.join(process.cwd(), "data", "instagram", "meta-health.json");
}

export async function getSocialHealth(): Promise<SocialHealth> {
  if (cloudProjectId()) {
    const snap = await store().doc(HEALTH_PATH).get();
    return asHealth(snap.data());
  }
  try {
    const raw = await readFile(localFile(), "utf8");
    return asHealth(JSON.parse(raw) as unknown);
  } catch {
    return { instagram: emptyChannel(), threads: emptyChannel() };
  }
}

async function writeHealth(health: SocialHealth): Promise<void> {
  if (cloudProjectId()) {
    await store().doc(HEALTH_PATH).set(health);
    return;
  }
  await mkdir(path.dirname(localFile()), { recursive: true });
  await writeFile(localFile(), JSON.stringify(health, null, 2), "utf8");
}

export function tokenRecovered(
  prev: SocialHealth,
  next: SocialHealth,
  channel: SocialChannel,
): boolean {
  return next[channel].ok && !prev[channel].ok;
}

export async function checkSocialTokens(): Promise<{
  prev: SocialHealth;
  next: SocialHealth;
}> {
  const settings = await getSettings();
  const prev = await getSocialHealth();
  const now = new Date().toISOString();
  const ig = await pingChannelMe(settings, "instagram");
  const th = await pingChannelMe(settings, "threads");
  const next: SocialHealth = {
    instagram: {
      ok: ig.ok,
      error: ig.error,
      username: ig.username,
      checkedAt: now,
    },
    threads: {
      ok: th.ok,
      error: th.error,
      username: th.username,
      checkedAt: now,
    },
  };
  await writeHealth(next);
  return { prev, next };
}
