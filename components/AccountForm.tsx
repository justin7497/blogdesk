"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteAccount, upsertAccount } from "@/lib/actions";
import { ACCOUNT_COLORS, type Account, type Honorific } from "@/lib/types";

type Props = { account?: Account };

export function AccountForm({ account }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [keywords, setKeywords] = useState(
    account?.keywords.join(", ") ?? "",
  );

  function onSubmit(formData: FormData) {
    setError("");
    start(async () => {
      const honorific = String(formData.get("honorific") || "합니다") as Honorific;
      const result = await upsertAccount({
        id: account?.id,
        name: String(formData.get("name") || ""),
        blogUrl: String(formData.get("blogUrl") || ""),
        niche: String(formData.get("niche") || ""),
        region: String(formData.get("region") || ""),
        tone: String(formData.get("tone") || ""),
        honorific,
        forbidden: String(formData.get("forbidden") || ""),
        keywords: keywords.split(/[,/\n]/).map((k) => k.trim()),
        dailyCap: Number(formData.get("dailyCap") || 1),
        evidenceNotes: String(formData.get("evidenceNotes") || ""),
        sampleWriting: String(formData.get("sampleWriting") || ""),
        color: String(formData.get("color") || ACCOUNT_COLORS[0]),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/accounts");
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="card">
      <div className="form-grid">
        <div className="field">
          <label>블로그 이름</label>
          <input name="name" defaultValue={account?.name} required />
        </div>
        <div className="field">
          <label>블로그 URL</label>
          <input
            name="blogUrl"
            defaultValue={account?.blogUrl}
            placeholder="https://blog.naver.com/..."
          />
        </div>
        <div className="field">
          <label>업종 · 한 가지 주제</label>
          <input
            name="niche"
            defaultValue={account?.niche}
            placeholder="분당 인테리어"
            required
          />
        </div>
        <div className="field">
          <label>지역</label>
          <input name="region" defaultValue={account?.region} placeholder="성남 분당" />
        </div>
        <div className="field">
          <label>말투</label>
          <input
            name="tone"
            defaultValue={account?.tone}
            placeholder="현장감 있는 담담한 전문가"
          />
        </div>
        <div className="field">
          <label>어미</label>
          <select name="honorific" defaultValue={account?.honorific ?? "합니다"}>
            <option value="합니다">합니다</option>
            <option value="해요">해요</option>
          </select>
        </div>
        <div className="field">
          <label>하루 발행 한도 (1–3)</label>
          <input
            name="dailyCap"
            type="number"
            min={1}
            max={3}
            defaultValue={account?.dailyCap ?? 1}
          />
        </div>
        <div className="field">
          <label>캘린더 색</label>
          <select name="color" defaultValue={account?.color ?? ACCOUNT_COLORS[0]}>
            {ACCOUNT_COLORS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label>대표 키워드 (쉼표로 구분)</label>
        <textarea
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="30평 리모델링, 부분 공사, 주방 교체"
        />
      </div>
      <div className="field">
        <label>금지 표현</label>
        <input
          name="forbidden"
          defaultValue={account?.forbidden}
          placeholder="1등, 효과 보장, 무조건"
        />
      </div>
      <div className="field">
        <label>증거 노트 (숫자, 기간, 실제 사례 — AI가 사실로만 사용)</label>
        <textarea
          name="evidenceNotes"
          defaultValue={account?.evidenceNotes}
          placeholder="2024년 분당 30평 주방 3주, 철거 포함 견적 범위 …"
        />
      </div>
      <div className="field">
        <label>말투 샘플 (직접 쓴 문단 2~4줄)</label>
        <textarea
          name="sampleWriting"
          defaultValue={account?.sampleWriting}
        />
      </div>

      {error ? (
        <p className="muted" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      ) : null}

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? "저장 중…" : "저장"}
        </button>
        {account ? (
          <button
            className="btn danger"
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm("이 계정과 관련 글 예정을 지울까요?")) return;
              start(async () => {
                await deleteAccount(account.id);
                router.push("/accounts");
                router.refresh();
              });
            }}
          >
            삭제
          </button>
        ) : null}
      </div>
    </form>
  );
}
