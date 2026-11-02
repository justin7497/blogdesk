"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  createTopic,
  deleteTopic,
  planWeek,
} from "@/lib/actions";
import { INTENTS, type Account, type Intent, type Topic } from "@/lib/types";

function monthMatrix(year: number, month: number) {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const cells: Date[] = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(d);
  }
  return cells;
}

function iso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function CalendarBoard({
  accounts,
  topics,
  today,
}: {
  accounts: Account[];
  topics: Topic[];
  today: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [cursor, setCursor] = useState(() => {
    const [y, m] = today.split("-").map(Number);
    return { y, m: m - 1 };
  });
  const [selected, setSelected] = useState(today);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [keyword, setKeyword] = useState("");
  const [intent, setIntent] = useState<Intent>("info");
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");

  const cells = useMemo(
    () => monthMatrix(cursor.y, cursor.m),
    [cursor],
  );

  const selectedAccount = accounts.find((a) => a.id === accountId);

  function add() {
    setError("");
    start(async () => {
      const result = await createTopic({
        accountId,
        date: selected,
        keyword: keyword || selectedAccount?.keywords[0] || "",
        intent,
        question,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setKeyword("");
      setQuestion("");
      router.refresh();
    });
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 18 }}>
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <strong>
            {cursor.y}년 {cursor.m + 1}월
          </strong>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              className="btn ghost"
              type="button"
              onClick={() =>
                setCursor((c) =>
                  c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 },
                )
              }
            >
              이전
            </button>
            <button
              className="btn ghost"
              type="button"
              onClick={() =>
                setCursor((c) =>
                  c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 },
                )
              }
            >
              다음
            </button>
          </div>
        </div>
        <div className="cal">
          {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
            <div key={d} className="hd">
              {d}
            </div>
          ))}
          {cells.map((d) => {
            const key = iso(d);
            const mute = d.getMonth() !== cursor.m;
            const dayTopics = topics.filter((t) => t.date === key);
            return (
              <button
                key={key}
                type="button"
                className={`day${mute ? " mute" : ""}${key === today ? " today" : ""}`}
                onClick={() => setSelected(key)}
                style={
                  key === selected
                    ? { background: "#eef5f1" }
                    : undefined
                }
              >
                <div style={{ fontSize: 12 }}>{d.getDate()}</div>
                {dayTopics.slice(0, 3).map((t) => {
                  const acc = accounts.find((a) => a.id === t.accountId);
                  return (
                    <Link
                      key={t.id}
                      href={`/editor/${t.id}`}
                      className="chip"
                      style={{ background: acc?.color ?? "#888" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {acc?.name} {t.keyword}
                    </Link>
                  );
                })}
                {dayTopics.length > 3 ? (
                  <span className="muted" style={{ fontSize: 10 }}>
                    +{dayTopics.length - 3}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <aside>
        <div className="card">
          <h2>{selected}</h2>
          {accounts.length === 0 ? (
            <p className="muted">계정을 먼저 만드세요.</p>
          ) : (
            <>
              <div className="field">
                <label>계정</label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} (한도 {a.dailyCap})
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>키워드</label>
                <input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder={selectedAccount?.keywords[0] ?? "키워드"}
                />
              </div>
              <div className="field">
                <label>의도</label>
                <select
                  value={intent}
                  onChange={(e) => setIntent(e.target.value as Intent)}
                >
                  {INTENTS.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>검색 질문</label>
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="30평 리모델링 기간은?"
                />
              </div>
              {error ? (
                <p className="muted" style={{ color: "var(--danger)" }}>
                  {error}
                </p>
              ) : null}
              <button
                className="btn primary"
                type="button"
                disabled={pending || !accountId}
                onClick={add}
              >
                이 날짜에 넣기
              </button>
              <button
                className="btn ghost"
                type="button"
                style={{ marginTop: 8, width: "100%" }}
                disabled={pending || !accountId}
                onClick={() => {
                  start(async () => {
                    const result = await planWeek(accountId, selected);
                    if (!result.ok) setError(result.error);
                    else router.refresh();
                  });
                }}
              >
                이 계정 7일 자동 배정
              </button>
            </>
          )}
        </div>

        <div className="card" style={{ marginTop: 12 }}>
          <h2>이 날 큐</h2>
          <div className="row-list">
            {topics.filter((t) => t.date === selected).length === 0 ? (
              <p className="muted">비어 있습니다.</p>
            ) : (
              topics
                .filter((t) => t.date === selected)
                .map((t) => {
                  const acc = accounts.find((a) => a.id === t.accountId);
                  return (
                    <div key={t.id} className="row-item" style={{ gridTemplateColumns: "10px 1fr auto" }}>
                      <i className="dot" style={{ background: acc?.color }} />
                      <Link href={`/editor/${t.id}`} style={{ fontSize: 13 }}>
                        {acc?.name} · {t.keyword}
                      </Link>
                      <button
                        className="btn danger"
                        type="button"
                        onClick={() =>
                          start(async () => {
                            await deleteTopic(t.id);
                            router.refresh();
                          })
                        }
                      >
                        삭제
                      </button>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
