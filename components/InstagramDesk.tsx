"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PushNotifyButton } from "@/components/PushNotifyButton";
import { SocialInbox } from "@/components/SocialInbox";
import { copyText } from "@/lib/clipboard";
import { downloadCardPng } from "@/lib/instagram-card-draw";
import {
  captionForCopy,
  emptySlide,
  INSTAGRAM_STATUS_LABEL,
  normalizeSlide,
} from "@/lib/instagram-card";
import {
  isDueForPost,
  slotLabel,
  upcomingSocialSlots,
  type SocialSlot,
} from "@/lib/instagram-schedule";
import {
  accountLabel,
  instagramProfileUrl,
  threadsProfileUrl,
} from "@/lib/social-account";
import type {
  ClientSettings,
  InstagramPost,
  InstagramPostStatus,
  InstagramSlide,
  SocialChannel,
} from "@/lib/types";

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

function formatWhen(value: string): string {
  if (!value) return "일정 없음";
  return value.replace("T", " ");
}

function firstSlide(post: InstagramPost | null): InstagramSlide {
  return post?.slides[0] ? normalizeSlide(post.slides[0]) : emptySlide();
}

function copyNeedsRewrite(
  post: InstagramPost | null,
  channel: SocialChannel,
): boolean {
  if (!post) return true;
  if (channel === "threads") return !post.caption.trim();
  const slide = firstSlide(post);
  return !slide.dialogues.some((row) => row.line.trim()) || !slide.punch.trim();
}

function previewHeadline(text: string): string {
  const source = text.trim();
  const comma = source.search(/[,，]/);
  if (comma > 0 && comma < source.length - 1) {
    return `${source.slice(0, comma + 1).trim()}\n${source.slice(comma + 1).trim()}`;
  }
  return source;
}

export function InstagramDesk({
  settings,
  channel,
}: {
  settings: ClientSettings;
  channel: SocialChannel;
}) {
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [post, setPost] = useState<InstagramPost | null>(null);
  const [topic, setTopic] = useState("");
  const [brief, setBrief] = useState("");
  const [filter, setFilter] = useState<InstagramPostStatus | "all">("all");
  const [changeNote, setChangeNote] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [slots, setSlots] = useState<SocialSlot[]>([]);
  const [produceNote, setProduceNote] = useState("");
  const blankEditor = useRef(false);
  const autoWrote = useRef("");

  const refresh = useCallback(async () => {
    const data = await readApi<{ posts: InstagramPost[] }>(
      `/api/instagram?channel=${channel}`,
    );
    setPosts(data.posts);
    setPost((current) => {
      if (current) {
        const found = data.posts.find((item) => item.id === current.id);
        if (found) return found;
        if (blankEditor.current) return current;
      }
      if (blankEditor.current) return null;
      const upcoming = upcomingSocialSlots().filter(
        (item) => item.channel === channel,
      );
      for (const slot of upcoming) {
        const filled = data.posts.find((item) => item.slotKey === slot.key);
        if (filled) return filled;
      }
      return data.posts[0] ?? null;
    });
  }, [channel]);

  const produce = useCallback(async () => {
    const data = await readApi<{
      created: InstagramPost[];
      skipped: { key: string }[];
      purged?: InstagramPost[];
      missingKey: boolean;
    }>("/api/instagram/produce", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days: 2 }),
    });
    const made = data.created.filter((item) => item.channel === channel);
    const gone = (data.purged ?? []).filter((item) => item.channel === channel);
    const notes: string[] = [];
    if (data.missingKey) {
      notes.push("OpenAI 키가 없어 슬롯 초안만 넣었습니다. 설정에 키를 넣으면 본문이 채워집니다.");
    } else if (made.length > 0) {
      notes.push(`${CHANNEL_LABEL[channel]} ${made.length}편을 자동으로 만들었습니다.`);
    } else {
      notes.push("앞으로 이틀 슬롯은 이미 채워져 있습니다.");
    }
    if (gone.length > 0) {
      notes.push(`시간이 지난 미게시 ${gone.length}편을 지웠습니다.`);
    }
    setProduceNote(notes.join(" "));
    await refresh();
  }, [channel, refresh]);

  useEffect(() => {
    setPost(null);
    setTopic("");
    setBrief("");
    setChangeNote("");
    blankEditor.current = false;
    setProduceNote("");
    setSlots(upcomingSocialSlots().filter((item) => item.channel === channel));
  }, [channel]);

  useEffect(() => {
    void refresh().catch((err) => {
      setError(err instanceof Error ? err.message : "목록을 불러오지 못했습니다.");
    });
  }, [channel, refresh]);

  useEffect(() => {
    void run("이틀치 글을 만드는 중…", produce);
  }, [produce]);

  useEffect(() => {
    if (!post || !settings.hasOpenAI || Boolean(busy)) return;
    if (!copyNeedsRewrite(post, channel) || autoWrote.current === post.id) return;
    autoWrote.current = post.id;
    void run("혼잣말 쓰는 중…", () => writeCopy(post));
  }, [busy, channel, post, settings.hasOpenAI]);

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

  const visible = useMemo(() => {
    const rows = filter === "all" ? posts : posts.filter((item) => item.status === filter);
    return [...rows].sort((a, b) =>
      (a.scheduledFor || a.createdAt).localeCompare(b.scheduledFor || b.createdAt),
    );
  }, [filter, posts]);

  function setSlide(patch: Partial<InstagramSlide>) {
    if (!post) return;
    const current = firstSlide(post);
    setPost({
      ...post,
      headline: patch.headline ?? post.headline,
      slides: [normalizeSlide({ ...current, ...patch })],
    });
  }

  async function writeCopy(
    target: InstagramPost,
    nextTopic = target.topic,
    nextBrief = target.brief,
  ) {
    const data = await readApi<{ post: InstagramPost }>("/api/instagram/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: target.id,
        channel: target.channel,
        topic: nextTopic,
        brief: nextBrief,
        slotKey: target.slotKey,
      }),
    });
    blankEditor.current = false;
    setPost(data.post);
    await refresh();
  }

  async function makeHere() {
    const slot =
      slots.find((row) => !posts.some((item) => item.slotKey === row.key)) ??
      slots[0];
    const nextTopic = (post ? post.topic : topic).trim() || slot?.topic || "";
    const nextBrief = post ? post.brief : brief;
    let target = post;
    if (!target) {
      const created = await readApi<{ post: InstagramPost }>("/api/instagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          topic: nextTopic,
          brief: nextBrief,
          slotKey: blankEditor.current ? undefined : slot?.key,
          scheduledFor: blankEditor.current ? undefined : slot?.scheduledFor,
        }),
      });
      target = created.post;
      setPost(target);
    }
    if (!settings.hasOpenAI) {
      await refresh();
      return;
    }
    if (!target) return;
    await writeCopy(target, nextTopic, nextBrief);
  }

  const preview = firstSlide(post);
  const handle =
    channel === "threads"
      ? settings.threadsUsername
      : settings.instagramUsername;
  const profileUrl =
    channel === "threads"
      ? threadsProfileUrl(handle)
      : instagramProfileUrl(handle);
  const brand = `@${handle}`;
  const hasToken =
    channel === "threads" ? settings.hasThreadsToken : settings.hasMetaToken;
  const tokenOk =
    channel === "threads" ? settings.threadsTokenOk : settings.instagramTokenOk;
  const tokenError =
    channel === "threads" ? settings.threadsTokenError : settings.instagramTokenError;
  const duePosts = posts.filter(
    (item) =>
      (item.status === "approved" || item.status === "draft") &&
      isDueForPost(item.scheduledFor),
  );
  const tokenPill =
    !hasToken
      ? { className: "pill failed", label: "미연결" }
      : tokenOk === false
        ? { className: "pill failed", label: "토큰 확인 필요" }
        : { className: "pill ok", label: "연결됨" };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{CHANNEL_LABEL[channel]}</h1>
          <p>
            {accountLabel(settings.socialDisplayName, handle)} 계정으로 「퇴근 후 혼잣말」을
            여기서 만듭니다.{" "}
            {channel === "threads"
              ? "스레드는 카드 없이 글만 올립니다."
              : "인스타는 기존 피드와 같은 크림 카드 1장입니다."}{" "}
            ChatGPT에 붙여 넣지 않아도 됩니다.
          </p>
        </div>
        <button
          className="btn secondary"
          type="button"
          disabled={Boolean(busy)}
          onClick={() => {
            blankEditor.current = true;
            setPost(null);
            setTopic("");
            setBrief("");
            setChangeNote("");
          }}
        >
          새로 만들기
        </button>
      </div>

      <section className="panel" style={{ marginBottom: 16 }}>
        <div className="shorts-archive-head">
          <label style={{ margin: 0 }}>계정 연동</label>
          <span className={tokenPill.className}>{tokenPill.label}</span>
        </div>
        <p className="muted" style={{ margin: "0 0 8px" }}>
          {settings.socialDisplayName} · @{handle}
          {settings.socialBio ? ` · ${settings.socialBio}` : ""}
        </p>
        {tokenOk === false ? (
          <p className="error" style={{ margin: "0 0 8px" }}>
            {tokenError || "Meta 토큰이 만료됐거나 막혔습니다. 설정에서 다시 저장해 주세요."}
          </p>
        ) : null}
        <div className="actions" style={{ justifyContent: "flex-start" }}>
          <a
            className="btn ghost"
            href={profileUrl}
            target="_blank"
            rel="noreferrer"
          >
            {CHANNEL_LABEL[channel]} 프로필 열기
          </a>
          <Link className="btn ghost" href="/settings">
            계정 바꾸기
          </Link>
        </div>
      </section>

      <section className="panel" style={{ marginBottom: 16 }}>
        <div className="shorts-archive-head">
          <label style={{ margin: 0 }}>자동 제작</label>
          <div className="actions" style={{ margin: 0, gap: 8 }}>
            <PushNotifyButton />
            <button
              className="btn ghost"
              type="button"
              disabled={Boolean(busy)}
              onClick={() =>
                void run("슬롯 채우는 중…", async () => {
                  await produce();
                })
              }
            >
              부족한 슬롯 채우기
            </button>
          </div>
        </div>
        <p className="muted" style={{ margin: "0 0 10px" }}>
          인스타 07:50 · 19:00 / 스레드 12:10 · 21:30 (한국 시간). 같은 날 글은 문장을
          다르게 만듭니다. 승인을 안 해도 게시 시각이 되면 초안도 올라갑니다. 보류한
          글만 올리지 않고, 시간이 지난 미게시 글은 삭제합니다. 폰에서 승인 알림을
          켜 두면 글이 만들어질 때와 올리기 30분 전에 알려 드립니다.
        </p>
        {duePosts.length > 0 ? (
          <p className="error" style={{ margin: "0 0 10px" }}>
            지금 올릴 글 {duePosts.length}편 ·{" "}
            {duePosts.map((item) => item.headline || item.topic).join(" · ")}. 승인
            여부와 관계없이 게시 시각이 되면 자동으로 올라갑니다.
          </p>
        ) : null}
        {slots.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            오늘 남은 {CHANNEL_LABEL[channel]} 슬롯이 없습니다. 내일 분이 채워집니다.
          </p>
        ) : (
          <ul className="ig-slot-list">
            {slots.map((slot) => {
              const filled = posts.find((item) => item.slotKey === slot.key);
              return (
                <li key={slot.key}>
                  <button
                    type="button"
                    className={
                      filled?.status === "approved" || filled?.status === "posted"
                        ? "is-done"
                        : undefined
                    }
                    onClick={() => {
                      blankEditor.current = false;
                      if (filled) {
                        setPost(filled);
                        if (settings.hasOpenAI && copyNeedsRewrite(filled, channel)) {
                          void run("혼잣말 쓰는 중…", () => writeCopy(filled));
                        }
                        return;
                      }
                      setTopic(slot.topic);
                      if (settings.hasOpenAI) {
                        void run("혼잣말 쓰는 중…", async () => {
                          const created = await readApi<{ post: InstagramPost }>(
                            "/api/instagram",
                            {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                channel,
                                topic: slot.topic,
                                slotKey: slot.key,
                                scheduledFor: slot.scheduledFor,
                              }),
                            },
                          );
                          await writeCopy(created.post, slot.topic, "");
                        });
                      }
                    }}
                  >
                    <b>
                      {slotLabel(slot.kind)} · {formatWhen(slot.scheduledFor)}
                    </b>
                    <span>
                      {filled
                        ? `${INSTAGRAM_STATUS_LABEL[filled.status]} · ${filled.headline}`
                        : slot.topic}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {produceNote ? <p className="muted">{produceNote}</p> : null}
      </section>

      {!settings.hasOpenAI ? (
        <div className="panel" style={{ marginBottom: 16 }}>
          <p className="muted" style={{ margin: 0 }}>
            여기서 혼잣말을 쓰려면 설정에 OpenAI API 키가 필요합니다. 키 없이도 슬롯과
            직접 작성은 됩니다.{" "}
            <Link href="/settings" style={{ textDecoration: "underline" }}>
              설정에서 저장
            </Link>
          </p>
        </div>
      ) : null}

      <div className="ig-layout">
        <section className="panel">
          <div className="field">
            <label>주제</label>
            <input
              value={post ? post.topic : topic}
              onChange={(e) => {
                if (post) setPost({ ...post, topic: e.target.value });
                else setTopic(e.target.value);
              }}
              placeholder={
                channel === "threads"
                  ? "예: 쉬는 날만 눈이 떠짐"
                  : "예: 월요일 출근 로딩"
              }
              disabled={Boolean(busy)}
            />
          </div>
          <div className="field">
            <label>참고 메모 (선택)</label>
            <textarea
              value={post ? post.brief : brief}
              onChange={(e) => {
                if (post) setPost({ ...post, brief: e.target.value });
                else setBrief(e.target.value);
              }}
              placeholder={
                channel === "threads"
                  ? "특정 상황만 적을 때. 비우면 기존 스레드 말투로 여기서 씁니다."
                  : "특정 상황만 적을 때. 비우면 기존 피드 카드 스타일로 여기서 씁니다."
              }
              disabled={Boolean(busy)}
            />
          </div>
          <div className="actions" style={{ justifyContent: "flex-start" }}>
            {!post ? (
              <button
                className="btn secondary"
                type="button"
                disabled={Boolean(busy)}
                onClick={() =>
                  void run(
                    settings.hasOpenAI ? "혼잣말 쓰는 중…" : "게시물 만드는 중…",
                    makeHere,
                  )
                }
              >
                {settings.hasOpenAI ? "여기서 만들기" : "빈 글 만들기"}
              </button>
            ) : (
              <>
                <button
                  className="btn secondary"
                  type="button"
                  disabled={Boolean(busy) || !settings.hasOpenAI}
                  onClick={() =>
                    void run("혼잣말 쓰는 중…", () => writeCopy(post))
                  }
                >
                  {copyNeedsRewrite(post, channel) ? "여기서 만들기" : "다시 만들기"}
                </button>
                <button
                  className="btn ghost"
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() =>
                    void run("저장 중…", async () => {
                      const data = await readApi<{ post: InstagramPost }>(
                        `/api/instagram/${post.id}`,
                        {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            topic: post.topic,
                            brief: post.brief,
                            headline: post.headline,
                            slides: post.slides,
                            caption: post.caption,
                            hashtags: post.hashtags,
                            scheduledFor: post.scheduledFor,
                          }),
                        },
                      );
                      setPost(data.post);
                      await refresh();
                    })
                  }
                >
                  서버에 저장
                </button>
              </>
            )}
          </div>

          {post ? (
            <>
              {channel === "instagram" ? (
              <div className="ig-slide-edit" style={{ marginTop: 16 }}>
                <div className="ig-slide-head">
                  <label>혼잣말 카드 1장</label>
                </div>
                <input
                  value={preview.series}
                  onChange={(e) => setSlide({ series: e.target.value })}
                  placeholder="퇴근 후 혼잣말"
                  disabled={Boolean(busy)}
                />
                <input
                  value={preview.headline}
                  onChange={(e) => setSlide({ headline: e.target.value })}
                  placeholder="출근은 했는데 아직 로딩 중이다."
                  disabled={Boolean(busy)}
                />
                {preview.dialogues.map((row, index) => (
                  <div key={index} className="ig-dialogue">
                    <input
                      value={row.speaker}
                      onChange={(e) => {
                        const dialogues = preview.dialogues.map((item, i) =>
                          i === index ? { ...item, speaker: e.target.value } : item,
                        );
                        setSlide({ dialogues });
                      }}
                      placeholder={index === 0 ? "회사" : index === 1 ? "집" : "체력"}
                      disabled={Boolean(busy)}
                    />
                    <input
                      value={row.line}
                      onChange={(e) => {
                        const dialogues = preview.dialogues.map((item, i) =>
                          i === index ? { ...item, line: e.target.value } : item,
                        );
                        setSlide({ dialogues });
                      }}
                      placeholder="대사"
                      disabled={Boolean(busy)}
                    />
                    <label className="ig-emphasis">
                      <input
                        type="checkbox"
                        checked={row.emphasis}
                        onChange={(e) => {
                          const dialogues = preview.dialogues.map((item, i) => ({
                            ...item,
                            emphasis: e.target.checked ? i === index : i === 2,
                          }));
                          setSlide({ dialogues });
                        }}
                        disabled={Boolean(busy)}
                      />
                      빨강
                    </label>
                  </div>
                ))}
                <input
                  value={preview.punch}
                  onChange={(e) => setSlide({ punch: e.target.value })}
                  placeholder="마음은 불금, 몸은 취침."
                  disabled={Boolean(busy)}
                />
                <input
                  value={preview.question}
                  onChange={(e) => setSlide({ question: e.target.value })}
                  placeholder="오늘은 밖에서 불금 vs 집에서 충전?"
                  disabled={Boolean(busy)}
                />
              </div>
              ) : null}

              <div className="field" style={{ marginTop: 16 }}>
                <label>본문</label>
                <textarea
                  value={post.caption}
                  onChange={(e) => setPost({ ...post, caption: e.target.value })}
                  placeholder={
                    channel === "threads"
                      ? "스레드에 그대로 올릴 혼잣말"
                      : "카드와 다른 문장의 혼잣말"
                  }
                  disabled={Boolean(busy)}
                />
              </div>
              <div className="field">
                <label>해시태그</label>
                <input
                  value={post.hashtags.join(" ")}
                  onChange={(e) =>
                    setPost({
                      ...post,
                      hashtags: e.target.value
                        .split(/[\s,]+/)
                        .map((tag) => tag.replace(/^#/, ""))
                        .filter(Boolean),
                    })
                  }
                  placeholder="직장인공감 퇴근후일상 소연템"
                  disabled={Boolean(busy)}
                />
              </div>
              <div className="field">
                <label>희망 게시 일정</label>
                <input
                  type="datetime-local"
                  value={post.scheduledFor}
                  onChange={(e) =>
                    setPost({ ...post, scheduledFor: e.target.value })
                  }
                  disabled={Boolean(busy)}
                />
              </div>

              {post.publishError ? (
                <p className="error" style={{ margin: "0 0 10px" }}>
                  {post.publishError}
                </p>
              ) : null}
              {post.status === "posted" ? (
                <p className="muted" style={{ margin: "0 0 10px" }}>
                  {CHANNEL_LABEL[channel]}에 올렸습니다.
                </p>
              ) : null}

              <div className="actions" style={{ justifyContent: "flex-start" }}>
                <button
                  className="btn primary"
                  type="button"
                  disabled={Boolean(busy) || post.status === "posted"}
                  onClick={() =>
                    void run("승인 중…", async () => {
                      await readApi<{ post: InstagramPost }>(
                        `/api/instagram/${post.id}`,
                        {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            topic: post.topic,
                            brief: post.brief,
                            headline: post.headline,
                            slides: post.slides,
                            caption: post.caption,
                            hashtags: post.hashtags,
                            scheduledFor: post.scheduledFor,
                          }),
                        },
                      );
                      const data = await readApi<{ post: InstagramPost }>(
                        `/api/instagram/${post.id}/status`,
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ status: "approved" }),
                        },
                      );
                      setPost(data.post);
                      await refresh();
                    })
                  }
                >
                  승인
                </button>
                {post.status === "approved" || post.status === "draft" ? (
                  <button
                    className="btn secondary"
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      void run("올리는 중…", async () => {
                        const data = await readApi<{ post: InstagramPost }>(
                          `/api/instagram/${post.id}/publish`,
                          { method: "POST" },
                        );
                        setPost(data.post);
                        await refresh();
                      })
                    }
                  >
                    지금 올리기
                  </button>
                ) : null}
                <button
                  className="btn ghost"
                  type="button"
                  disabled={Boolean(busy) || post.status === "posted"}
                  onClick={() =>
                    void run("보류 중…", async () => {
                      const data = await readApi<{ post: InstagramPost }>(
                        `/api/instagram/${post.id}/status`,
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ status: "hold" }),
                        },
                      );
                      setPost(data.post);
                      await refresh();
                    })
                  }
                >
                  보류
                </button>
                <button
                  className="btn ghost"
                  type="button"
                  disabled={Boolean(busy) || post.status === "posted"}
                  onClick={() =>
                    void run("작성중으로…", async () => {
                      const data = await readApi<{ post: InstagramPost }>(
                        `/api/instagram/${post.id}/status`,
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ status: "draft" }),
                        },
                      );
                      setPost(data.post);
                      await refresh();
                    })
                  }
                >
                  작성중
                </button>
              </div>
              <div className="field" style={{ marginTop: 12 }}>
                <label>수정 요청</label>
                <input
                  value={changeNote}
                  onChange={(e) => setChangeNote(e.target.value)}
                  placeholder="고칠 점"
                  disabled={Boolean(busy)}
                />
              </div>
              <button
                className="btn ghost"
                type="button"
                disabled={Boolean(busy) || !changeNote.trim()}
                onClick={() =>
                  void run("수정 요청 중…", async () => {
                    const data = await readApi<{ post: InstagramPost }>(
                      `/api/instagram/${post.id}/status`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          status: "changes",
                          note: changeNote,
                        }),
                      },
                    );
                    setPost(data.post);
                    setChangeNote("");
                    await refresh();
                  })
                }
              >
                수정 요청 보내기
              </button>
            </>
          ) : null}

          {busy ? <p className="muted">{busy}</p> : null}
          {error ? <p className="error">{error}</p> : null}
        </section>

        <section className="panel">
          <label>미리보기</label>
          {channel === "instagram" ? (
          <div className="ig-phone">
            <div className="ig-card">
              <span>{preview.series || "퇴근 후 혼잣말"}</span>
              <b>{previewHeadline(preview.headline) || "카드 훅"}</b>
              <ul>
                {preview.dialogues.map((row, index) =>
                  row.speaker || row.line ? (
                    <li key={index}>
                      {row.speaker ? (
                        <span className="ig-speaker">{row.speaker}: </span>
                      ) : null}
                      <span className={row.emphasis ? "is-red" : ""}>
                        {row.line}
                      </span>
                    </li>
                  ) : null,
                )}
              </ul>
              <p>{preview.punch || "빨간 결론 앞의 한 줄"}</p>
              <em>{preview.question || "질문은 여기"}</em>
              <i>{brand}</i>
            </div>
          </div>
          ) : (
          <div className="th-preview">
            <b>{brand}</b>
            <p>
              {post
                ? captionForCopy(post) || "본문이 없습니다."
                : "슬롯을 열거나 여기서 만들면 스레드 글이 여기에 보입니다."}
            </p>
          </div>
          )}
          {post ? (
            <>
              {channel === "instagram" ? (
              <p className="ig-caption-preview">{captionForCopy(post) || "본문이 없습니다."}</p>
              ) : null}
              <div className="actions" style={{ justifyContent: "flex-start" }}>
                {channel === "instagram" ? (
                  <button
                    className="btn secondary"
                    type="button"
                    disabled={Boolean(busy) || post.slides.length === 0}
                    onClick={() =>
                      void run("카드 받는 중…", async () => {
                        const dataUrl = await downloadCardPng(post, 0, brand);
                        const backup = await fetch(`/api/instagram/${post.id}/card`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ slide: 0, dataUrl }),
                        });
                        const payload = (await backup.json().catch(() => ({}))) as {
                          error?: string;
                        };
                        if (!backup.ok) {
                          throw new Error(
                            payload.error || "카드는 받았지만 서버 저장에 실패했습니다.",
                          );
                        }
                      })
                    }
                  >
                    카드 PNG 받기
                  </button>
                ) : null}
                <button
                  className="btn ghost"
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() =>
                    void run("복사 중…", async () => {
                      await copyText(captionForCopy(post));
                      setCopied("본문을 복사했습니다.");
                      setTimeout(() => setCopied(""), 1600);
                    })
                  }
                >
                  본문 복사
                </button>
              </div>
              {copied ? <p className="muted">{copied}</p> : null}

              <div className="field" style={{ marginTop: 16 }}>
                <label>이력</label>
                {post.history.length === 0 ? (
                  <p className="muted">아직 이력이 없습니다.</p>
                ) : (
                  <ul className="ig-history">
                    {post.history.map((item) => (
                      <li key={`${item.at}-${item.action}`}>
                        <b>{item.action}</b>
                        <span>
                          {new Date(item.at).toLocaleString("ko-KR")}
                          {item.note ? ` · ${item.note}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <p className="muted">
              {channel === "threads"
                ? "자동 슬롯이 채워지거나 주제를 넣으면 글 미리보기가 생깁니다."
                : "자동 슬롯이 채워지거나 주제를 넣으면 미리보기가 생깁니다."}
            </p>
          )}
        </section>
      </div>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="shorts-archive-head">
          <label style={{ margin: 0 }}>게시물</label>
          <select
            value={filter}
            onChange={(e) =>
              setFilter(e.target.value as InstagramPostStatus | "all")
            }
          >
            <option value="all">전체</option>
            <option value="draft">작성중</option>
            <option value="changes">수정 요청</option>
            <option value="hold">보류</option>
            <option value="approved">승인</option>
            <option value="posted">게시됨</option>
          </select>
        </div>
        {visible.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            아직 저장된 {CHANNEL_LABEL[channel]} 글이 없습니다.
          </p>
        ) : (
          <ul className="shorts-archive-list" style={{ maxHeight: 320 }}>
            {visible.map((item) => (
              <li
                key={item.id}
                className={`shorts-archive-item${
                  post?.id === item.id ? " is-on" : ""
                }${item.status === "approved" || item.status === "posted" ? " is-done" : ""}`}
              >
                <button
                  className="shorts-archive-open"
                  type="button"
                  onClick={() => {
                    blankEditor.current = false;
                    setPost(item);
                  }}
                >
                  <b>{item.headline || item.topic}</b>
                  <span>
                    {item.source === "auto" ? "자동 · " : ""}
                    {INSTAGRAM_STATUS_LABEL[item.status]} ·{" "}
                    {formatWhen(item.scheduledFor)}
                  </span>
                </button>
                <div className="shorts-archive-actions">
                  <span className={`pill ${item.status}`}>
                    {INSTAGRAM_STATUS_LABEL[item.status]}
                  </span>
                  <button
                    className="btn ghost"
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      void run("지우는 중…", async () => {
                        await readApi(`/api/instagram/${item.id}`, {
                          method: "DELETE",
                        });
                        if (post?.id === item.id) setPost(null);
                        await refresh();
                      })
                    }
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <SocialInbox settings={settings} channel={channel} />
    </div>
  );
}
