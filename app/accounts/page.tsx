import Link from "next/link";
import { getAccounts } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const accounts = await getAccounts();

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>블로그</h1>
          <p>
            연결된 네이버 계정. 업종·키워드·증거는 서로 넘기지 않습니다.
          </p>
        </div>
        <Link className="btn primary" href="/accounts/new">
          + 블로그 연결
        </Link>
      </div>

      {accounts.length === 0 ? (
        <div className="empty">아직 연결된 블로그가 없습니다.</div>
      ) : (
        <div className="row-list">
          {accounts.map((a) => (
            <Link key={a.id} href={`/accounts/${a.id}`} className="row-item">
              <i className="dot" style={{ background: a.color }} />
              <div>
                <div>{a.name}</div>
                <div className="muted">
                  {a.niche}
                  {a.region ? ` · ${a.region}` : ""} · 하루 {a.dailyCap}편 ·{" "}
                  {a.keywords.slice(0, 4).join(", ") || "키워드 없음"}
                </div>
              </div>
              <span className="muted">{a.honorific}체</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
