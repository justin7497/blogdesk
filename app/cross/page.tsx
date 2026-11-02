import Link from "next/link";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CrossBoardPage() {
  const db = await getDb();

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>교차 보드</h1>
          <p>계정 칸이 섞이지 않습니다. 같은 초안을 옆으로 복사하지 마세요.</p>
        </div>
      </div>

      {db.accounts.length === 0 ? (
        <div className="empty">연결된 블로그가 없습니다.</div>
      ) : (
        <div className="cross-board">
          {db.accounts.map((acc) => {
            const topics = db.topics
              .filter((t) => t.accountId === acc.id)
              .sort((a, b) => a.date.localeCompare(b.date));
            return (
              <div key={acc.id} className="cross-col">
                <h3>
                  <i className="dot" style={{ background: acc.color, marginRight: 8 }} />
                  {acc.name}
                </h3>
                <p className="muted" style={{ marginTop: 0 }}>
                  {acc.niche} · 하루 {acc.dailyCap}편
                </p>
                {topics.length === 0 ? (
                  <p className="muted">비어 있음</p>
                ) : (
                  topics.slice(0, 12).map((t) => (
                    <Link
                      key={t.id}
                      href={`/editor/${t.id}`}
                      className="chip"
                      style={{ background: acc.color, display: "block" }}
                    >
                      {t.date} {t.keyword}
                    </Link>
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
