import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dbToFields, fieldsToDb } from "./to-firestore.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const PROJECT = "blogdesk-ljh";
const DOC =
  `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/desk/state`;
const LOCAL = path.join(ROOT, "data", "db.json");

function emptyDb() {
  return {
    settings: { provider: "openai", apiKey: "", model: "gpt-4o" },
    accounts: [],
    topics: [],
    drafts: [],
  };
}

async function loadRemote(auth) {
  const res = await fetch(DOC, { headers: { Authorization: `Bearer ${auth}` } });
  if (res.status === 404) return emptyDb();
  if (!res.ok) throw new Error(`읽기 실패 ${res.status}: ${await res.text()}`);
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
  if (!res.ok) throw new Error(`저장 실패 ${res.status}: ${await res.text()}`);
}

async function main() {
  const auth = process.env.GCLOUD_ACCESS_TOKEN?.trim();
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!auth) throw new Error("GCLOUD_ACCESS_TOKEN 필요");
  if (!apiKey) throw new Error("GEMINI_API_KEY 필요");

  const settings = {
    provider: "gemini",
    apiKey,
    model: "gemini-2.5-flash",
  };

  const db = await loadRemote(auth);
  db.settings = settings;
  await saveRemote(auth, db);

  let local = emptyDb();
  try {
    local = JSON.parse(await readFile(LOCAL, "utf8"));
  } catch {
    local = db;
  }
  local.settings = settings;
  await writeFile(LOCAL, JSON.stringify(local, null, 2), "utf8");

  console.log("saved gemini settings", apiKey.slice(0, 6) + "…");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
