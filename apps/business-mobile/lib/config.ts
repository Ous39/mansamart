import Constants from "expo-constants";

function expoHostUri(): string | null {
  const anyConstants = Constants as any;
  return (
    Constants.expoConfig?.hostUri ||
    anyConstants.manifest2?.extra?.expoClient?.hostUri ||
    anyConstants.manifest?.debuggerHost ||
    null
  );
}

function hostFromExpoUri(uri: string | null): string | null {
  if (!uri) return null;
  const withoutProtocol = uri.replace(/^https?:\/\//i, "");
  const host = withoutProtocol.split(/[/:]/)[0];
  return host || null;
}

function inferDevApiUrl(): string | null {
  const host = hostFromExpoUri(expoHostUri());
  return host ? `http://${host}:5000` : null;
}

export const API_BASE_URL = normalizeApiUrl(
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.EXPO_PUBLIC_DOMAIN ||
  inferDevApiUrl() ||
  "http://127.0.0.1:5000",
);

function normalizeApiUrl(value: string): string {
  const trimmed = value.trim().replace(/\/$/, "");
  if (!trimmed) return inferDevApiUrl() || "http://127.0.0.1:5000";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
}
