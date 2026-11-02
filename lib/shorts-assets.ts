import { existsSync, statSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { getStorage } from "firebase-admin/storage";
import { cloudProjectId, store } from "./db";

const ASSET_NAMES = [
  "source.mp4",
  "source.webm",
  "source.mov",
  "source.m4v",
  "voice.mp3",
  "output.mp4",
];

function isMissingBucket(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    typeof error === "object" && error && "code" in error
      ? Number((error as { code?: number }).code)
      : 0;
  return code === 404 || /specified bucket does not exist/i.test(message);
}

export function storageBucketName(): string | undefined {
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

export async function persistJobAssets(
  id: string,
  dir: string,
  names: string[] = ASSET_NAMES,
): Promise<void> {
  if (!cloudProjectId()) return;
  const remote = bucket();
  if (!remote) {
    throw new Error("영상 저장소가 없습니다. 영상을 다시 올려 주세요.");
  }
  try {
    for (const name of names) {
      const local = path.join(dir, name);
      if (!existsSync(local)) continue;
      const dest = `shorts/${id}/${name}`;
      const file = remote.file(dest);
      if (name !== "output.mp4") {
        const [exists] = await file.exists();
        if (exists) {
          const [meta] = await file.getMetadata();
          if (Number(meta.size) === statSync(local).size) continue;
        }
      }
      await remote.upload(local, {
        destination: dest,
        resumable: false,
        metadata: {
          contentType:
            name.endsWith(".mp3")
              ? "audio/mpeg"
              : name.endsWith(".webm")
                ? "video/webm"
                : "video/mp4",
        },
      });
    }
  } catch (error) {
    if (isMissingBucket(error)) {
      throw new Error("영상 저장소가 없습니다. 영상을 다시 올려 주세요.");
    }
    throw error;
  }
}

export async function hydrateJobAssets(id: string, dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  if (!cloudProjectId()) return;
  const remote = bucket();
  if (!remote) return;
  try {
    const [files] = await remote.getFiles({ prefix: `shorts/${id}/` });
    for (const file of files) {
      const name = path.basename(file.name);
      if (!name || name === id) continue;
      const dest = path.join(dir, name);
      if (!existsSync(dest)) {
        await file.download({ destination: dest });
      }
    }
  } catch (error) {
    if (isMissingBucket(error)) return;
    throw error;
  }
}

export async function deleteJobAssets(id: string, dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
  const remote = bucket();
  if (!remote) return;
  await remote.deleteFiles({ prefix: `shorts/${id}/` }).catch(() => undefined);
}
