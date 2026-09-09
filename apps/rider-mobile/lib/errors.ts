export function readableError(error: unknown, fallback: string) {
  const raw = error instanceof Error ? error.message : String(error || "");
  const jsonStart = raw.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(raw.slice(jsonStart));
      if (typeof parsed?.message === "string") return parsed.message;
    } catch {}
  }
  return raw && !raw.startsWith("Error") ? raw : fallback;
}
