export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export function asErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "알 수 없는 오류";
}
