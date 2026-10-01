import { router } from "expo-router";

export function safeBack(fallback: string = "/"): void {
  try {
    if (router.canGoBack()) {
      router.back();
      return;
    }
  } catch {}
  router.replace(fallback as any);
}
