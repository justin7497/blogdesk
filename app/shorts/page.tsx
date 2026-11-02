import { ShortsMaker } from "@/components/ShortsMaker";
import { getClientSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ShortsPage() {
  const settings = await getClientSettings();
  return <ShortsMaker settings={settings} />;
}
