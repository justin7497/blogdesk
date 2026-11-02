import { SettingsForm } from "@/components/SettingsForm";
import { getClientSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getClientSettings();

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>설정</h1>
          <p>블로그는 제미나이/OpenAI/Claude, 쇼츠 대본은 OpenAI. 키는 서버에만 저장됩니다.</p>
        </div>
      </div>
      <div className="panel" style={{ maxWidth: 560 }}>
        <SettingsForm settings={settings} />
      </div>
    </div>
  );
}
