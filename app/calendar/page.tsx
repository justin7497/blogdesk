import { CalendarBoard } from "@/components/CalendarBoard";
import { getDb, todayKst } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const db = await getDb();

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>달력</h1>
          <p>날짜를 눌러 주제를 넣습니다. 계정 하루 한도를 넘기면 거절합니다.</p>
        </div>
      </div>
      <CalendarBoard
        accounts={db.accounts}
        topics={db.topics}
        today={todayKst()}
      />
    </div>
  );
}
