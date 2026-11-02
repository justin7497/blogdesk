"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_VOICE,
  isLegacyDefaultVoice,
  pickDefaultVoiceId,
  resolveVoiceId,
  SPEECH_SPEEDS,
  voiceOptionLabel,
} from "@/lib/elevenlabs";
import {
  featuredTypecastIndex,
  isTypecastVoiceId,
  TYPECAST_FEATURED,
  typecastVoiceLabel,
} from "@/lib/typecast";
import { SourcingSearch } from "@/components/SourcingSearch";
import type { ClientSettings, ShortsJob, TtsProvider } from "@/lib/types";

type Voice = { id: string; name: string; model?: string };

const STATUS_LABEL: Record<ShortsJob["status"], string> = {
  uploaded: "영상",
  scripted: "대본",
  voiced: "음성",
  done: "완성",
  error: "오류",
};

async function readApi<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || `요청 실패 (${res.status})`);
  return data;
}

export function ShortsMaker({ settings }: { settings: ClientSettings }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [job, setJob] = useState<ShortsJob | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [script, setScript] = useState("");
  const [scriptAlt, setScriptAlt] = useState("");
  const [voices, setVoices] = useState<Voice[]>([]);
  const [ttsProvider, setTtsProvider] = useState<TtsProvider>(() =>
    settings.hasTypecast &&
    (!settings.hasElevenLabs || settings.ttsProvider === "typecast")
      ? "typecast"
      : "elevenlabs",
  );
  const [voiceId, setVoiceId] = useState(
    settings.ttsProvider === "typecast" && settings.typecastVoiceId
      ? settings.typecastVoiceId
      : resolveVoiceId(settings.elevenLabsVoiceId),
  );
  const [voiceLoadError, setVoiceLoadError] = useState("");
  const [elevenSpeed, setElevenSpeed] = useState(settings.elevenLabsSpeed || 1.1);
  const [typecastSpeed, setTypecastSpeed] = useState(
    settings.typecastSpeed || 1.1,
  );
  const speechSpeed =
    ttsProvider === "typecast" ? typecastSpeed : elevenSpeed;
  const [localUrl, setLocalUrl] = useState("");
  const [jobs, setJobs] = useState<ShortsJob[]>([]);
  const archiveJobs = useMemo(
    () => jobs.filter((item) => item.status === "done"),
    [jobs],
  );
  const [editingId, setEditingId] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeTitle, setYoutubeTitle] = useState("");
  const [youtubeScript, setYoutubeScript] = useState("");

  const refreshJobs = useCallback(async () => {
    const data = await readApi<{ jobs: ShortsJob[] }>("/api/shorts");
    setJobs(data.jobs);
  }, []);

  function openJob(next: ShortsJob) {
    setJob(next);
    setScript(next.script || "");
    setScriptAlt(next.scriptAlt || "");
    if (next.voiceId) {
      if (isTypecastVoiceId(next.voiceId)) {
        setTtsProvider("typecast");
        setVoiceId(next.voiceId);
      } else {
        setTtsProvider("elevenlabs");
        setVoiceId(resolveVoiceId(next.voiceId));
      }
    }
    setLocalUrl("");
    setError("");
  }

  function startNew() {
    setJob(null);
    setScript("");
    setScriptAlt("");
    setLocalUrl("");
    setError("");
  }

  useEffect(() => {
    void refreshJobs().catch(() => undefined);
  }, [refreshJobs]);

  useEffect(() => {
    const canLoad =
      (ttsProvider === "typecast" && settings.hasTypecast) ||
      (ttsProvider === "elevenlabs" && settings.hasElevenLabs);
    if (!canLoad) {
      setVoices([]);
      setVoiceLoadError("");
      return;
    }
    setVoiceLoadError("");
    readApi<{ voices: Voice[]; defaultVoice?: string }>(
      `/api/shorts/voices?provider=${ttsProvider}`,
    )
      .then((data) => {
        setVoices(data.voices);
        setVoiceId((current) => {
          if (data.voices.some((voice) => voice.id === current)) return current;
          if (ttsProvider === "elevenlabs") {
            const preferred = data.defaultVoice || pickDefaultVoiceId(data.voices);
            if (isLegacyDefaultVoice(current)) return preferred;
            return preferred || DEFAULT_VOICE;
          }
          return data.defaultVoice || data.voices[0]?.id || "";
        });
      })
      .catch((err) => {
        setVoices([]);
        setVoiceLoadError(
          err instanceof Error ? err.message : "보이스 목록을 불러오지 못했습니다.",
        );
      });
  }, [settings.hasElevenLabs, settings.hasTypecast, ttsProvider]);

  const stamp = job ? encodeURIComponent(job.updatedAt) : "";
  const sourceUrl =
    localUrl ||
    (job ? `/api/shorts/${job.id}/file?kind=source&t=${stamp}` : "");
  const hasScript = Boolean(script.trim() || job?.script);
  const hasVoice = job?.status === "voiced" || job?.status === "done";
  const voiceUrl = hasVoice
    ? `/api/shorts/${job!.id}/file?kind=voice&t=${stamp}`
    : "";
  const outputUrl =
    job?.status === "done"
      ? `/api/shorts/${job.id}/file?kind=output&t=${stamp}`
      : "";

  const step = useMemo(() => {
    if (!job) return 1;
    if (job.status === "uploaded" || job.status === "error") return 2;
    if (job.status === "scripted") return 3;
    if (job.status === "voiced") return 4;
    return 5;
  }, [job]);

  const run = useCallback(async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "실패했습니다.");
    } finally {
      setBusy("");
    }
  }, []);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setLocalUrl(URL.createObjectURL(file));
    await run("영상 올리는 중…", async () => {
      const body = new FormData();
      body.append("file", file);
      const data = await readApi<{ job: ShortsJob }>("/api/shorts", {
        method: "POST",
        body,
      });
      setJob(data.job);
      setScript("");
      setScriptAlt("");
      await refreshJobs();
    });
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>쇼츠 메이커</h1>
          <p>
            영상을 올리면 OpenAI가 장면을 읽고 대본을 만든 뒤, ElevenLabs 또는
            타입캐스트 음성과 Pretendard 한글 자막을 영상에 입힙니다.
          </p>
        </div>
        <button
          className="btn secondary"
          type="button"
          disabled={Boolean(busy)}
          onClick={startNew}
        >
          새로 만들기
        </button>
      </div>

      <section className="panel shorts-archive">
        <div className="shorts-archive-head">
          <label style={{ margin: 0 }}>보관함</label>
          <span className="muted">{archiveJobs.length}개</span>
        </div>
        {archiveJobs.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            영상에 입히기까지 끝난 완성본만 여기에 남습니다.
          </p>
        ) : (
          <ul className="shorts-archive-list">
            {archiveJobs.map((item) => (
              <li
                key={item.id}
                className={`shorts-archive-item${
                  job?.id === item.id ? " is-on" : ""
                }`}
              >
                {editingId === item.id ? (
                  <form
                    className="shorts-archive-edit"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void run("이름 저장 중…", async () => {
                        const data = await readApi<{ job: ShortsJob }>(
                          `/api/shorts/${item.id}`,
                          {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ title: editTitle }),
                          },
                        );
                        setEditingId("");
                        if (job?.id === item.id) setJob(data.job);
                        await refreshJobs();
                      });
                    }}
                  >
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      autoFocus
                      disabled={Boolean(busy)}
                      placeholder="작업 이름"
                    />
                    <button className="btn secondary" type="submit" disabled={Boolean(busy)}>
                      저장
                    </button>
                    <button
                      className="btn ghost"
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => setEditingId("")}
                    >
                      취소
                    </button>
                  </form>
                ) : (
                  <>
                    <button
                      type="button"
                      className="shorts-archive-open"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        void run("작업 여는 중…", async () => {
                          const data = await readApi<{ job: ShortsJob }>(
                            `/api/shorts/${item.id}`,
                          );
                          openJob(data.job);
                        })
                      }
                    >
                      <b>{item.title || item.filename}</b>
                      <span>
                        {STATUS_LABEL[item.status]} ·{" "}
                        {new Date(item.updatedAt).toLocaleString("ko-KR", {
                          month: "numeric",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </button>
                    <div className="shorts-archive-actions">
                      <button
                        type="button"
                        className="btn ghost"
                        disabled={Boolean(busy)}
                        onClick={() => {
                          setEditingId(item.id);
                          setEditTitle(item.title || item.filename);
                        }}
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        className="btn ghost"
                        disabled={Boolean(busy)}
                        onClick={() => {
                          if (
                            !window.confirm(
                              `"${item.title || item.filename}" 작업을 삭제할까요?`,
                            )
                          ) {
                            return;
                          }
                          void run("지우는 중…", async () => {
                            await readApi(`/api/shorts/${item.id}`, {
                              method: "DELETE",
                            });
                            if (job?.id === item.id) startNew();
                            await refreshJobs();
                          });
                        }}
                      >
                        삭제
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <SourcingSearch hasOpenAI={settings.hasOpenAI} />

      {(!settings.hasOpenAI ||
        (!settings.hasElevenLabs && !settings.hasTypecast)) && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <p className="muted" style={{ margin: 0 }}>
            {!settings.hasOpenAI ? "OpenAI API 키와 " : ""}
            {!settings.hasElevenLabs && !settings.hasTypecast
              ? "ElevenLabs 또는 타입캐스트 API 키가 "
              : ""}
            필요합니다.{" "}
            <Link href="/settings" style={{ textDecoration: "underline" }}>
              설정에서 저장
            </Link>
          </p>
        </div>
      )}

      <ol className="shorts-steps">
        {["업로드", "대본", "음성", "합성"].map((label, i) => (
          <li
            key={label}
            className={`shorts-step${step > i + 1 ? " is-done" : ""}${
              step === i + 1 ? " is-on" : ""
            }`}
          >
            <b>{i + 1}</b>
            {label}
          </li>
        ))}
      </ol>

      <div className="shorts-grid">
        <section className="panel">
          <div
            className="shorts-drop"
            onClick={() => {
              if (sourceUrl) return;
              inputRef.current?.click();
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void onFile(e.dataTransfer.files[0]);
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v"
              hidden
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
            {sourceUrl ? (
              <video
                className="shorts-preview"
                src={sourceUrl}
                controls
                playsInline
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <p>
                클릭하거나 영상을 끌어다 놓으세요
                <span>mp4 / webm / mov · 90초 · 80MB 이하</span>
              </p>
            )}
          </div>
          {job ? (
            <p
              className="muted"
              style={{
                marginTop: 10,
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <span>
                {job.filename} · {job.durationSec.toFixed(1)}초
              </span>
              <button
                className="btn ghost"
                type="button"
                onClick={() => inputRef.current?.click()}
              >
                다른 영상
              </button>
            </p>
          ) : null}
          {outputUrl ? (
            <div style={{ marginTop: 16 }}>
              <div className="field">
                <label>완성 영상</label>
                <video
                  key={outputUrl}
                  className="shorts-preview"
                  src={outputUrl}
                  controls
                  playsInline
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <a className="btn primary" href={outputUrl} download>
                완성 영상 받기
              </a>
            </div>
          ) : null}
        </section>

        <section className="panel">
          <div className="field">
            <label>유튜브 대본</label>
            <input
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=... 또는 쇼츠 주소"
            />
            <p className="muted" style={{ marginTop: 8 }}>
              공개 자막만 가져옵니다. 영상 파일은 받지 않습니다.
            </p>
          </div>
          <div className="actions" style={{ justifyContent: "flex-start" }}>
            <button
              className="btn secondary"
              type="button"
              disabled={!youtubeUrl.trim() || Boolean(busy)}
              onClick={() =>
                void run("유튜브 대본 받는 중…", async () => {
                  const data = await readApi<{
                    title: string;
                    text: string;
                  }>("/api/shorts/youtube-transcript", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ url: youtubeUrl }),
                  });
                  setYoutubeTitle(data.title || "");
                  setYoutubeScript(data.text || "");
                })
              }
            >
              대본 받기
            </button>
            <button
              className="btn ghost"
              type="button"
              disabled={!youtubeScript.trim()}
              onClick={() => {
                const name = (youtubeTitle || "youtube-script")
                  .replace(/[\\/:*?"<>|]/g, " ")
                  .slice(0, 80)
                  .trim() || "youtube-script";
                const blob = new Blob([youtubeScript], {
                  type: "text/plain;charset=utf-8",
                });
                const href = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = href;
                link.download = `${name}.txt`;
                document.body.appendChild(link);
                link.click();
                link.remove();
                URL.revokeObjectURL(href);
              }}
            >
              파일로 저장
            </button>
            <button
              className="btn ghost"
              type="button"
              disabled={!youtubeScript.trim()}
              onClick={() => setScript(youtubeScript)}
            >
              아래 대본에 넣기
            </button>
          </div>
          {youtubeScript ? (
            <div className="field" style={{ marginTop: 12 }}>
              <label>
                받은 대본{youtubeTitle ? ` · ${youtubeTitle}` : ""}
              </label>
              <textarea
                value={youtubeScript}
                onChange={(e) => setYoutubeScript(e.target.value)}
                style={{ minHeight: 140 }}
              />
            </div>
          ) : null}

          <div className="field">
            <label>대본 {job?.title ? `· ${job.title}` : ""}</label>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="영상을 올린 뒤 대본 만들기를 누르면 여기에 나레이션이 생깁니다. 직접 고쳐도 됩니다."
              style={{ minHeight: 180 }}
            />
          </div>
          {job?.hook ? (
            <p className="muted">
              훅{job.hookType ? ` · ${job.hookType}` : ""}: {job.hook}
            </p>
          ) : null}
          {scriptAlt ? (
            <button
              className="btn ghost"
              type="button"
              style={{ width: "fit-content", marginBottom: 12 }}
              onClick={() => {
                setScript(scriptAlt);
                setScriptAlt(script);
              }}
            >
              다른 훅 대본
            </button>
          ) : null}

          <div className="field">
            <label>보이스</label>
            <div className="actions" style={{ marginBottom: 8 }}>
              <button
                className={
                  ttsProvider === "elevenlabs" ? "btn secondary" : "btn ghost"
                }
                type="button"
                onClick={() => setTtsProvider("elevenlabs")}
              >
                ElevenLabs
              </button>
              <button
                className={
                  ttsProvider === "typecast" ? "btn secondary" : "btn ghost"
                }
                type="button"
                onClick={() => setTtsProvider("typecast")}
              >
                타입캐스트
              </button>
            </div>
            {ttsProvider === "typecast" && !settings.hasTypecast ? (
              <p className="muted">
                타입캐스트 API 키가 필요합니다.{" "}
                <Link href="/settings" style={{ textDecoration: "underline" }}>
                  설정에서 저장
                </Link>
              </p>
            ) : voices.length > 0 ? (
              <select
                value={voiceId}
                onChange={(e) => setVoiceId(e.target.value)}
              >
                {ttsProvider === "typecast" ? (
                  <>
                    <optgroup label="추천">
                      {voices
                        .filter((voice) => featuredTypecastIndex(voice.name) >= 0)
                        .map((voice) => (
                          <option key={voice.id} value={voice.id}>
                            {typecastVoiceLabel(voice.name)}
                          </option>
                        ))}
                    </optgroup>
                    <optgroup label="전체">
                      {voices
                        .filter((voice) => featuredTypecastIndex(voice.name) < 0)
                        .map((voice) => (
                          <option key={voice.id} value={voice.id}>
                            {voice.name}
                          </option>
                        ))}
                    </optgroup>
                  </>
                ) : (
                  voices.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voiceOptionLabel(voice.name)}
                    </option>
                  ))
                )}
              </select>
            ) : (
              <p className="muted">
                {voiceLoadError ||
                  (ttsProvider === "typecast"
                    ? "타입캐스트 보이스를 불러오는 중입니다."
                    : "기본은 Anna Kim(쇼핑)입니다. 테크·공구는 VIV를 고르세요.")}
              </p>
            )}
            {ttsProvider === "typecast" && voices.length > 0 ? (
              <p className="muted" style={{ marginTop: 8 }}>
                {TYPECAST_FEATURED.map((item) => {
                  const found = voices.some((voice) => item.match.test(voice.name));
                  return `${item.label} ${found ? "연결됨" : "없음"}`;
                }).join(" · ")}
              </p>
            ) : null}
          </div>

          <div className="field">
            <label>
              음성 속도
              <span className="muted" style={{ marginLeft: 8, fontWeight: 500 }}>
                {ttsProvider === "typecast" ? "타입캐스트" : "ElevenLabs"} ·{" "}
                {speechSpeed}배
              </span>
            </label>
            <select
              value={String(speechSpeed)}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (ttsProvider === "typecast") setTypecastSpeed(next);
                else setElevenSpeed(next);
              }}
            >
              {SPEECH_SPEEDS.map((speed) => (
                <option key={speed} value={speed}>
                  {speed}배{speed === 1.1 ? " (기본)" : ""}
                </option>
              ))}
            </select>
          </div>

          {voiceUrl ? (
            <audio
              key={voiceUrl}
              src={voiceUrl}
              controls
              style={{ width: "100%", marginBottom: 12 }}
            />
          ) : null}

          <div className="actions" style={{ justifyContent: "flex-start" }}>
            <button
              className="btn secondary"
              type="button"
              disabled={!job || Boolean(busy)}
              onClick={() =>
                void run(
                  hasScript ? "대본 다시 만드는 중…" : "대본 만드는 중…",
                  async () => {
                    const data = await readApi<{ job: ShortsJob }>(
                      `/api/shorts/${job!.id}/analyze`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ remix: hasScript }),
                      },
                    );
                    setJob(data.job);
                    setScript(data.job.script);
                    setScriptAlt(data.job.scriptAlt || "");
                    await refreshJobs();
                  },
                )
              }
            >
              {hasScript ? "대본 다시 만들기" : "대본 만들기"}
            </button>
            <button
              className="btn secondary"
              type="button"
              disabled={!job || !script.trim() || Boolean(busy)}
              onClick={() =>
                void run(
                  hasVoice ? "음성 다시 만드는 중…" : "음성 만드는 중…",
                  async () => {
                    await readApi(`/api/shorts/${job!.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ script }),
                    });
                    const data = await readApi<{ job: ShortsJob }>(
                      `/api/shorts/${job!.id}/voice`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          script,
                          voiceId,
                          provider: ttsProvider,
                          speed: speechSpeed,
                          model: voices.find((voice) => voice.id === voiceId)
                            ?.model,
                        }),
                      },
                    );
                    setJob(data.job);
                    await refreshJobs();
                  },
                )
              }
            >
              {hasVoice ? "음성 다시 만들기" : "음성 만들기"}
            </button>
            <button
              className="btn primary"
              type="button"
              disabled={!job || (!hasVoice && job.status !== "done") || Boolean(busy)}
              onClick={() =>
                void run(
                  job?.status === "done" ? "영상 다시 입히는 중…" : "영상에 입히는 중…",
                  async () => {
                    const data = await readApi<{ job: ShortsJob }>(
                      `/api/shorts/${job!.id}/render`,
                      { method: "POST" },
                    );
                    setJob(data.job);
                    await refreshJobs();
                  },
                )
              }
            >
              {job?.status === "done" ? "영상 다시 입히기" : "영상에 입히기"}
            </button>
          </div>
          {hasScript ? (
            <p className="muted" style={{ marginTop: 12 }}>
              대본을 다시 만들면 음성부터 다시 뽑아야 하고, 음성을 다시 만들면
              영상도 다시 입혀야 합니다.
            </p>
          ) : null}

          {busy ? <p className="muted" style={{ marginTop: 12 }}>{busy}</p> : null}
          {error ? (
            <p className="muted" style={{ marginTop: 12, color: "var(--danger)" }}>
              {error}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
