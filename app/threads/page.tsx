import { InstagramDesk } from "@/components/InstagramDesk";
import { ensureSocialAccount, getClientSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ThreadsPage() {
  await ensureSocialAccount();
  const settings = await getClientSettings();
  return <InstagramDesk settings={settings} channel="threads" />;
}
