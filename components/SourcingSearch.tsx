"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  SOURCING_SCENES,
  taobaoSearchUrl,
  xiaohongshuSearchUrl,
  type SourcingQuery,
  type SourcingScene,
} from "@/lib/sourcing";
import type { SourcingLink } from "@/lib/types";

async function readApi<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || `요청 실패 (${res.status})`);
  return data;
}

function fileToImage(file: File): Promise<{ mime: string; data: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const match = result.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
      if (!match) {
        reject(new Error("jpg, png, webp 사진만 올릴 수 있습니다."));
        return;
      }
      resolve({ mime: match[1]!, data: match[2]! });
    };
    reader.onerror = () => reject(new Error("사진을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

const PLATFORM_LABEL: Record<SourcingLink["platform"], string> = {
  taobao: "타오바오",
  xiaohongshu: "샤오홍슈",
  other: "기타",
};

export function SourcingSearch({ hasOpenAI }: { hasOpenAI: boolean }) {
  const photoRef = useRef<HTMLInputElement>(null);
  const [keyword, setKeyword] = useState("");
  const [scene, setScene] = useState<SourcingScene>("general");
  const [photoName, setPhotoName] = useState("");
  const [photo, setPhoto] = useState<{ mime: string; data: string } | null>(
    null,
  );
  const [productKo, setProductKo] = useState("");
  const [queries, setQueries] = useState<SourcingQuery[]>([]);
  const [saveUrl, setSaveUrl] = useState("");
  const [saveNote, setSaveNote] = useState("");
  const [links, setLinks] = useState<SourcingLink[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const refreshLinks = useCallback(async () => {
    const data = await readApi<{ links: SourcingLink[] }>(
      "/api/shorts/sourcing/links",
    );
    setLinks(data.links);
  }, []);

  useEffect(() => {
    void refreshLinks().catch(() => undefined);
  }, [refreshLinks]);

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

  return (
    <section className="panel" style={{ marginBottom: 16 }}>
      <div className="field">
        <label>소재 검색 · 타오바오 · 샤오홍슈</label>
        <p className="muted" style={{ marginTop: 0 }}>
          검색어나 제품 사진으로 중국어 키워드를 만든 뒤, 각 사이트 공식 검색을
          엽니다. 영상 파일은 받지 않습니다. 쓸 때는 판매자·제작자 허락을 확인하세요.
        </p>
      </div>
      {!hasOpenAI ? (
        <p className="muted">
          OpenAI API 키가 필요합니다.{" "}
          <Link href="/settings" style={{ textDecoration: "underline" }}>
            설정에서 저장
          </Link>
        </p>
      ) : (
        <>
          <div className="field">
            <label>한국어 검색어</label>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="예: 접이식 카트"
              disabled={Boolean(busy)}
            />
          </div>
          <div className="field">
            <label>찾고 싶은 장면</label>
            <select
              value={scene}
              onChange={(e) => setScene(e.target.value as SourcingScene)}
              disabled={Boolean(busy)}
            >
              {SOURCING_SCENES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>제품 사진 (선택)</label>
            <input
              ref={photoRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                void run("사진 읽는 중…", async () => {
                  const next = await fileToImage(file);
                  setPhoto(next);
                  setPhotoName(file.name);
                });
              }}
            />
            <div className="actions" style={{ justifyContent: "flex-start" }}>
              <button
                className="btn ghost"
                type="button"
                disabled={Boolean(busy)}
                onClick={() => photoRef.current?.click()}
              >
                {photoName || "사진 고르기"}
              </button>
              {photo ? (
                <button
                  className="btn ghost"
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => {
                    setPhoto(null);
                    setPhotoName("");
                  }}
                >
                  사진 빼기
                </button>
              ) : null}
            </div>
          </div>
          <div className="actions" style={{ justifyContent: "flex-start" }}>
            <button
              className="btn secondary"
              type="button"
              disabled={Boolean(busy) || (!keyword.trim() && !photo)}
              onClick={() =>
                void run("검색어 만드는 중…", async () => {
                  const data = await readApi<{
                    productKo: string;
                    queries: SourcingQuery[];
                  }>("/api/shorts/sourcing/search", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      keyword,
                      scene,
                      image: photo,
                    }),
                  });
                  setProductKo(data.productKo);
                  setQueries(data.queries);
                })
              }
            >
              검색어 만들기
            </button>
          </div>
        </>
      )}

      {queries.length > 0 ? (
        <div style={{ marginTop: 16 }}>
          <p className="muted" style={{ marginBottom: 8 }}>
            {productKo} · 공식 검색만 엽니다
          </p>
          <ul className="shorts-archive-list">
            {queries.map((query) => (
              <li key={query.zh} className="shorts-archive-item">
                <div>
                  <b>{query.zh}</b>
                  <span>
                    {query.ko}
                    {query.kind ? ` · ${query.kind}` : ""}
                  </span>
                </div>
                <div className="shorts-archive-actions">
                  <a
                    className="btn ghost"
                    href={taobaoSearchUrl(query.zh)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    타오바오
                  </a>
                  <a
                    className="btn ghost"
                    href={xiaohongshuSearchUrl(query.zh)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    샤오홍슈
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="field" style={{ marginTop: 16 }}>
        <label>관심 링크 저장</label>
        <input
          value={saveUrl}
          onChange={(e) => setSaveUrl(e.target.value)}
          placeholder="타오바오 또는 샤오홍슈 주소"
          disabled={Boolean(busy)}
        />
      </div>
      <div className="field">
        <input
          value={saveNote}
          onChange={(e) => setSaveNote(e.target.value)}
          placeholder="메모 (선택)"
          disabled={Boolean(busy)}
        />
      </div>
      <div className="actions" style={{ justifyContent: "flex-start" }}>
        <button
          className="btn ghost"
          type="button"
          disabled={!saveUrl.trim() || Boolean(busy)}
          onClick={() =>
            void run("링크 저장 중…", async () => {
              const data = await readApi<{ links: SourcingLink[] }>(
                "/api/shorts/sourcing/links",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    product: productKo || keyword,
                    url: saveUrl,
                    note: saveNote,
                  }),
                },
              );
              setLinks(data.links);
              setSaveUrl("");
              setSaveNote("");
            })
          }
        >
          링크 저장
        </button>
      </div>

      {links.length > 0 ? (
        <ul className="shorts-archive-list" style={{ marginTop: 12 }}>
          {links.map((item) => (
            <li key={item.id} className="shorts-archive-item">
              <div>
                <b>{item.product}</b>
                <span>
                  {PLATFORM_LABEL[item.platform]}
                  {item.note ? ` · ${item.note}` : ""}
                </span>
              </div>
              <div className="shorts-archive-actions">
                <a
                  className="btn ghost"
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  열기
                </a>
                <button
                  className="btn ghost"
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() =>
                    void run("지우는 중…", async () => {
                      const data = await readApi<{ links: SourcingLink[] }>(
                        `/api/shorts/sourcing/links?id=${encodeURIComponent(item.id)}`,
                        { method: "DELETE" },
                      );
                      setLinks(data.links);
                    })
                  }
                >
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {busy ? <p className="muted">{busy}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
