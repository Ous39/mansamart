import { MansaMartApi } from "@mansamart/api-client";
import { createTokenStore } from "@mansamart/authentication";

export const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:5000").replace(/\/$/, "");
export const tokenStore = createTokenStore("mansamart_web_session");
export const api = new MansaMartApi(API_BASE_URL, "web", tokenStore.get);

export function assetUrl(value?: string | null): string {
  if (!value) return "";
  if (/^https?:\/\//i.test(value) || value.startsWith("data:")) return value;
  return `${API_BASE_URL}${value.startsWith("/") ? value : `/${value}`}`;
}

export function money(value: number | string | null | undefined): string {
  const amount = Number(value || 0);
  return `D ${Number.isFinite(amount) ? amount.toLocaleString("en-GB") : "0"}`;
}

export function dateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function label(value?: string | null): string {
  return (value || "unknown").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
