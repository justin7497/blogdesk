import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getStorage } from "firebase-admin/storage";
import { cloudProjectId, store } from "./db";
import type { InstagramPost } from "./types";

function isMissingBucket(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    typeof error === "object" && error && "code" in error
      ? Number((error as { code?: number }).code)
      : 0;
  return code === 404 || /specified bucket does not exist/i.test(message);
}

function storageBucketName(): string | undefined {
  const fromEnv = process.env.STORAGE_BUCKET?.trim();
  if (fromEnv) return fromEnv;
  const projectId = cloudProjectId();
  if (!projectId) return undefined;
  return `${projectId}-shorts`;
}

function bucket() {
  store();
  const name = storageBucketName();
  if (!name) return null;
  return getStorage().bucket(name);
}

function localDir(id: string): string {
  const root = cloudProjectId()
    ? path.join("/tmp", "instagram")
    : path.join(process.cwd(), "data", "instagram");
  return path.join(root, id);
}

export async function persistInstagramPost(post: InstagramPost): Promise<void> {
  const payload = JSON.stringify(post, null, 2);
  await mkdir(localDir(post.id), { recursive: true });
  await writeFile(path.join(localDir(post.id), "post.json"), payload, "utf8");
  if (!cloudProjectId()) return;
  const remote = bucket();
  if (!remote) {
    throw new Error("콘텐츠 저장소가 없습니다. 게시물을 다시 저장해 주세요.");
  }
  try {
    await remote.file(`instagram/${post.id}/post.json`).save(payload, {
      resumable: false,
      contentType: "application/json; charset=utf-8",
    });
  } catch (error) {
    if (isMissingBucket(error)) {
      throw new Error("콘텐츠 저장소가 없습니다. 게시물을 다시 저장해 주세요.");
    }
    throw error;
  }
}

export async function persistInstagramCard(
  id: string,
  slide: number,
  png: Buffer,
): Promise<void> {
  const name = `slide-${slide + 1}.png`;
  await mkdir(localDir(id), { recursive: true });
  await writeFile(path.join(localDir(id), name), png);
  if (!cloudProjectId()) return;
  const remote = bucket();
  if (!remote) {
    throw new Error("콘텐츠 저장소가 없습니다. 카드를 다시 저장해 주세요.");
  }
  try {
    await remote.file(`instagram/${id}/${name}`).save(png, {
      resumable: false,
      contentType: "image/png",
    });
  } catch (error) {
    if (isMissingBucket(error)) {
      throw new Error("콘텐츠 저장소가 없습니다. 카드를 다시 저장해 주세요.");
    }
    throw error;
  }
}

const PUBLIC_ORIGIN =
  process.env.SOCIAL_PUBLIC_ORIGIN?.trim() || "https://blogdesk-ljh.web.app";

export function instagramCardPublicUrl(id: string): string {
  return `${PUBLIC_ORIGIN.replace(/\/$/, "")}/api/instagram/${encodeURIComponent(id)}/card`;
}

export async function persistAndSignInstagramCard(
  id: string,
  slide: number,
  png: Buffer,
): Promise<string> {
  await persistInstagramCard(id, slide, png);
  return instagramCardPublicUrl(id);
}
