import { AccountForm } from "@/components/AccountForm";

export default function NewAccountPage() {
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>블로그 연결</h1>
          <p>한 계정, 한 주제. 주제가 섞이면 C-랭크가 안 붙습니다.</p>
        </div>
      </div>
      <AccountForm />
    </div>
  );
}
