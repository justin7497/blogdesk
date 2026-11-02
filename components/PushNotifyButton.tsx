"use client";

import { useEffect, useState } from "react";

type PushState = "loading" | "off" | "on" | "blocked" | "unsupported" | "ios";

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function urlBase64ToUint8Array(value: string): Uint8Array {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((ch) => ch.charCodeAt(0)));
}

export function PushNotifyButton() {
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setState(isIos() && !isStandalone() ? "ios" : "unsupported");
      return;
    }
    if (isIos() && !isStandalone()) {
      setState("ios");
      return;
    }
    if (Notification.permission === "denied") {
      setState("blocked");
      return;
    }
    void navigator.serviceWorker
      .getRegistration("/push-sw.js")
      .then(async (reg) => {
        const sub = await reg?.pushManager.getSubscription();
        setState(sub ? "on" : "off");
      })
      .catch(() => setState("off"));
  }, []);

  async function enable() {
    setBusy(true);
    setError("");
    try {
      const vapid = await fetch("/api/push/vapid");
      const keys = (await vapid.json()) as { publicKey?: string; error?: string };
      if (!vapid.ok || !keys.publicKey) {
        throw new Error(keys.error || "알림 키를 받지 못했습니다.");
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/push-sw.js");
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            keys.publicKey,
          ) as BufferSource,
        }));
      const json = sub.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "알림을 켜지 못했습니다.");
      setState("on");
    } catch (err) {
      setError(err instanceof Error ? err.message : "알림을 켜지 못했습니다.");
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError("");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "unsubscribe", endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("off");
    } catch (err) {
      setError(err instanceof Error ? err.message : "알림을 끄지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") return null;
  if (state === "unsupported") {
    return (
      <p className="muted" style={{ margin: 0 }}>
        이 브라우저는 폰 알림을 지원하지 않습니다.
      </p>
    );
  }
  if (state === "ios") {
    return (
      <p className="muted" style={{ margin: 0, maxWidth: 280 }}>
        아이폰은 공유 → 홈 화면에 추가한 뒤, 그 아이콘으로 열어야 승인 알림이
        울립니다.
      </p>
    );
  }
  if (state === "blocked") {
    return (
      <p className="muted" style={{ margin: 0 }}>
        브라우저에서 알림이 차단되어 있습니다.
      </p>
    );
  }

  return (
    <div>
      <button
        className="btn ghost"
        type="button"
        disabled={busy}
        onClick={() => void (state === "on" ? disable() : enable())}
      >
        {busy
          ? "알림 설정 중…"
          : state === "on"
            ? "승인 알림 켜짐"
            : "승인 알림 켜기"}
      </button>
      {error ? (
        <p className="error" style={{ margin: "6px 0 0" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
