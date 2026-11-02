import { Logo } from "@/components/Logo";
import { INTENT_LABEL, STATUS_LABEL } from "@/lib/labels";
import type { Account, Draft, Topic } from "@/lib/types";

function LinkedText({ text }: { text: string }) {
  const parts = text.split(
    /(https?:\/\/[^\s<>"']+|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
  );
  return (
    <>
      {parts.map((part, i) => {
        if (/^https?:\/\//.test(part)) {
          const href = part.replace(/[.,;:)]+$/, "");
          const rest = part.slice(href.length);
          return (
            <span key={i}>
              <a href={href} target="_blank" rel="noopener">
                {href}
              </a>
              {rest}
            </span>
          );
        }
        if (part.includes("@") && part.includes(".")) {
          return (
            <a key={i} href={`mailto:${part}`}>
              {part}
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

export function ArticlePreview({
  account,
  topic,
  draft,
}: {
  account: Account;
  topic: Topic;
  draft?: Draft;
}) {
  const title = draft?.selectedTitle || topic.question || topic.keyword;
  const tags = draft?.tags ?? [];

  return (
    <article className="blog-article">
      <header className="blog-article-head">
        <div className="blog-article-brand">
          <Logo size={36} />
          <div>
            <strong>{account.name}</strong>
            <span>
              {STATUS_LABEL[topic.status]} · {account.honorific}체
            </span>
          </div>
        </div>
        <p className="blog-article-cat">
          {account.niche}
          {account.region ? ` / ${account.region}` : ""} · {INTENT_LABEL[topic.intent]}
        </p>
        <h1>{title}</h1>
        {topic.question ? (
          <p className="blog-article-sub">{topic.question}</p>
        ) : null}
        <p className="blog-article-meta">
          {topic.date}
          {account.blogUrl ? ` · ${account.blogUrl}` : ""}
        </p>
      </header>

      {draft ? (
        <>
          {draft.lead.split(/\n{2,}/).map((p, i) => (
            <p key={`lead-${i}`} className="blog-article-p">
              <LinkedText text={p} />
            </p>
          ))}
          {draft.leadImageUrl ? (
            <figure className="blog-article-figure">
              <img src={draft.leadImageUrl} alt="" />
            </figure>
          ) : null}

          {draft.sections.map((section, idx) => (
            <section key={idx}>
              <h2 className="blog-article-h2">{section.heading}</h2>
              {section.imageUrl ? (
                <figure className="blog-article-figure">
                  <img src={section.imageUrl} alt={section.imageSlot || section.heading} />
                </figure>
              ) : section.imageSlot ? (
                <div className="blog-article-slot">
                  이미지 슬롯 · {section.imageSlot}
                  <div style={{ marginTop: 6, fontSize: 12 }}>
                    네이버에 붙인 뒤 이 계정 현장 사진을 올립니다.
                  </div>
                </div>
              ) : null}
              {section.kind === "list" && section.listItems?.length ? (
                <ul>
                  {section.listItems.filter(Boolean).map((item) => (
                    <li key={item}>
                      <LinkedText text={item} />
                    </li>
                  ))}
                </ul>
              ) : null}
              {section.kind === "table" && section.table ? (
                <table className="blog-article-specs">
                  <thead>
                    <tr>
                      {section.table.headers.map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.table.rows.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((c, ci) => (
                          <td key={ci}>{c}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
              {section.body
                ? section.body.split(/\n{2,}/).map((p, i) => (
                    <p key={`${idx}-p-${i}`} className="blog-article-p">
                      <LinkedText text={p} />
                    </p>
                  ))
                : null}
            </section>
          ))}

          <div className="blog-article-cta">
            <p>
              {draft.internalLinkHint
                ? `함께 보면 좋은 글: ${draft.internalLinkHint}`
                : `${account.niche} 이야기로 이 블로그만 이어서 쌓습니다.`}
            </p>
            {tags.length ? (
              <p className="blog-article-tags">
                {tags.map((t) => `#${t}`).join(" ")}
              </p>
            ) : null}
          </div>
        </>
      ) : (
        <div className="blog-article-slot">
          초안이 없습니다. 위에서 생성하면 이 자리에 완성 글이 보입니다.
        </div>
      )}
    </article>
  );
}
