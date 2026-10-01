import { ImageSourcePropType } from "react-native";
import { API_BASE_URL } from "@/lib/config";

export type ProductImageSource = ImageSourcePropType;

function safeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return null;
  return trimmed;
}

export function resolveAssetUrl(value?: string | null): string | null {
  const trimmed = safeString(value);
  if (!trimmed) return null;
  if (/^(https?:|data:|file:|content:|blob:)/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/")) {
    try {
      return new URL(trimmed, API_BASE_URL).toString();
    } catch {
      return `${API_BASE_URL.replace(/\/$/, "")}${trimmed}`;
    }
  }
  return trimmed;
}

export function toImageSource(value: unknown): ProductImageSource | null {
  if (!value) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const uri = resolveAssetUrl(value);
    return uri ? { uri } : null;
  }
  if (typeof value === "object" && value !== null && "uri" in (value as any)) {
    const uri = resolveAssetUrl((value as any).uri);
    return uri ? { ...(value as any), uri } : null;
  }
  return null;
}

export function getProductImages(product: any): ProductImageSource[] {
  const values: unknown[] = [];
  if (product?.image) values.push(product.image);
  if (product?.imageUrl) values.push(product.imageUrl);
  if (Array.isArray(product?.images)) values.push(...product.images);
  if (typeof product?.images === "string") {
    try {
      const parsed = JSON.parse(product.images);
      if (Array.isArray(parsed)) values.push(...parsed);
    } catch {
      values.push(product.images);
    }
  }

  const seen = new Set<string>();
  const sources: ProductImageSource[] = [];
  for (const value of values) {
    const source = toImageSource(value);
    if (!source) continue;
    const key = typeof source === "number" ? `local:${source}` : `uri:${(source as any).uri ?? JSON.stringify(source)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    sources.push(source);
  }
  return sources;
}

export function getProductMainImage(product: any): ProductImageSource | null {
  return getProductImages(product)[0] ?? null;
}
