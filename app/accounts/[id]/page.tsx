import { notFound } from "next/navigation";
import { AccountForm } from "@/components/AccountForm";
import { getAccount } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function EditAccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const account = await getAccount(id);
  if (!account) notFound();

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{account.name}</h1>
          <p>증거 노트와 말투 샘플이 많을수록 AI 일반론이 줄어듭니다.</p>
        </div>
      </div>
      <AccountForm account={account} />
    </div>
  );
}
