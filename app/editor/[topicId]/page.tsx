import { notFound } from "next/navigation";
import { EditorClient } from "@/components/EditorClient";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function EditorPage({
  params,
}: {
  params: Promise<{ topicId: string }>;
}) {
  const { topicId } = await params;
  const db = await getDb();
  const topic = db.topics.find((t) => t.id === topicId);
  if (!topic) notFound();
  const account = db.accounts.find((a) => a.id === topic.accountId);
  if (!account) notFound();
  const draft = topic.draftId
    ? db.drafts.find((d) => d.id === topic.draftId)
    : undefined;
  const hasApiKey = Boolean(db.settings.apiKey);

  return (
    <EditorClient
      key={draft?.updatedAt ?? "empty"}
      account={account}
      topic={topic}
      draft={draft}
      hasApiKey={hasApiKey}
    />
  );
}
