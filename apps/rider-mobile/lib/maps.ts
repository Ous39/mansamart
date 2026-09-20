import { Linking } from "react-native";

export function hasCoords(lat?: number | null, lng?: number | null) {
  return typeof lat === "number" && Number.isFinite(lat) && typeof lng === "number" && Number.isFinite(lng);
}

export function mapSearchUrl(lat?: number | null, lng?: number | null, label = "MansaMart location", fallback?: string) {
  const query = hasCoords(lat, lng) ? `${lat},${lng}` : fallback;
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function navigationUrl(lat?: number | null, lng?: number | null, label = "MansaMart destination", fallback?: string) {
  const destination = hasCoords(lat, lng) ? `${lat},${lng}` : fallback || label;
  if (!destination) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving&dir_action=navigate`;
}

export async function openMap(lat?: number | null, lng?: number | null, label = "MansaMart location", fallback?: string) {
  const url = mapSearchUrl(lat, lng, label, fallback);
  if (url) await Linking.openURL(url);
}

export async function openNavigation(lat?: number | null, lng?: number | null, label = "MansaMart destination", fallback?: string) {
  const url = navigationUrl(lat, lng, label, fallback);
  if (url) await Linking.openURL(url);
}
