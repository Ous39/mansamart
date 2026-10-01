import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type SafeImage = { buffer: Buffer; mimeType: "image/jpeg" | "image/png" | "image/webp"; extension: "jpg" | "png" | "webp" };

function detectImage(buffer: Buffer): Omit<SafeImage, "buffer"> | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { mimeType: "image/jpeg", extension: "jpg" };
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mimeType: "image/png", extension: "png" };
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return { mimeType: "image/webp", extension: "webp" };
  return null;
}

export function parseBase64Image(dataUri: string): SafeImage {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)$/.exec(dataUri);
  if (!match) throw new Error("Only JPEG, PNG, or WebP data images are allowed");
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) throw new Error("Image must be 5 MB or smaller");
  const detected = detectImage(buffer);
  if (!detected || detected.mimeType !== match[1]) throw new Error("Image content does not match its declared type");
  return { buffer, ...detected };
}

export function saveBase64Image(dataUri: string, uploadDirectory: string) {
  const image = parseBase64Image(dataUri);
  fs.mkdirSync(uploadDirectory, { recursive: true });
  const finalName = `${crypto.randomUUID()}.${image.extension}`;
  const filePath = path.join(uploadDirectory, finalName);
  fs.writeFileSync(filePath, image.buffer, { flag: "wx", mode: 0o640 });
  return { relativePath: `/uploads/${finalName}`, mimeType: image.mimeType, filePath };
}
