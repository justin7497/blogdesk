import Link from "next/link";
import { StatusPill } from "@/components/StatusPill";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function BlogDraftsPage() {
  const db = await getDb();
  const items = [...db.topics].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>블로그 초안</h1>
          <p>계정별 원고. 초안을 열면 제출용 전체 편집본으로 보입니다.</p>
        </div>
        <Link className="btn primary" href="/calendar">
          + 캠페인 작성
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="empty">아직 초안이 없습니다. 달력에서 주제를 넣으세요.</div>
      ) : (
        <div className="row-list">
          {items.map((t) => {
            const acc = db.accounts.find((a) => a.id === t.accountId);
            const draft = t.draftId
              ? db.drafts.find((d) => d.id === t.draftId)
              : undefined;
            return (
              <Link key={t.id} href={`/editor/${t.id}`} className="row-item">
                <i className="dot" style={{ background: acc?.color ?? "#3f7d55" }} />
                <div>
                  <div>{draft?.selectedTitle || t.keyword}</div>
                  <div className="muted">
                    {t.date} · {acc?.name} · {t.keyword}
                  </div>
                </div>
                <StatusPill status={t.status} />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
