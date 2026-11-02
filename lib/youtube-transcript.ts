export type YoutubeCaptionCue = {
  startMs: number;
  text: string;
};

export type YoutubeTranscript = {
  videoId: string;
  title: string;
  language: string;
  text: string;
  cues: YoutubeCaptionCue[];
};

const ID_RE = /^[a-zA-Z0-9_-]{11}$/;

export function extractYoutubeId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (ID_RE.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0] || "";
      return ID_RE.test(id) ? id : null;
    }
    if (host === "youtube.com" || host.endsWith(".youtube.com")) {
      const fromQuery = url.searchParams.get("v") || "";
      if (ID_RE.test(fromQuery)) return fromQuery;
      const match = url.pathname.match(
        /\/(?:shorts|embed|live|v)\/([a-zA-Z0-9_-]{11})/,
      );
      if (match?.[1]) return match[1];
    }
  } catch {
    return null;
  }
  return null;
}

function decodeEntities(text: string): string {
  return text
    .replace(/\\n/g, "\n")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)))
    .replace(/\s+/g, " ")
    .trim();
}

function cuesToText(cues: YoutubeCaptionCue[]): string {
  return cues
    .map((cue) => cue.text.trim())
    .filter(Boolean)
    .join("\n");
}

function parseJson3(raw: string): YoutubeCaptionCue[] {
  const data = JSON.parse(raw) as {
    events?: { tStartMs?: number; segs?: { utf8?: string }[] }[];
  };
  const cues: YoutubeCaptionCue[] = [];
  for (const event of data.events ?? []) {
    const text = decodeEntities(
      (event.segs ?? []).map((seg) => seg.utf8 || "").join(""),
    );
    if (!text) continue;
    cues.push({ startMs: Number(event.tStartMs) || 0, text });
  }
  return cues;
}

function parseTimedTextXml(raw: string): YoutubeCaptionCue[] {
  const cues: YoutubeCaptionCue[] = [];
  const pattern = /<text\b([^>]*)>([\s\S]*?)<\/text>/gi;
  let match: RegExpExecArray | null = pattern.exec(raw);
  while (match) {
    const attrs = match[1] || "";
    const start = Number(
      /(?:start|t)="([\d.]+)"/i.exec(attrs)?.[1] ?? 0,
    );
    const startMs = start > 1000 ? start : Math.round(start * 1000);
    const text = decodeEntities(
      (match[2] || "").replace(/<[^>]+>/g, " "),
    );
    if (text) cues.push({ startMs, text });
    match = pattern.exec(raw);
  }
  return cues;
}

type CaptionTrack = {
  baseUrl?: string;
  languageCode?: string;
  kind?: string;
  name?: { simpleText?: string };
};

function pickTrack(tracks: CaptionTrack[]): CaptionTrack | undefined {
  const scored = tracks
    .filter((track) => track.baseUrl)
    .map((track) => {
      const lang = (track.languageCode || "").toLowerCase();
      let score = 0;
      if (lang === "ko" || lang.startsWith("ko-")) score += 40;
      if (track.kind !== "asr") score += 10;
      if (lang === "en" || lang.startsWith("en-")) score += 5;
      return { track, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0]?.track;
}

async function fetchCaption(baseUrl: string): Promise<YoutubeCaptionCue[]> {
  const url = new URL(baseUrl.replace(/&amp;/g, "&"));
  url.searchParams.set("fmt", "json3");
  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept-Language": "ko,en;q=0.8",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`자막을 읽지 못했습니다. (${res.status})`);
  }
  const raw = await res.text();
  if (raw.trim().startsWith("{")) {
    const cues = parseJson3(raw);
    if (cues.length) return cues;
  }
  return parseTimedTextXml(raw);
}

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function extractJsonObject(source: string, marker: string): unknown | null {
  const start = source.indexOf(marker);
  if (start < 0) return null;
  const jsonStart = source.indexOf("{", start);
  if (jsonStart < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = jsonStart; i < source.length; i += 1) {
    const ch = source[i]!;
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(source.slice(jsonStart, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

type PlayerPayload = {
  videoDetails?: { title?: string };
  playabilityStatus?: { status?: string; reason?: string };
  captions?: {
    playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] };
  };
};

function playerFromPayload(data: PlayerPayload | null): {
  title: string;
  tracks: CaptionTrack[];
} | null {
  if (!data) return null;
  const tracks =
    data.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  if (tracks.length === 0) return null;
  return { title: data.videoDetails?.title?.trim() || "", tracks };
}

async function watchPagePlayer(videoId: string): Promise<{
  title: string;
  tracks: CaptionTrack[];
} | null> {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=ko`, {
    headers: {
      "User-Agent": BROWSER_UA,
      "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const html = await res.text();
  const data = extractJsonObject(
    html,
    "ytInitialPlayerResponse",
  ) as PlayerPayload | null;
  return playerFromPayload(data);
}

async function innertubePlayer(videoId: string): Promise<{
  title: string;
  tracks: CaptionTrack[];
}> {
  const clients = [
    {
      clientName: "ANDROID",
      clientVersion: "20.10.38",
      userAgent:
        "com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip",
    },
    {
      clientName: "MWEB",
      clientVersion: "2.20250401.00.00",
      userAgent: BROWSER_UA,
    },
    {
      clientName: "WEB",
      clientVersion: "2.20250401.00.00",
      userAgent: BROWSER_UA,
    },
  ];
  let lastError = "영상을 찾지 못했습니다.";
  for (const client of clients) {
    const res = await fetch(
      "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": client.userAgent,
          "Accept-Language": "ko,en;q=0.8",
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: client.clientName,
              clientVersion: client.clientVersion,
              hl: "ko",
              gl: "KR",
            },
          },
          videoId,
        }),
        cache: "no-store",
      },
    );
    if (!res.ok) {
      lastError = `유튜브 응답 오류 (${res.status})`;
      continue;
    }
    const data = (await res.json()) as PlayerPayload;
    const parsed = playerFromPayload(data);
    if (parsed) return parsed;
    if (data.playabilityStatus?.status && data.playabilityStatus.status !== "OK") {
      lastError = data.playabilityStatus.reason || "이 영상은 재생할 수 없습니다.";
    } else {
      lastError = "이 영상에는 자막이 없습니다.";
    }
  }
  const fromWatch = await watchPagePlayer(videoId);
  if (fromWatch) return fromWatch;
  throw new Error(lastError);
}

export async function fetchYoutubeTranscript(
  input: string,
): Promise<YoutubeTranscript> {
  const videoId = extractYoutubeId(input);
  if (!videoId) throw new Error("유튜브 주소가 올바르지 않습니다.");
  const player = await innertubePlayer(videoId);
  const track = pickTrack(player.tracks);
  if (!track?.baseUrl) throw new Error("이 영상에는 자막이 없습니다.");
  const cues = await fetchCaption(track.baseUrl);
  if (cues.length === 0) throw new Error("자막 내용을 비웠습니다.");
  return {
    videoId,
    title: player.title || videoId,
    language: track.languageCode || "",
    text: cuesToText(cues),
    cues,
  };
}
