import { describe, it, expect } from "vitest";
import {
  ALLOWED_IMAGE_CONTENT_TYPES,
  CreateMediaUploadInputSchema,
  MediaAssetSchema,
  MAX_IMAGE_UPLOAD_BYTES,
  isAllowedImageContentType,
  sanitizeMediaFilename,
} from "../media";

describe("MediaAssetSchema", () => {
  it("parses a valid asset", () => {
    const asset = MediaAssetSchema.parse({
      key: "media/abc-photo.png",
      url: "https://cdn.example.com/media/abc-photo.png",
      filename: "photo.png",
      contentType: "image/png",
      size: 1024,
      alt: "A photo",
    });
    expect(asset.filename).toBe("photo.png");
  });

  it("rejects oversize upload input", () => {
    expect(() =>
      CreateMediaUploadInputSchema.parse({
        filename: "big.png",
        contentType: "image/png",
        size: MAX_IMAGE_UPLOAD_BYTES + 1,
      }),
    ).toThrow();
  });
});

describe("isAllowedImageContentType", () => {
  it("accepts allowed types", () => {
    for (const type of ALLOWED_IMAGE_CONTENT_TYPES) {
      expect(isAllowedImageContentType(type)).toBe(true);
    }
  });

  it("rejects unknown types", () => {
    expect(isAllowedImageContentType("image/bmp")).toBe(false);
  });
});

describe("sanitizeMediaFilename", () => {
  it("strips path segments and unsafe characters", () => {
    expect(sanitizeMediaFilename("../../weird name!.png")).toBe("weird-name-.png");
  });
});
