import type { Metadata } from "next";
import { StrategyDesk } from "@/components/StrategyDesk";

export const metadata: Metadata = {
  title: "수주 전략 · 체크리스트 | 컨텐츠데스크",
  description:
    "바이브앱투데이 블로그 대행 수주 전략, 28일 체크리스트, SEO 세팅 키트",
  robots: { index: false, follow: false },
};

export default function StrategyPage() {
  return <StrategyDesk />;
}
