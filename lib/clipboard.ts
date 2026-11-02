function copyViaExecCommand(text: string, html?: string): void {
  const container = document.createElement("div");
  container.setAttribute("contenteditable", "true");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";

  if (html) {
    container.innerHTML = html;
  } else {
    container.textContent = text;
  }

  document.body.appendChild(container);

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(container);
  selection?.removeAllRanges();
  selection?.addRange(range);

  const ok = document.execCommand("copy");
  selection?.removeAllRanges();
  document.body.removeChild(container);

  if (!ok) {
    throw new Error("execCommand copy failed");
  }
}

export async function copyText(text: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // unfocused document 등
  }
  copyViaExecCommand(text);
}

/** 네이버 스마트에디터에 서식으로 붙여넣기용. 소스가 아니라 text/html로 넣습니다. */
export async function copyHtml(html: string, plainText: string): Promise<void> {
  try {
    if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
      const item = new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plainText], { type: "text/plain" }),
      });
      await navigator.clipboard.write([item]);
      return;
    }
  } catch {
    // Fall through.
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(plainText);
      return;
    }
  } catch {
    // Fall through.
  }

  copyViaExecCommand(plainText, html);
}

export function htmlToPlain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/h2>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function blogWriteUrl(blogUrl: string): string | null {
  const match = blogUrl.match(/blog\.naver\.com\/([^/?#]+)/i);
  if (!match?.[1]) return null;
  return `https://blog.naver.com/${match[1]}?Redirect=Write&`;
}
