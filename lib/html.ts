import type { Draft, DraftSection } from "./types";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** 이스케이프된 본문에서 메일·URL을 클릭 링크로 바꿉니다. 네이버 붙여넣기용. */
function linkify(escaped: string): string {
  const withUrls = escaped.replace(/https?:\/\/[^\s<>"']+/g, (url) => {
    const trimmed = url.replace(/[.,;:)]+$/, "");
    const rest = url.slice(trimmed.length);
    return `<a href="${trimmed}">${trimmed}</a>${rest}`;
  });
  return withUrls.replace(
    /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    '<a href="mailto:$1">$1</a>',
  );
}

function paragraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const html = linkify(escapeHtml(p).replace(/\n/g, "<br>"));
      return `<p>${html}</p>`;
    })
    .join("\n");
}

function imageHtml(section: DraftSection): string {
  if (section.imageUrl) {
    const alt = escapeHtml(section.imageSlot || section.heading);
    return `<p><img src="${escapeHtml(section.imageUrl)}" alt="${alt}"></p>`;
  }
  if (section.imageSlot) {
    return `<p><em>[이미지: ${escapeHtml(section.imageSlot)}]</em></p>`;
  }
  return "";
}

function sectionHtml(section: DraftSection): string {
  const heading = `<h2>${escapeHtml(section.heading)}</h2>`;
  const image = imageHtml(section);

  if (section.kind === "list" && section.listItems?.length) {
    const items = section.listItems
      .map((item) => `<li>${linkify(escapeHtml(item))}</li>`)
      .join("");
    return `${heading}\n${image}\n<ul>${items}</ul>\n${paragraphs(section.body)}`;
  }

  if (section.kind === "table" && section.table) {
    const th = section.table.headers
      .map((h) => `<th>${escapeHtml(h)}</th>`)
      .join("");
    const tr = section.table.rows
      .map(
        (row) =>
          `<tr>${row.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`,
      )
      .join("");
    return `${heading}\n${image}\n<table border="1" cellpadding="6"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>\n${paragraphs(section.body)}`;
  }

  return `${heading}\n${image}\n${paragraphs(section.body)}`;
}

export function draftToHtml(
  draft: Pick<Draft, "lead" | "sections" | "internalLinkHint"> & {
    leadImageUrl?: string;
  },
): string {
  const leadImage = draft.leadImageUrl
    ? `<p><img src="${escapeHtml(draft.leadImageUrl)}" alt=""></p>`
    : "";
  const parts = [
    paragraphs(draft.lead),
    leadImage,
    ...draft.sections.map(sectionHtml),
  ].filter(Boolean);
  if (draft.internalLinkHint) {
    parts.push(
      `<p>함께 보면 좋은 글: ${escapeHtml(draft.internalLinkHint)}</p>`,
    );
  }
  return parts.join("\n\n");
}

export function draftToPlain(draft: Draft): string {
  const lines = [
    draft.selectedTitle,
    "",
    draft.lead,
    "",
    ...draft.sections.flatMap((s) => [
      s.heading,
      s.imageUrl || (s.imageSlot ? `[이미지: ${s.imageSlot}]` : ""),
      s.kind === "list" ? (s.listItems ?? []).map((i) => `- ${i}`).join("\n") : "",
      s.body,
      "",
    ]),
    draft.internalLinkHint ? `함께 보면 좋은 글: ${draft.internalLinkHint}` : "",
    "",
    draft.tags.map((t) => `#${t}`).join(" "),
  ];
  return lines.filter((l) => l !== undefined).join("\n");
}
