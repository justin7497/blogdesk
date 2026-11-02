"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveSettings } from "@/lib/actions";
import {
  defaultModel,
  inferProvider,
  type ClientSettings,
  type Provider,
} from "@/lib/types";

const PROVIDERS: { id: Provider; label: string; hint: string }[] = [
  {
    id: "gemini",
    label: "구글 제미나이",
    hint: "Google AI Studio 키 · gemini-2.5-flash",
  },
  {
    id: "openai",
    label: "OpenAI",
    hint: "ChatGPT API 키 · gpt-4o",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    hint: "Claude API 키",
  },
];

const KNOWN_MODELS = PROVIDERS.map((p) => defaultModel(p.id));
const MASK = "••••••••••••";

function SecretField({
  label,
  name,
  value,
  onChange,
  stored,
  tail,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  stored: boolean;
  tail: string;
  placeholder: string;
}) {
  const [show, setShow] = useState(false);
  const masked = stored && (!value || value.includes("•"));
  return (
    <div className="field" style={{ marginTop: name === "apiKey" ? 0 : 20 }}>
      <label>
        {label}
        {stored ? (
          <span className="muted" style={{ marginLeft: 8, fontWeight: 500 }}>
            저장됨{tail ? ` · 끝자리 ${tail}` : ""}
          </span>
        ) : null}
      </label>
      <input
        name={name}
        type={show && !masked ? "text" : "password"}
        value={masked ? MASK : value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => {
          if (masked) e.currentTarget.select();
        }}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
      />
      {masked ? (
        <p className="muted" style={{ marginTop: 6 }}>
          서버에 저장되어 있습니다. 보안상 전체 키는 다시 보여주지 않습니다.
          바꿀 때만 붙여 넣으세요.
        </p>
      ) : (
        <button
          className="btn ghost"
          type="button"
          style={{ width: "fit-content", marginTop: 6 }}
          onClick={() => setShow((v) => !v)}
        >
          {show ? "키 숨기기" : "키 보이기"}
        </button>
      )}
    </div>
  );
}

export function SettingsForm({ settings }: { settings: ClientSettings }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [provider, setProvider] = useState<Provider>(settings.provider);
  const [model, setModel] = useState(
    settings.model || defaultModel(settings.provider),
  );
  const [apiKey, setApiKey] = useState(settings.hasKey ? MASK : "");
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState(
    settings.hasElevenLabs ? MASK : "",
  );
  const [typecastApiKey, setTypecastApiKey] = useState(
    settings.hasTypecast ? MASK : "",
  );
  const [openaiApiKey, setOpenaiApiKey] = useState(
    settings.hasOpenAI ? MASK : "",
  );
  const [hasKey, setHasKey] = useState(settings.hasKey);
  const [hasOpenAI, setHasOpenAI] = useState(settings.hasOpenAI);
  const [hasElevenLabs, setHasElevenLabs] = useState(settings.hasElevenLabs);
  const [hasTypecast, setHasTypecast] = useState(settings.hasTypecast);
  const [apiKeyTail, setApiKeyTail] = useState(settings.apiKeyTail);
  const [openaiKeyTail, setOpenaiKeyTail] = useState(settings.openaiKeyTail);
  const [elevenLabsKeyTail, setElevenLabsKeyTail] = useState(
    settings.elevenLabsKeyTail,
  );
  const [typecastKeyTail, setTypecastKeyTail] = useState(
    settings.typecastKeyTail,
  );
  const [ttsCheck, setTtsCheck] = useState("");
  const [ttsChecking, setTtsChecking] = useState(false);
  const [instagramUsername, setInstagramUsername] = useState(
    settings.instagramUsername || "soyeontem",
  );
  const [threadsUsername, setThreadsUsername] = useState(
    settings.threadsUsername || "soyeontem",
  );
  const [socialDisplayName, setSocialDisplayName] = useState(
    settings.socialDisplayName || "소연",
  );
  const [socialBio, setSocialBio] = useState(settings.socialBio || "");
  const [metaAccessToken, setMetaAccessToken] = useState(
    settings.hasMetaToken ? MASK : "",
  );
  const [hasMetaToken, setHasMetaToken] = useState(settings.hasMetaToken);
  const [threadsAccessToken, setThreadsAccessToken] = useState(
    settings.hasThreadsToken ? MASK : "",
  );
  const [hasThreadsToken, setHasThreadsToken] = useState(settings.hasThreadsToken);
  const [instagramUserId, setInstagramUserId] = useState(
    settings.instagramUserId || "",
  );
  const [threadsUserId, setThreadsUserId] = useState(settings.threadsUserId || "");
  const [socialAutoReply, setSocialAutoReply] = useState(
    settings.socialAutoReply !== false,
  );

  function pickProvider(next: Provider) {
    setProvider(next);
    setModel((current) =>
      !current || KNOWN_MODELS.includes(current) ? defaultModel(next) : current,
    );
  }

  function onKeyChange(value: string) {
    setApiKey(value);
    const next = inferProvider({ provider, apiKey: value, model });
    if (next !== provider) pickProvider(next);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(false);
        setError("");
        start(async () => {
          const result = await saveSettings({
            provider,
            apiKey,
            model,
            openaiApiKey,
            elevenLabsApiKey,
            elevenLabsVoiceId: settings.elevenLabsVoiceId,
            typecastApiKey,
            typecastVoiceId: settings.typecastVoiceId,
            ttsProvider: settings.ttsProvider,
            elevenLabsSpeed: settings.elevenLabsSpeed,
            typecastSpeed: settings.typecastSpeed,
            instagramUsername,
            threadsUsername,
            socialDisplayName,
            socialBio,
            metaAccessToken,
            threadsAccessToken,
            instagramUserId,
            threadsUserId,
            socialAutoReply,
          });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          if (result.provider !== provider) setProvider(result.provider);
          if (!result.keptApiKey) {
            setHasKey(true);
            setApiKey(MASK);
            setApiKeyTail(apiKey.trim().slice(-4));
          }
          if (!result.keptOpenAI) {
            setHasOpenAI(true);
            setOpenaiApiKey(MASK);
            setOpenaiKeyTail(openaiApiKey.trim().slice(-4));
          }
          if (!result.keptElevenLabs) {
            setHasElevenLabs(true);
            setElevenLabsApiKey(MASK);
            setElevenLabsKeyTail(elevenLabsApiKey.trim().slice(-4));
          }
          if (!result.keptTypecast) {
            setHasTypecast(true);
            setTypecastApiKey(MASK);
            setTypecastKeyTail(typecastApiKey.trim().slice(-4));
          }
          if (!result.keptMeta) {
            setHasMetaToken(true);
            setMetaAccessToken(MASK);
          }
          if (!result.keptThreads) {
            setHasThreadsToken(true);
            setThreadsAccessToken(MASK);
          }
          setSaved(true);
          router.refresh();
        });
      }}
    >
      <div className="field">
        <label>모델 제공자</label>
        <div className="provider-picks">
          {PROVIDERS.map((p) => (
            <label
              key={p.id}
              className={`provider-pick${provider === p.id ? " is-on" : ""}`}
            >
              <input
                type="radio"
                name="providerPick"
                value={p.id}
                checked={provider === p.id}
                onChange={() => pickProvider(p.id)}
              />
              <span>
                <b>{p.label}</b>
                <span>{p.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </div>
      <div className="field">
        <label>모델 이름</label>
        <input
          name="model"
          value={model}
          onChange={(e) => {
            const value = e.target.value;
            setModel(value);
            const next = inferProvider({ provider, apiKey, model: value });
            if (next !== provider) setProvider(next);
          }}
          placeholder={defaultModel(provider)}
        />
      </div>
      <SecretField
        label="API 키"
        name="apiKey"
        value={apiKey}
        onChange={onKeyChange}
        stored={hasKey}
        tail={apiKeyTail}
        placeholder={
          provider === "gemini"
            ? "AIza로 시작하는 키를 붙여 넣으세요"
            : provider === "anthropic"
              ? "sk-ant-..."
              : "sk-..."
        }
      />
      <p className="muted">
        AIza로 시작하는 키는 구글 제미나이로 자동 저장됩니다. 블로그 초안에
        쓰입니다.
      </p>
      <SecretField
        label="OpenAI API 키 (쇼츠 대본)"
        name="openaiApiKey"
        value={openaiApiKey}
        onChange={setOpenaiApiKey}
        stored={hasOpenAI}
        tail={openaiKeyTail}
        placeholder="sk-... gpt-4o"
      />
      <p className="muted">
        쇼츠 메이커는 제미나이가 아니라 OpenAI gpt-4o로 장면을 읽습니다.
      </p>
      <SecretField
        label="ElevenLabs API 키"
        name="elevenLabsApiKey"
        value={elevenLabsApiKey}
        onChange={setElevenLabsApiKey}
        stored={hasElevenLabs}
        tail={elevenLabsKeyTail}
        placeholder="xi... 또는 sk_ 로 시작하는 키"
      />
      <p className="muted">
        쇼츠 메이커 나레이션에 사용합니다. 기본 보이스는 Anna Kim이고, 쇼츠
        화면에서 VIV로 바꿀 수 있습니다.
      </p>
      <SecretField
        label="타입캐스트 API 키"
        name="typecastApiKey"
        value={typecastApiKey}
        onChange={setTypecastApiKey}
        stored={hasTypecast}
        tail={typecastKeyTail}
        placeholder="Typecast API 콘솔에서 발급한 키"
      />
      <p className="muted">
        한국어 연기 보이스(민주·필재)로 나레이션할 때 사용합니다. 키를 저장한 뒤
        연결 확인을 눌러 주세요.
      </p>
      <div className="actions" style={{ marginTop: 8 }}>
        <button
          className="btn secondary"
          type="button"
          disabled={ttsChecking || !hasTypecast}
          onClick={() => {
            setTtsCheck("");
            setTtsChecking(true);
            void fetch("/api/shorts/verify-tts")
              .then(async (res) => {
                const data = (await res.json()) as {
                  typecast?: {
                    ok?: boolean;
                    error?: string;
                    count?: number;
                    featured?: { label: string; found: boolean }[];
                  };
                };
                if (!res.ok) throw new Error("연결 확인에 실패했습니다.");
                const featured = (data.typecast?.featured ?? [])
                  .map((item) => `${item.label} ${item.found ? "확인" : "없음"}`)
                  .join(" · ");
                if (!data.typecast?.ok) {
                  throw new Error(
                    data.typecast?.error ||
                      featured ||
                      "민주·필재 보이스를 찾지 못했습니다.",
                  );
                }
                setTtsCheck(
                  `연결됨 · 보이스 ${data.typecast.count ?? 0}개 · ${featured}`,
                );
              })
              .catch((err) => {
                setTtsCheck(
                  err instanceof Error ? err.message : "연결 확인에 실패했습니다.",
                );
              })
              .finally(() => setTtsChecking(false));
          }}
        >
          {ttsChecking ? "확인 중…" : "타입캐스트 연결 확인"}
        </button>
      </div>
      {ttsCheck ? (
        <p className="muted" style={{ marginTop: 8 }}>
          {ttsCheck}
        </p>
      ) : null}
      <div className="field" style={{ marginTop: 28 }}>
        <label>인스타그램 아이디</label>
        <input
          value={instagramUsername}
          onChange={(e) => setInstagramUsername(e.target.value)}
          placeholder="soyeontem"
        />
      </div>
      <div className="field">
        <label>스레드 아이디</label>
        <input
          value={threadsUsername}
          onChange={(e) => setThreadsUsername(e.target.value)}
          placeholder="soyeontem"
        />
      </div>
      <div className="field">
        <label>표시 이름</label>
        <input
          value={socialDisplayName}
          onChange={(e) => setSocialDisplayName(e.target.value)}
          placeholder="소연"
        />
      </div>
      <div className="field">
        <label>계정 소개</label>
        <textarea
          value={socialBio}
          onChange={(e) => setSocialBio(e.target.value)}
          placeholder="퇴근 후 힐링 꿀템"
        />
      </div>
      <SecretField
        label="인스타그램 액세스 토큰"
        name="metaAccessToken"
        value={metaAccessToken}
        onChange={setMetaAccessToken}
        stored={hasMetaToken}
        tail=""
        placeholder="Instagram Graph API 토큰"
      />
      <SecretField
        label="스레드 액세스 토큰"
        name="threadsAccessToken"
        value={threadsAccessToken}
        onChange={setThreadsAccessToken}
        stored={hasThreadsToken}
        tail=""
        placeholder="Threads Graph API 토큰"
      />
      {settings.instagramTokenOk === false ? (
        <p className="error">
          인스타그램 토큰: {settings.instagramTokenError || "확인이 필요합니다."}
        </p>
      ) : null}
      {settings.threadsTokenOk === false ? (
        <p className="error">
          스레드 토큰: {settings.threadsTokenError || "확인이 필요합니다."}
        </p>
      ) : null}
      {settings.tokenCheckedAt ? (
        <p className="muted">
          마지막 토큰 확인{" "}
          {new Date(settings.tokenCheckedAt).toLocaleString("ko-KR")}
        </p>
      ) : (
        <p className="muted">토큰은 댓글 동기화 때 자동으로 확인합니다.</p>
      )}
      <div className="field">
        <label>인스타그램 사용자 ID</label>
        <input
          value={instagramUserId}
          onChange={(e) => setInstagramUserId(e.target.value)}
          placeholder="숫자 ID"
        />
      </div>
      <div className="field">
        <label>스레드 사용자 ID</label>
        <input
          value={threadsUserId}
          onChange={(e) => setThreadsUserId(e.target.value)}
          placeholder="숫자 ID"
        />
      </div>
      <label className="ig-emphasis" style={{ marginTop: 12 }}>
        <input
          type="checkbox"
          checked={socialAutoReply}
          onChange={(e) => setSocialAutoReply(e.target.checked)}
        />
        공감·투표 댓글 자동 답신
      </label>
      <p className="muted">
        인스타·스레드 글은 @soyeontem 말투로 만듭니다. 댓글은 Meta 공식 API로만
        가져오고, 공감·투표만 15~40분 뒤 자동 답합니다.
      </p>
      <button className="btn primary" type="submit" disabled={pending} style={{ marginTop: 12 }}>
        {pending ? "저장 중…" : "저장"}
      </button>
      {saved ? (
        <span className="muted" style={{ marginLeft: 10 }}>
          저장됨 · {provider === "gemini" ? "구글 제미나이" : provider}
        </span>
      ) : null}
      {error ? (
        <p className="muted" style={{ marginTop: 12, color: "var(--danger)" }}>
          {error}
        </p>
      ) : null}
    </form>
  );
}
