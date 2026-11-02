import type { Settings, SocialChannel } from "./types";

const IG_GRAPH = "https://graph.instagram.com/v21.0";
const THREADS_GRAPH = "https://graph.threads.net/v1.0";

export type RemoteComment = {
  channel: SocialChannel;
  remotePostId: string;
  remoteCommentId: string;
  author: string;
  text: string;
  postHeadline: string;
  createdAt: string;
};

type GraphError = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
};

function graphErrorMessage(data: GraphError, status: number): string {
  const message = (data.error?.message || "").trim();
  const code = data.error?.code;
  if (/API access blocked/i.test(message)) {
    return "Meta가 앱 API를 막았습니다. 개발자 계정 본인 확인 후 인스타·스레드 토큰을 다시 만들어 주세요.";
  }
  if (
    code === 10 ||
    /content publish|threads_content_publish|instagram_business_content_publish|not been authorized|does not have permission/i.test(
      message,
    )
  ) {
    return "글 올리기 권한이 없습니다. Meta 앱에 콘텐츠 게시 권한을 넣고 토큰을 다시 만들어 주세요.";
  }
  if (code === 200) {
    return "Meta가 앱 API를 막았습니다. 개발자 계정 본인 확인 후 인스타·스레드 토큰을 다시 만들어 주세요.";
  }
  return message || `Meta API ${status}`;
}

async function graphGet<T>(url: string, token: string): Promise<T> {
  const target = new URL(url);
  target.searchParams.set("access_token", token);
  const res = await fetch(target);
  const data = (await res.json()) as T & GraphError;
  if (!res.ok || data.error) {
    throw new Error(graphErrorMessage(data, res.status));
  }
  return data;
}

async function graphPost<T>(url: string, token: string, body: Record<string, string>): Promise<T> {
  const params = new URLSearchParams({ access_token: token, ...body });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const data = (await res.json()) as T & GraphError;
  if (!res.ok || data.error) {
    throw new Error(graphErrorMessage(data, res.status));
  }
  return data;
}

function instagramToken(settings: Settings): string {
  return (settings.metaAccessToken ?? "").trim();
}

function threadsToken(settings: Settings): string {
  return (settings.threadsAccessToken ?? "").trim();
}

export function hasMetaToken(settings: Settings): boolean {
  return Boolean(instagramToken(settings) || threadsToken(settings));
}

export function hasChannelToken(settings: Settings, channel: SocialChannel): boolean {
  return channel === "threads"
    ? Boolean(threadsToken(settings))
    : Boolean(instagramToken(settings));
}

function clipCopy(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 420);
}

export async function fetchRecentFeedCopy(
  settings: Settings,
  channel: SocialChannel,
): Promise<string[]> {
  try {
    if (channel === "instagram") {
      const token = instagramToken(settings);
      const userId = (settings.instagramUserId || "").trim();
      if (!token || !userId) return [];
      const media = await graphGet<{ data?: Array<{ caption?: string }> }>(
        `${IG_GRAPH}/${userId}/media?fields=caption&limit=8`,
        token,
      );
      return (media.data ?? [])
        .map((item) => clipCopy(item.caption ?? ""))
        .filter(Boolean)
        .slice(0, 4);
    }
    const token = threadsToken(settings);
    const userId = (settings.threadsUserId || "").trim();
    if (!token || !userId) return [];
    const posts = await graphGet<{ data?: Array<{ text?: string }> }>(
      `${THREADS_GRAPH}/${userId}/threads?fields=text&limit=8`,
      token,
    );
    return (posts.data ?? [])
      .map((item) => clipCopy(item.text ?? ""))
      .filter(Boolean)
      .slice(0, 4);
  } catch {
    return [];
  }
}

export async function fetchRemoteComments(
  settings: Settings,
  channel?: SocialChannel,
): Promise<{ comments: RemoteComment[]; errors: string[] }> {
  const comments: RemoteComment[] = [];
  const errors: string[] = [];

  if (!channel || channel === "instagram") {
    const token = instagramToken(settings);
    const userId = (settings.instagramUserId || "").trim();
    if (!token) errors.push("인스타그램 액세스 토큰이 없습니다.");
    else if (!userId) errors.push("인스타그램 사용자 ID가 없습니다.");
    else {
      try {
        comments.push(...(await fetchInstagramComments(token, userId)));
      } catch (error) {
        errors.push(
          error instanceof Error ? `인스타: ${error.message}` : "인스타 댓글을 못 가져왔습니다.",
        );
      }
    }
  }

  if (!channel || channel === "threads") {
    const token = threadsToken(settings);
    const userId = (settings.threadsUserId || "").trim();
    if (!token) errors.push("스레드 액세스 토큰이 없습니다.");
    else if (!userId) errors.push("스레드 사용자 ID가 없습니다.");
    else {
      try {
        comments.push(...(await fetchThreadsReplies(token, userId)));
      } catch (error) {
        errors.push(
          error instanceof Error ? `스레드: ${error.message}` : "스레드 댓글을 못 가져왔습니다.",
        );
      }
    }
  }

  return { comments, errors };
}

async function fetchInstagramComments(
  token: string,
  userId: string,
): Promise<RemoteComment[]> {
  const media = await graphGet<{ data?: Array<{ id: string; caption?: string }> }>(
    `${IG_GRAPH}/${userId}/media?fields=id,caption&limit=12`,
    token,
  );
  const rows: RemoteComment[] = [];
  for (const post of media.data ?? []) {
    const comments = await graphGet<{
      data?: Array<{
        id: string;
        text?: string;
        username?: string;
        timestamp?: string;
        from?: { username?: string };
      }>;
    }>(`${IG_GRAPH}/${post.id}/comments?fields=id,text,username,timestamp,from&limit=50`, token);
    for (const item of comments.data ?? []) {
      const text = (item.text ?? "").trim();
      if (!text) continue;
      rows.push({
        channel: "instagram",
        remotePostId: post.id,
        remoteCommentId: item.id,
        author: item.username || item.from?.username || "",
        text,
        postHeadline: (post.caption ?? "").split("\n")[0] ?? "",
        createdAt: item.timestamp || new Date().toISOString(),
      });
    }
  }
  return rows;
}

async function fetchThreadsReplies(
  token: string,
  userId: string,
): Promise<RemoteComment[]> {
  const posts = await graphGet<{ data?: Array<{ id: string; text?: string }> }>(
    `${THREADS_GRAPH}/${userId}/threads?fields=id,text&limit=12`,
    token,
  );
  const rows: RemoteComment[] = [];
  for (const post of posts.data ?? []) {
    const replies = await graphGet<{
      data?: Array<{
        id: string;
        text?: string;
        username?: string;
        timestamp?: string;
      }>;
    }>(`${THREADS_GRAPH}/${post.id}/replies?fields=id,text,username,timestamp&limit=50`, token);
    for (const item of replies.data ?? []) {
      const text = (item.text ?? "").trim();
      if (!text) continue;
      rows.push({
        channel: "threads",
        remotePostId: post.id,
        remoteCommentId: item.id,
        author: item.username || "",
        text,
        postHeadline: (post.text ?? "").split("\n")[0] ?? "",
        createdAt: item.timestamp || new Date().toISOString(),
      });
    }
  }
  return rows;
}

export async function sendRemoteReply(input: {
  settings: Settings;
  channel: SocialChannel;
  remoteCommentId: string;
  reply: string;
}): Promise<string> {
  const text = input.reply.trim();
  if (!text) throw new Error("답신 문장이 없습니다.");

  if (input.channel === "instagram") {
    const token = instagramToken(input.settings);
    if (!token) throw new Error("인스타그램 액세스 토큰이 없습니다.");
    const data = await graphPost<{ id?: string }>(
      `${IG_GRAPH}/${input.remoteCommentId}/replies`,
      token,
      { message: text },
    );
    if (!data.id) throw new Error("인스타 답신을 보내지 못했습니다.");
    return data.id;
  }

  const token = threadsToken(input.settings);
  if (!token) throw new Error("스레드 액세스 토큰이 없습니다.");
  const userId = (input.settings.threadsUserId || "").trim();
  if (!userId) throw new Error("스레드 사용자 ID가 없습니다.");
  const created = await graphPost<{ id?: string }>(
    `${THREADS_GRAPH}/${userId}/threads`,
    token,
    {
      media_type: "TEXT",
      text,
      reply_to_id: input.remoteCommentId,
    },
  );
  if (!created.id) throw new Error("스레드 답신 초안을 만들지 못했습니다.");
  const published = await graphPost<{ id?: string }>(
    `${THREADS_GRAPH}/${userId}/threads_publish`,
    token,
    { creation_id: created.id },
  );
  return published.id || created.id;
}

export type ChannelPing = {
  ok: boolean;
  userId: string;
  username: string;
  error: string;
};

export async function pingChannelMe(
  settings: Settings,
  channel: SocialChannel,
): Promise<ChannelPing> {
  const token =
    channel === "threads" ? threadsToken(settings) : instagramToken(settings);
  const label = channel === "threads" ? "스레드" : "인스타그램";
  if (!token) {
    return {
      ok: false,
      userId: "",
      username: "",
      error: `${label} 액세스 토큰이 없습니다.`,
    };
  }
  const url =
    channel === "threads"
      ? `${THREADS_GRAPH}/me?fields=id,username`
      : `${IG_GRAPH}/me?fields=id,username`;
  try {
    const data = await graphGet<{ id?: string; username?: string }>(url, token);
    return {
      ok: true,
      userId: data.id ?? "",
      username: data.username ?? "",
      error: "",
    };
  } catch (error) {
    return {
      ok: false,
      userId: "",
      username: "",
      error:
        error instanceof Error
          ? error.message
          : `${label} 토큰을 확인하지 못했습니다.`,
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForInstagramContainer(id: string, token: string): Promise<void> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const data = await graphGet<{ status_code?: string }>(
      `${IG_GRAPH}/${id}?fields=status_code`,
      token,
    );
    if (data.status_code === "FINISHED") return;
    if (data.status_code === "ERROR" || data.status_code === "EXPIRED") {
      throw new Error("인스타 카드 업로드가 실패했습니다.");
    }
    await sleep(2000);
  }
  throw new Error("인스타 카드 업로드가 너무 오래 걸렸습니다.");
}

export async function publishInstagramImage(input: {
  settings: Settings;
  imageUrl: string;
  caption: string;
}): Promise<string> {
  const token = instagramToken(input.settings);
  const userId = (input.settings.instagramUserId || "").trim();
  if (!token) throw new Error("인스타그램 액세스 토큰이 없습니다.");
  if (!userId) throw new Error("인스타그램 사용자 ID가 없습니다.");
  const created = await graphPost<{ id?: string }>(
    `${IG_GRAPH}/${userId}/media`,
    token,
    {
      image_url: input.imageUrl,
      caption: input.caption,
    },
  );
  if (!created.id) throw new Error("인스타 게시 초안을 만들지 못했습니다.");
  await waitForInstagramContainer(created.id, token);
  const published = await graphPost<{ id?: string }>(
    `${IG_GRAPH}/${userId}/media_publish`,
    token,
    { creation_id: created.id },
  );
  return published.id || created.id;
}

export async function publishThreadsText(input: {
  settings: Settings;
  text: string;
}): Promise<string> {
  const token = threadsToken(input.settings);
  const userId = (input.settings.threadsUserId || "").trim();
  if (!token) throw new Error("스레드 액세스 토큰이 없습니다.");
  if (!userId) throw new Error("스레드 사용자 ID가 없습니다.");
  const text = input.text.trim();
  if (!text) throw new Error("스레드에 올릴 본문이 없습니다.");
  const created = await graphPost<{ id?: string }>(
    `${THREADS_GRAPH}/${userId}/threads`,
    token,
    {
      media_type: "TEXT",
      text: text.slice(0, 500),
    },
  );
  if (!created.id) throw new Error("스레드 초안을 만들지 못했습니다.");
  const published = await graphPost<{ id?: string }>(
    `${THREADS_GRAPH}/${userId}/threads_publish`,
    token,
    { creation_id: created.id },
  );
  return published.id || created.id;
}
