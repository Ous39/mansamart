import { Linking, Platform } from "react-native";

export function hasCoords(lat?: number | null, lng?: number | null) {
  return typeof lat === "number" && Number.isFinite(lat) && typeof lng === "number" && Number.isFinite(lng);
}

export function mapSearchUrl(lat?: number | null, lng?: number | null, label = "MansaMart location") {
  if (!hasCoords(lat, lng)) return null;
  const encoded = encodeURIComponent(label);
  if (Platform.OS === "ios") return `http://maps.apple.com/?ll=${lat},${lng}&q=${encoded}`;
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export function navigationUrl(lat?: number | null, lng?: number | null, label = "MansaMart destination") {
  if (!hasCoords(lat, lng)) return null;
  const encoded = encodeURIComponent(label);
  if (Platform.OS === "ios") return `http://maps.apple.com/?daddr=${lat},${lng}&q=${encoded}&dirflg=d`;
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

export async function openMap(lat?: number | null, lng?: number | null, label = "MansaMart location") {
  const url = mapSearchUrl(lat, lng, label);
  if (url) await Linking.openURL(url);
}

export async function openNavigation(lat?: number | null, lng?: number | null, label = "MansaMart destination") {
  const url = navigationUrl(lat, lng, label);
  if (url) await Linking.openURL(url);
}
