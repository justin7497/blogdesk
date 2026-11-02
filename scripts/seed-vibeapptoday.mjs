import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dbToFields, fieldsToDb } from "./to-firestore.mjs";
import {
  TITLE,
  TITLES,
  LEAD,
  SECTIONS,
  TAGS,
  buildHtml,
} from "../lib/vibe-first-draft.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const PROJECT = "blogdesk-ljh";
const DOC =
  `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/desk/state`;

const ACCOUNT_ID = "acc_vibeapptoday";
const TOPIC_ID = "top_vibe_first";
const DRAFT_ID = "dft_vibe_first";
const NOW = new Date().toISOString();
const DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

function token() {
  const fromEnv = process.env.GCLOUD_ACCESS_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  throw new Error("GCLOUD_ACCESS_TOKEN 환경 변수가 필요합니다.");
}

function emptyDb() {
  return {
    settings: { provider: "openai", apiKey: "", model: "gpt-4o" },
    accounts: [],
    topics: [],
    drafts: [],
  };
}

const account = {
  id: ACCOUNT_ID,
  name: "바이브앱투데이",
  blogUrl: "https://blog.naver.com/vibeapptoday",
  niche: "네이버 블로그 광고 대행",
  region: "경기 화성",
  tone: "사장님에게 말하는 담담한 전문가",
  honorific: "합니다",
  forbidden: "1등, 효과 보장, 무조건, 순위 보장, 허위 후기, 계약 실적 과장",
  keywords: [
    "블로그대행",
    "네이버블로그대행",
    "매장전용앱",
    "바이브앱투데이",
    "소상공인마케팅",
  ],
  dailyCap: 1,
  evidenceNotes:
    "자체 앱 4종: 하트링크투데이, 이지코웍스, 소원로또, 나야나야. Google Play 3종 직접 운영. GS25 송산 직영 2곳. 전용 앱 시연: https://store-hq-ljh.web.app/ (한옥카페 월하, 계약 실적 아님). 공식 사이트 https://www.vibeapptoday.com . 바른주택은 주택 파일럿 후보다.",
  sampleWriting:
    "바이브앱투데이의 주력은 네이버 블로그 광고 대행입니다. 기존 대행과 다른 점은 하나입니다. 글을 쓰고 끝나는 게 아니라, 사장님 매장 전용 앱을 드립니다. 금액은 별도 협의입니다.",
  color: "#c4a574",
  createdAt: NOW,
};

const topic = {
  id: TOPIC_ID,
  accountId: ACCOUNT_ID,
  date: DATE,
  keyword: "블로그대행",
  intent: "info",
  question: "블로그 대행을 맡기면 글을 어떻게 확인하고 의견을 남기나요?",
  status: "draft",
  draftId: DRAFT_ID,
  createdAt: NOW,
};

const html = buildHtml();

const draft = {
  id: DRAFT_ID,
  topicId: TOPIC_ID,
  accountId: ACCOUNT_ID,
  titles: TITLES,
  selectedTitle: TITLE,
  lead: LEAD,
  sections: SECTIONS,
  tags: TAGS,
  evidenceUsed:
    "시연 앱 store-hq-ljh.web.app, 자체 앱 4종, Play 3종, 공식 사이트 www.vibeapptoday.com",
  internalLinkHint: "",
  html,
  uniqueness: {
    score: 0,
    blocked: false,
    warning: false,
    matches: [],
    notes: ["다른 계정 글과 충분히 갈라져 있습니다."],
  },
  createdAt: NOW,
  updatedAt: NOW,
};

function upsert(list, item) {
  const idx = list.findIndex((x) => x.id === item.id);
  if (idx >= 0) list[idx] = { ...list[idx], ...item };
  else list.push(item);
}

async function loadRemote(auth) {
  const res = await fetch(DOC, { headers: { Authorization: `Bearer ${auth}` } });
  if (res.status === 404) return emptyDb();
  if (!res.ok) {
    throw new Error(`읽기 실패 ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  const db = fieldsToDb(json.fields);
  return {
    settings: db.settings ?? emptyDb().settings,
    accounts: db.accounts ?? [],
    topics: db.topics ?? [],
    drafts: db.drafts ?? [],
  };
}

async function saveRemote(auth, db) {
  const res = await fetch(DOC, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: dbToFields(db) }),
  });
  if (!res.ok) {
    throw new Error(`저장 실패 ${res.status}: ${await res.text()}`);
  }
}

async function main() {
  const auth = token();
  const db = await loadRemote(auth);
  upsert(db.accounts, account);
  upsert(db.topics, topic);
  upsert(db.drafts, draft);
  await saveRemote(auth, db);

  await mkdir(path.join(ROOT, "data"), { recursive: true });
  await writeFile(
    path.join(ROOT, "data", "db.json"),
    JSON.stringify(db, null, 2),
    "utf8",
  );
  await writeFile(
    path.join(ROOT, "data", "vibeapptoday-naver.html"),
    html,
    "utf8",
  );

  const copyPage = `D:\\project\\15-VibeCode Page\\public\\posts\\naver-copy.html`;
  await writeFile(
    copyPage,
    `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>네이버 붙여넣기용 HTML | 바이브앱투데이</title>
<style>
body{font-family:Pretendard,sans-serif;max-width:760px;margin:40px auto;padding:0 20px;line-height:1.7;color:#1c2130}
label{display:block;font-weight:700;margin:18px 0 8px}
input,textarea{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #ddd;border-radius:10px;font:inherit}
textarea{min-height:280px}
.preview{border:1px solid #e8e1d6;border-radius:16px;padding:24px;background:#fff}
.note{background:#f7f4ef;padding:14px 16px;border-radius:12px;font-size:.92rem}
button{margin-top:8px;background:#0d9488;color:#fff;border:0;padding:10px 16px;border-radius:999px;font-weight:700;cursor:pointer}
</style>
</head>
<body>
<h1>네이버 스마트에디터에 붙여넣기</h1>
<p class="note">제목을 복사한 뒤, 본문 HTML을 스마트에디터 <b>HTML</b> 모드에 붙여 넣으세요. 사진은 <code>01-store-app.png</code>를 이미지 슬롯 자리에 올리면 됩니다.</p>
<label>제목</label>
<input id="title" value="${TITLE.replace(/"/g, "&quot;")}">
<button type="button" onclick="navigator.clipboard.writeText(document.getElementById('title').value)">제목 복사</button>
<label>태그</label>
<input value="${TAGS.join(", ")}">
<label>본문 HTML</label>
<textarea id="html">${html.replace(/</g, "&lt;")}</textarea>
<button type="button" onclick="navigator.clipboard.writeText(document.getElementById('html').value)">본문 HTML 복사</button>
<h2>미리보기</h2>
<div class="preview">${html}</div>
</body>
</html>
`,
    "utf8",
  );

  console.log("saved account", ACCOUNT_ID);
  console.log("editor https://blogdesk-ljh.web.app/editor/" + TOPIC_ID);
  console.log("html bytes", Buffer.byteLength(html, "utf8"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
