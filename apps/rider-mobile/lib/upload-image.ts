import * as ImagePicker from "expo-image-picker";
import { apiRequest } from "@/lib/query-client";

export type UploadKind =
  | "product"
  | "vendor-logo"
  | "vendor-cover"
  | "profile-avatar"
  | "business-document"
  | "identity-document"
  | "rider-document"
  | "provider-document"
  | "other-document";

function fileNameFor(kind: UploadKind, mimeType: string, original?: string | null) {
  const ext = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
  const safeOriginal = original?.replace(/[^a-zA-Z0-9._-]/g, "-");
  return safeOriginal || `${kind}-${Date.now()}.${ext}`;
}

function pickerOptionsFor(kind: UploadKind) {
  const ImagePickerAny = ImagePicker as any;
  const mediaTypes = ImagePickerAny.MediaType?.Images
    ? [ImagePickerAny.MediaType.Images]
    : ImagePickerAny.MediaTypeOptions?.Images;

  const isLogo = kind === "vendor-logo" || kind === "profile-avatar";
  const isCover = kind === "vendor-cover";
  const isDocument = kind.includes("document");

  return {
    mediaTypes,
    allowsEditing: isLogo || isCover,
    aspect: isLogo ? [1, 1] : isCover ? [16, 9] : undefined,
    quality: isDocument ? 0.72 : isLogo ? 0.82 : isCover ? 0.68 : 0.62,
    base64: true,
  } as any;
}

export async function pickAndUploadImage(kind: UploadKind = "product"): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Please allow photo access so you can upload images and documents.");
  }

  const result = await ImagePicker.launchImageLibraryAsync(pickerOptionsFor(kind));

  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  if (!asset.base64) throw new Error("Image could not be processed. Please try another photo or take a new photo.");

  const mimeType = asset.mimeType || "image/jpeg";
  const image = `data:${mimeType};base64,${asset.base64}`;
  const res = await apiRequest("POST", "/api/uploads/base64", {
    image,
    fileName: fileNameFor(kind, mimeType, asset.fileName),
    kind,
  });
  const data = await res.json();
  const uploadedUrl = (data.url || data.path) as string | undefined;
  if (!uploadedUrl) throw new Error("Upload completed but server did not return a file URL.");
  return uploadedUrl;
}
