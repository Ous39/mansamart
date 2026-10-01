import assert from "node:assert/strict";
import test from "node:test";
import { parseBase64Image } from "./upload-security";

test("accepts a valid PNG and detects its real type", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const result = parseBase64Image(`data:image/png;base64,${png.toString("base64")}`);
  assert.equal(result.mimeType, "image/png");
});

test("rejects a payload whose bytes do not match the declared image type", () => {
  const fake = Buffer.from("not an image");
  assert.throws(() => parseBase64Image(`data:image/jpeg;base64,${fake.toString("base64")}`));
});
