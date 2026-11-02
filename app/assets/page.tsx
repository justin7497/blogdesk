import { getAccounts } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AssetsPage() {
  const accounts = await getAccounts();

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>현장 자산</h1>
          <p>계정별 증거 노트. 글 생성 때 사실로만 집어넣습니다.</p>
        </div>
      </div>
      {accounts.length === 0 ? (
        <div className="empty">연결된 블로그가 없습니다.</div>
      ) : (
        <div className="card-grid">
          {accounts.map((a) => (
            <div key={a.id} className="idea-card">
              <h3>{a.name}</h3>
              <p className="muted">{a.niche}</p>
              <p>{a.evidenceNotes || "증거 노트가 비어 있습니다."}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
