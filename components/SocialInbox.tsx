"use client";

import { useCallback, useEffect, useState } from "react";
import { copyText } from "@/lib/clipboard";
import {
  COMMENT_KIND_LABEL,
  COMMENT_STATUS_LABEL,
} from "@/lib/social-comment-labels";
import type { ClientSettings, SocialChannel, SocialComment } from "@/lib/types";

async function readApi<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || `요청 실패 (${res.status})`);
  return data;
}

const CHANNEL_LABEL: Record<SocialChannel, string> = {
  instagram: "인스타그램",
  threads: "스레드",
};

export function SocialInbox({
  settings,
  channel,
}: {
  settings: ClientSettings;
  channel: SocialChannel;
}) {
  const [comments, setComments] = useState<SocialComment[]>([]);
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState("");
  const hasToken =
    channel === "threads" ? settings.hasThreadsToken : settings.hasMetaToken;
  const reviewCount = comments.filter((item) => item.status === "review").length;
  const failedCount = comments.filter((item) => item.status === "failed").length;
  const ordered = [...comments].sort((a, b) => {
    const rank: Record<string, number> = {
      review: 0,
      failed: 1,
      queued: 2,
      ready: 3,
      sent: 4,
      skipped: 5,
    };
    return (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
  });

  const refresh = useCallback(async () => {
    const data = await readApi<{ comments: SocialComment[] }>(
      `/api/instagram/comments?channel=${channel}`,
    );
    setComments(data.comments);
  }, [channel]);

  const sync = useCallback(async () => {
    const data = await readApi<{
      imported: number;
      sent: number;
      ready: number;
      errors: string[];
      missingToken: boolean;
    }>("/api/instagram/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync", channel }),
    });
    if (data.missingToken) {
      setNote(
        "Meta 토큰이 없어 댓글은 직접 붙여 넣습니다. 공감·투표 댓글은 15~40분 뒤 자동 답신 초안이 됩니다.",
      );
    } else {
      setNote(
        `가져온 댓글 ${data.imported} · 보낸 답신 ${data.sent} · 복사용 ${data.ready}${
          data.errors[0] ? ` · ${data.errors[0]}` : ""
        }`,
      );
    }
    await refresh();
  }, [channel, refresh]);

  useEffect(() => {
    void refresh().catch((err) => {
      setError(err instanceof Error ? err.message : "댓글을 불러오지 못했습니다.");
    });
  }, [refresh]);

  useEffect(() => {
    void sync().catch((err) => {
      setError(err instanceof Error ? err.message : "댓글 자동 처리에 실패했습니다.");
    });
    const timer = window.setInterval(() => {
      void sync().catch(() => undefined);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [sync]);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "실패했습니다.");
    } finally {
      setBusy("");
    }
  }

  function updateLocal(id: string, patch: Partial<SocialComment>) {
    setComments((rows) =>
      rows.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  return (
    <section className="panel" style={{ marginTop: 16 }}>
      <div className="shorts-archive-head">
          <label style={{ margin: 0 }}>
            댓글 자동 답신
            {reviewCount > 0 ? ` · 확인 필요 ${reviewCount}` : ""}
            {failedCount > 0 ? ` · 실패 ${failedCount}` : ""}
          </label>
        <button
          className="btn ghost"
          type="button"
          disabled={Boolean(busy)}
          onClick={() => void run("댓글 확인 중…", sync)}
        >
          댓글 가져오기
        </button>
      </div>
      <p className="muted" style={{ margin: "0 0 10px" }}>
        {CHANNEL_LABEL[channel]} 공감·투표 댓글은 15~40분 뒤 소연 말투로 답합니다. 상품
        질문과 스팸은 자동으로 보내지 않습니다.
        {settings.socialAutoReply === false ? " 지금 설정에서 자동 답신이 꺼져 있습니다." : ""}
      </p>
      {!hasToken ? (
        <p className="muted">
          실제 계정에서 가져오려면 설정에 Meta 액세스 토큰과{" "}
          {channel === "threads" ? "스레드" : "인스타그램"} 사용자 ID를 넣으세요.
        </p>
      ) : null}

      <div className="field">
        <label>댓글 붙여넣기</label>
        <textarea
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder="공감해 ㅋㅋ / 집에서 충전"
          disabled={Boolean(busy)}
        />
      </div>
      <button
        className="btn ghost"
        type="button"
        disabled={Boolean(busy) || !paste.trim()}
        onClick={() =>
          void run("답신 만드는 중…", async () => {
            await readApi("/api/instagram/comments", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "add",
                channel,
                text: paste,
              }),
            });
            setPaste("");
            await refresh();
          })
        }
      >
        붙여넣은 댓글에 답신 만들기
      </button>

      {comments.length === 0 ? (
        <p className="muted" style={{ marginTop: 12 }}>
          아직 {CHANNEL_LABEL[channel]} 댓글이 없습니다.
        </p>
      ) : (
        <ul className="ig-comment-list">
          {ordered.map((item) => (
            <li key={item.id}>
              <div className="ig-comment-head">
                <b>
                  {item.author || "익명"} · {COMMENT_KIND_LABEL[item.kind]}
                </b>
                <span className={`pill ${item.status}`}>
                  {COMMENT_STATUS_LABEL[item.status]}
                </span>
              </div>
              <p>{item.text}</p>
              {item.postHeadline ? (
                <p className="muted">원글 · {item.postHeadline}</p>
              ) : null}
              <textarea
                value={item.reply}
                onChange={(e) => updateLocal(item.id, { reply: e.target.value })}
                placeholder="답신"
                disabled={Boolean(busy) || item.status === "sent" || item.status === "skipped"}
              />
              {item.error ? <p className="error">{item.error}</p> : null}
              {item.status === "queued" && item.replyAfter ? (
                <p className="muted">
                  {new Date(item.replyAfter).toLocaleString("ko-KR")} 이후 자동 발송
                </p>
              ) : null}
              {item.status === "failed" && item.replyAfter && (item.retryCount ?? 0) < 4 ? (
                <p className="muted">
                  {new Date(item.replyAfter).toLocaleString("ko-KR")} 이후 다시 보냅니다.
                </p>
              ) : null}
              <div className="actions" style={{ justifyContent: "flex-start" }}>
                {item.status !== "sent" && item.status !== "skipped" ? (
                  <>
                    <button
                      className="btn secondary"
                      type="button"
                      disabled={Boolean(busy) || !item.reply.trim()}
                      onClick={() =>
                        void run("답신 처리 중…", async () => {
                          const data = await readApi<{ comment: SocialComment }>(
                            `/api/instagram/comments/${item.id}`,
                            {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                action: "send",
                                reply: item.reply,
                              }),
                            },
                          );
                          updateLocal(item.id, data.comment);
                          if (data.comment.status === "ready" || !hasToken) {
                            await copyText(data.comment.reply);
                            setCopied("답신을 복사했습니다.");
                            setTimeout(() => setCopied(""), 1600);
                          }
                        })
                      }
                    >
                      {hasToken && item.source === "meta"
                        ? "지금 보내기"
                        : "답신 복사"}
                    </button>
                    <button
                      className="btn ghost"
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        void run("건너뛰는 중…", async () => {
                          const data = await readApi<{ comment: SocialComment }>(
                            `/api/instagram/comments/${item.id}`,
                            {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ action: "skip" }),
                            },
                          );
                          updateLocal(item.id, data.comment);
                        })
                      }
                    >
                      건너뛰기
                    </button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      {busy ? <p className="muted">{busy}</p> : null}
      {note ? <p className="muted">{note}</p> : null}
      {copied ? <p className="muted">{copied}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
