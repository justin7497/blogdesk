"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ArticlePreview } from "@/components/ArticlePreview";
import { StatusPill } from "@/components/StatusPill";
import {
  generateForTopic,
  markCopied,
  saveDraft,
  setTopicStatus,
} from "@/lib/actions";
import { copyHtml, copyText, htmlToPlain, blogWriteUrl } from "@/lib/clipboard";
import { draftToHtml, draftToPlain } from "@/lib/html";
import type { Account, Draft, DraftSection, Topic } from "@/lib/types";

export function EditorClient({
  account,
  topic,
  draft,
  hasApiKey,
}: {
  account: Account;
  topic: Topic;
  draft?: Draft;
  hasApiKey: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const [editing, setEditing] = useState(false);
  const [selectedTitle, setSelectedTitle] = useState(draft?.selectedTitle ?? "");
  const [titles] = useState(draft?.titles ?? []);
  const [lead, setLead] = useState(draft?.lead ?? "");
  const [sections, setSections] = useState<DraftSection[]>(draft?.sections ?? []);
  const [tags, setTags] = useState((draft?.tags ?? []).join(", "));
  const [evidenceUsed, setEvidenceUsed] = useState(draft?.evidenceUsed ?? "");
  const [internalLinkHint, setInternalLinkHint] = useState(
    draft?.internalLinkHint ?? "",
  );

  const uniqueness = draft?.uniqueness;
  const html = useMemo(
    () => draftToHtml({ lead, sections, internalLinkHint }),
    [lead, sections, internalLinkHint],
  );

  const liveDraft: Draft | undefined = draft
    ? {
        ...draft,
        selectedTitle,
        titles,
        lead,
        sections,
        tags: tags.split(/[,#]/).map((t) => t.trim()).filter(Boolean),
        evidenceUsed,
        internalLinkHint,
      }
    : undefined;

  function generate() {
    setMsg("");
    start(async () => {
      const result = await generateForTopic(topic.id);
      if (!result.ok) {
        setMsg(result.error);
        return;
      }
      if (result.blocked) {
        setMsg("다른 계정 글과 너무 닮아 막혔습니다. 제목을 바꿔 다시 생성하세요.");
      }
      router.refresh();
    });
  }

  function persist() {
    if (!draft) return;
    start(async () => {
      await saveDraft({
        id: draft.id,
        selectedTitle,
        titles,
        lead,
        sections,
        tags: tags.split(/[,#]/).map((t) => t.trim()).filter(Boolean),
        evidenceUsed,
        internalLinkHint,
      });
      router.refresh();
      setMsg("저장했습니다.");
      setEditing(false);
    });
  }

  const writeUrl = blogWriteUrl(account.blogUrl);
  const plain = useMemo(() => htmlToPlain(html), [html]);
  const tagLine = tags
    .split(/[,#]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .join(", ");

  async function copy(kind: "title" | "body" | "tags" | "text", label: string) {
    try {
      if (kind === "body") {
        await copyHtml(html, plain);
      } else if (kind === "title") {
        await copyText(selectedTitle);
      } else if (kind === "tags") {
        await copyText(tagLine);
      } else {
        if (!draft) return;
        await copyText(
          draftToPlain({
            ...draft,
            selectedTitle,
            lead,
            sections,
            tags: tagLine.split(/[,#]/).map((t) => t.trim()).filter(Boolean),
            internalLinkHint,
          }),
        );
      }
      setMsg(
        kind === "body"
          ? "본문을 복사했습니다. 네이버 글쓰기 본문에 Ctrl+V 하면 서식으로 붙습니다."
          : `${label}했습니다.`,
      );
      if (draft && kind === "body") {
        await markCopied(topic.id);
        router.refresh();
      }
    } catch (error) {
      console.error(error);
      setMsg("복사에 실패했습니다. 브라우저 클립보드 권한을 확인해 주세요.");
    }
  }

  const uniqClass = uniqueness?.blocked
    ? "bad"
    : uniqueness?.warning
      ? "warn"
      : "";

  return (
    <div className="blog-ceo-page">
      <div className="page-head">
        <div>
          <h1>블로그 전체 편집본</h1>
          <p>
            {account.name} 제출용 · {topic.keyword} · {topic.date}
          </p>
        </div>
        <div className="actions">
          <StatusPill status={topic.status} />
          <button className="btn ghost" type="button" onClick={() => setEditing((v) => !v)}>
            {editing ? "미리보기" : "원고 수정"}
          </button>
          <button
            className="btn ghost"
            type="button"
            disabled={!draft || !selectedTitle}
            onClick={() => void copy("title", "제목 복사")}
          >
            제목 복사
          </button>
          <button
            className="btn secondary"
            type="button"
            disabled={!draft}
            onClick={() => void copy("body", "본문 복사")}
          >
            본문 복사
          </button>
          <button
            className="btn ghost"
            type="button"
            disabled={!draft || !tagLine}
            onClick={() => void copy("tags", "태그 복사")}
          >
            태그 복사
          </button>
          {writeUrl ? (
            <a className="btn ghost" href={writeUrl} target="_blank" rel="noopener">
              글쓰기 창 열기
            </a>
          ) : null}
          <button className="btn primary" type="button" disabled={pending} onClick={generate}>
            {pending ? "작성 중…" : draft ? "다시 생성" : "초안 생성"}
          </button>
        </div>
      </div>

      {!hasApiKey ? (
        <div className="banner-warn">
          API 키가 없어 뼈대 초안만 채웁니다. 설정에서 키를 넣으면 이 계정 말투로
          다시 씁니다.
        </div>
      ) : null}
      {msg ? <div className="banner-ok">{msg}</div> : null}

      <aside className="blog-ceo-notes">
        <strong>운영 메모</strong>
        <ul style={{ margin: "8px 0 0", paddingLeft: "1.1rem" }}>
          <li>본문 복사 → 네이버 본문에 Ctrl+V. HTML 코드가 아니라 제목·목록 서식으로 붙습니다.</li>
          <li>이미지 슬롯에는 이 블로그 현장 사진만 올립니다.</li>
          <li>다른 계정과 제목·첫 문단이 닮으면 발행하지 않습니다.</li>
          <li>하루 {account.dailyCap}편. 붙여 넣은 뒤 사진을 채웁니다.</li>
        </ul>
        {uniqueness ? (
          <div style={{ marginTop: 12 }}>
            <div className={`uniq ${uniqClass}`} style={{ marginBottom: 8 }}>
              <i style={{ width: `${Math.min(100, uniqueness.score)}%` }} />
            </div>
            <span className="muted">
              {uniqueness.notes[0]} ({uniqueness.score}%)
            </span>
          </div>
        ) : null}
      </aside>

      {editing && draft ? (
        <div className="panel" style={{ marginBottom: 18 }}>
          <h3 style={{ margin: "0 0 12px" }}>제목 안</h3>
          {titles.map((t) => (
            <label key={t} className="title-opt">
              <input
                type="radio"
                checked={selectedTitle === t}
                onChange={() => setSelectedTitle(t)}
              />
              <span>{t}</span>
            </label>
          ))}
          <div className="field" style={{ marginTop: 16 }}>
            <label>도입</label>
            <textarea value={lead} onChange={(e) => setLead(e.target.value)} />
          </div>
          {sections.map((s, idx) => (
            <div key={idx} className="field">
              <label>소제목 {idx + 1}</label>
              <input
                value={s.heading}
                onChange={(e) => {
                  const next = [...sections];
                  next[idx] = { ...s, heading: e.target.value };
                  setSections(next);
                }}
              />
              <textarea
                value={s.body}
                onChange={(e) => {
                  const next = [...sections];
                  next[idx] = { ...s, body: e.target.value };
                  setSections(next);
                }}
              />
            </div>
          ))}
          <div className="field">
            <label>내부 링크 힌트</label>
            <input
              value={internalLinkHint}
              onChange={(e) => setInternalLinkHint(e.target.value)}
            />
          </div>
          <div className="field">
            <label>태그</label>
            <input value={tags} onChange={(e) => setTags(e.target.value)} />
          </div>
          <div className="actions" style={{ justifyContent: "flex-start" }}>
            <button className="btn primary" type="button" disabled={pending} onClick={persist}>
              수정 저장
            </button>
            <button
              className="btn ghost"
              type="button"
              onClick={() =>
                start(async () => {
                  await setTopicStatus(topic.id, "approved");
                  router.refresh();
                })
              }
            >
              승인
            </button>
            <button
              className="btn ghost"
              type="button"
              onClick={() => void copy("text", "텍스트 복사")}
            >
              텍스트 복사
            </button>
          </div>
        </div>
      ) : null}

      <ArticlePreview account={account} topic={topic} draft={liveDraft} />
    </div>
  );
}
