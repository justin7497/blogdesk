import { getAccounts } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function IdeasPage() {
  const accounts = await getAccounts();
  const ideas = accounts.flatMap((a) =>
    a.keywords.map((k) => ({ account: a.name, color: a.color, keyword: k })),
  );

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>아이디어 뱅크</h1>
          <p>계정에 적어 둔 키워드가 글감입니다. 계정 사이를 섞지 않습니다.</p>
        </div>
      </div>
      {ideas.length === 0 ? (
        <div className="empty">계정 키워드가 없습니다.</div>
      ) : (
        <div className="card-grid">
          {ideas.map((idea) => (
            <div key={`${idea.account}-${idea.keyword}`} className="idea-card">
              <h3>{idea.keyword}</h3>
              <p className="muted">
                <i className="dot" style={{ background: idea.color, marginRight: 6 }} />
                {idea.account}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
