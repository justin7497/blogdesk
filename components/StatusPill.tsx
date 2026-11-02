import { STATUS_LABEL } from "@/lib/labels";
import type { TopicStatus } from "@/lib/types";

export function StatusPill({ status }: { status: TopicStatus }) {
  return <span className={`pill ${status}`}>{STATUS_LABEL[status]}</span>;
}
