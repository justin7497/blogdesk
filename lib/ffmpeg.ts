import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import {
  assFilterArg,
  resolveCaptionFont,
  SHORTS_HEIGHT,
  SHORTS_WIDTH,
} from "./shorts-captions";

function resolveBin(tool: "ffmpeg" | "ffprobe"): string {
  if (tool === "ffmpeg" && process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  if (tool === "ffprobe" && process.env.FFPROBE_PATH) {
    return process.env.FFPROBE_PATH;
  }
  if (tool === "ffmpeg" && existsSync("/usr/bin/ffmpeg")) return "/usr/bin/ffmpeg";
  const packed =
    tool === "ffmpeg"
      ? ffmpegStatic
      : (ffprobeStatic as { path?: string } | undefined)?.path;
  if (packed && existsSync(packed)) return packed;
  return tool;
}

export function runCommand(
  command: string,
  args: string[],
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error((stderr || stdout || `종료 코드 ${code}`).slice(-2500)));
    });
  });
}

export async function probeDuration(filePath: string): Promise<number> {
  const { stdout } = await runCommand(resolveBin("ffprobe"), [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "json",
    filePath,
  ]);
  const parsed = JSON.parse(stdout) as { format?: { duration?: string } };
  const duration = Number(parsed.format?.duration ?? 0);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("영상 길이를 읽지 못했습니다.");
  }
  return duration;
}

export async function probeVideoSize(
  filePath: string,
): Promise<{ width: number; height: number }> {
  const { stdout } = await runCommand(resolveBin("ffprobe"), [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height",
    "-of",
    "json",
    filePath,
  ]);
  const parsed = JSON.parse(stdout) as {
    streams?: { width?: number; height?: number }[];
  };
  const stream = parsed.streams?.[0];
  return {
    width: Number(stream?.width ?? 0),
    height: Number(stream?.height ?? 0),
  };
}

export async function extractFrames(
  videoPath: string,
  outDir: string,
  count = 8,
): Promise<string[]> {
  await mkdir(outDir, { recursive: true });
  const duration = await probeDuration(videoPath);
  const fps = Math.max(1 / (duration / count), 0.1);
  const pattern = path.join(outDir, "frame_%02d.jpg");
  await runCommand(resolveBin("ffmpeg"), [
    "-y",
    "-i",
    videoPath,
    "-vf",
    `fps=${fps.toFixed(4)}`,
    "-vframes",
    String(count),
    "-q:v",
    "4",
    pattern,
  ]);
  const files: string[] = [];
  for (let i = 1; i <= count; i += 1) {
    const file = path.join(outDir, `frame_${String(i).padStart(2, "0")}.jpg`);
    if (existsSync(file)) files.push(file);
  }
  if (files.length === 0) {
    throw new Error("영상 프레임을 추출하지 못했습니다.");
  }
  return files;
}

export async function muxVoiceover(
  videoPath: string,
  audioPath: string,
  outputPath: string,
  captionsPath?: string,
): Promise<{ videoSec: number; audioSec: number }> {
  const videoSec = await probeDuration(videoPath);
  const audioSec = await probeDuration(audioPath);
  const size = await probeVideoSize(videoPath);
  const ratio = audioSec / videoSec;
  const vf: string[] = [];
  if (audioSec > videoSec * 1.12) {
    vf.push(`setpts=${ratio.toFixed(4)}*PTS`);
  }
  if (size.width !== SHORTS_WIDTH || size.height !== SHORTS_HEIGHT) {
    vf.push(
      `scale=${SHORTS_WIDTH}:${SHORTS_HEIGHT}:force_original_aspect_ratio=increase:flags=lanczos`,
      `crop=${SHORTS_WIDTH}:${SHORTS_HEIGHT}`,
      "setsar=1",
    );
  }
  if (captionsPath && existsSync(captionsPath)) {
    const font = resolveCaptionFont();
    vf.push(assFilterArg(captionsPath, font.dir));
  }

  const voLevel =
    "dynaudnorm=f=120:g=15:p=0.95:m=12,acompressor=threshold=0.15:ratio=3:attack=8:release=80,loudnorm=I=-14:TP=-1.5:LRA=8,aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo";
  const args = [
    "-y",
    "-i",
    videoPath,
    "-i",
    audioPath,
    "-filter_complex",
    `[1:a]${voLevel}[a]`,
    "-map",
    "0:v:0",
    "-map",
    "[a]",
  ];
  if (vf.length > 0) {
    args.push("-vf", vf.join(","));
  }
  args.push(
    "-c:v",
    vf.length > 0 ? "libx264" : "copy",
    ...(vf.length > 0
      ? [
          "-preset",
          "veryfast",
          "-threads",
          "0",
          "-crf",
          "18",
          "-profile:v",
          "high",
          "-x264-params",
          "aq-mode=3",
          "-pix_fmt",
          "yuv420p",
        ]
      : []),
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
  );
  if (audioSec <= videoSec && ratio < 0.82) {
    args.push("-t", audioSec.toFixed(3));
  } else {
    args.push("-shortest");
  }
  args.push(outputPath);

  await runCommand(resolveBin("ffmpeg"), args);
  return { videoSec, audioSec };
}
