import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { cloudProjectId, newId, store } from "./db";
import {
  deleteJobAssets,
  hydrateJobAssets,
  persistJobAssets,
} from "./shorts-assets";
import type { ShortsJob } from "./types";

const SHORTS_INDEX = "desk/shorts";
const MAX_JOBS = 50;

function cloudMode(): boolean {
  return Boolean(cloudProjectId());
}

export function shortsRoot(): string {
  return cloudMode()
    ? path.join("/tmp", "shorts")
    : path.join(process.cwd(), "data", "shorts");
}

function indexPath(): string {
  return path.join(shortsRoot(), "jobs.json");
}

export function jobDir(id: string): string {
  return path.join(shortsRoot(), id);
}

export function jobFile(
  id: string,
  name: "voice" | "output" | "script" | "captions",
): string {
  const ext =
    name === "voice"
      ? "mp3"
      : name === "output"
        ? "mp4"
        : name === "captions"
          ? "ass"
          : "json";
  return path.join(jobDir(id), `${name}.${ext}`);
}

export async function ensureJobFiles(id: string): Promise<void> {
  assertJobId(id);
  await hydrateJobAssets(id, jobDir(id));
}

export function findSource(id: string): string {
  assertJobId(id);
  for (const ext of ["mp4", "webm", "mov", "m4v"]) {
    const file = path.join(jobDir(id), `source.${ext}`);
    if (existsSync(file)) return file;
  }
  throw new Error("원본 영상이 없습니다.");
}

export async function saveJobFiles(id: string, names?: string[]): Promise<void> {
  assertJobId(id);
  await persistJobAssets(id, jobDir(id), names);
}

function assertJobId(id: string) {
  if (!/^shorts_[a-z0-9]+_[a-z0-9]+$/i.test(id)) {
    throw new Error("잘못된 작업 ID입니다.");
  }
}

function normalizeJob(job: Partial<ShortsJob>): ShortsJob {
  return {
    id: job.id || "",
    filename: job.filename || "",
    mimeType: job.mimeType || "",
    durationSec: job.durationSec || 0,
    status: job.status || "uploaded",
    title: job.title || "",
    script: job.script || "",
    scriptAlt: job.scriptAlt || "",
    hook: job.hook || "",
    hookType: job.hookType || "",
    voiceId: job.voiceId || "",
    error: job.error,
    createdAt: job.createdAt || new Date().toISOString(),
    updatedAt: job.updatedAt || job.createdAt || new Date().toISOString(),
  };
}

async function readJobs(): Promise<ShortsJob[]> {
  if (cloudMode()) {
    const snap = await store().doc(SHORTS_INDEX).get();
    const parsed = snap.data()?.jobs as Partial<ShortsJob>[] | undefined;
    return Array.isArray(parsed) ? parsed.map(normalizeJob) : [];
  }
  try {
    const raw = await readFile(indexPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<ShortsJob>[];
    return Array.isArray(parsed) ? parsed.map(normalizeJob) : [];
  } catch {
    return [];
  }
}

async function writeJobs(jobs: ShortsJob[]): Promise<void> {
  const byRecent = (a: ShortsJob, b: ShortsJob) =>
    b.updatedAt.localeCompare(a.updatedAt);
  const done = jobs.filter((job) => job.status === "done").sort(byRecent);
  const rest = jobs.filter((job) => job.status !== "done").sort(byRecent);
  const kept = [...done, ...rest].slice(0, MAX_JOBS);
  if (cloudMode()) {
    await store().doc(SHORTS_INDEX).set({ jobs: JSON.parse(JSON.stringify(kept)) });
    return;
  }
  await mkdir(shortsRoot(), { recursive: true });
  await writeFile(indexPath(), JSON.stringify(kept, null, 2), "utf8");
}

export async function listShortsJobs(): Promise<ShortsJob[]> {
  const jobs = await readJobs();
  return jobs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getShortsJob(id: string): Promise<ShortsJob | undefined> {
  assertJobId(id);
  return (await readJobs()).find((job) => job.id === id);
}

export async function createShortsJob(input: {
  filename: string;
  mimeType: string;
  durationSec: number;
}): Promise<ShortsJob> {
  const now = new Date().toISOString();
  const job: ShortsJob = {
    id: newId("shorts"),
    filename: input.filename,
    mimeType: input.mimeType,
    durationSec: input.durationSec,
    status: "uploaded",
    title: "",
    script: "",
    scriptAlt: "",
    hook: "",
    hookType: "",
    voiceId: "",
    createdAt: now,
    updatedAt: now,
  };
  await mkdir(jobDir(job.id), { recursive: true });
  const jobs = await readJobs();
  jobs.push(job);
  await writeJobs(jobs);
  return job;
}

export async function deleteShortsJob(id: string): Promise<void> {
  assertJobId(id);
  const jobs = (await readJobs()).filter((job) => job.id !== id);
  await writeJobs(jobs);
  await deleteJobAssets(id, jobDir(id)).catch(() => undefined);
}

export async function updateShortsJob(
  id: string,
  patch: Partial<ShortsJob>,
): Promise<ShortsJob> {
  assertJobId(id);
  const jobs = await readJobs();
  const index = jobs.findIndex((job) => job.id === id);
  if (index < 0) throw new Error("작업을 찾지 못했습니다.");
  const next = {
    ...jobs[index],
    ...patch,
    id,
    updatedAt: new Date().toISOString(),
  };
  jobs[index] = next;
  await writeJobs(jobs);
  return next;
}

export function sourcePath(id: string, ext = "mp4"): string {
  return path.join(jobDir(id), `source.${ext}`);
}
