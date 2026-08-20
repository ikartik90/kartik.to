import { describe, it, expect } from "vitest";
import {
  ALLOWED_MEDIA_CONTENT_TYPES,
  CreateMediaUploadInputSchema,
  MediaAssetSchema,
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_VIDEO_UPLOAD_BYTES,
  isAllowedMediaContentType,
  isVideoContentType,
  maxUploadBytesFor,
  mediaKindOf,
  sanitizeMediaFilename,
  filenameFromMediaKey,
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

  it("accepts an mp4", () => {
    const input = CreateMediaUploadInputSchema.parse({
      filename: "demo.mp4",
      contentType: "video/mp4",
      size: 2 * 1024 * 1024,
    });
    expect(input.contentType).toBe("video/mp4");
  });

  // The cap is per FORMAT, not per upload: a clip that would be an absurd
  // screenshot is an ordinary ten seconds of product demo.
  it("holds a clip to the video cap, not the image one", () => {
    const size = MAX_IMAGE_UPLOAD_BYTES + 1;
    expect(() =>
      CreateMediaUploadInputSchema.parse({
        filename: "demo.mp4",
        contentType: "video/mp4",
        size,
      }),
    ).not.toThrow();
    expect(() =>
      CreateMediaUploadInputSchema.parse({
        filename: "demo.mp4",
        contentType: "video/mp4",
        size: MAX_VIDEO_UPLOAD_BYTES + 1,
      }),
    ).toThrow();
  });
});

describe("isAllowedMediaContentType", () => {
  it("accepts allowed types", () => {
    for (const type of ALLOWED_MEDIA_CONTENT_TYPES) {
      expect(isAllowedMediaContentType(type)).toBe(true);
    }
  });

  it("rejects unknown types", () => {
    expect(isAllowedMediaContentType("image/bmp")).toBe(false);
    expect(isAllowedMediaContentType("video/quicktime")).toBe(false);
  });
});

describe("isVideoContentType", () => {
  it("tells a clip from a picture", () => {
    expect(isVideoContentType("video/mp4")).toBe(true);
    expect(isVideoContentType("image/gif")).toBe(false);
  });
});

describe("maxUploadBytesFor", () => {
  it("gives each format its own ceiling", () => {
    expect(maxUploadBytesFor("video/mp4")).toBe(MAX_VIDEO_UPLOAD_BYTES);
    expect(maxUploadBytesFor("image/png")).toBe(MAX_IMAGE_UPLOAD_BYTES);
  });
});

describe("mediaKindOf", () => {
  it("names the element an upload of this type should be rendered with", () => {
    expect(mediaKindOf("video/mp4")).toBe("video");
    expect(mediaKindOf("image/png")).toBe("image");
    expect(mediaKindOf("image/svg+xml")).toBe("image");
  });

  // The library only ever holds types that passed
  // `CreateMediaUploadInputSchema`, so this branch is unreachable through the
  // app — it is pinned because the fall-through is the SAFE direction and
  // should stay that way. An unrecognised type shown as a picture is a broken
  // image; shown as a clip it is an empty black box with nothing to say it
  // failed.
  it("falls through to a picture for a type it does not know", () => {
    expect(mediaKindOf("application/octet-stream")).toBe("image");
    expect(mediaKindOf("")).toBe("image");
  });
});

describe("sanitizeMediaFilename", () => {
  it("strips path segments and unsafe characters", () => {
    expect(sanitizeMediaFilename("../../weird name!.png")).toBe("weird-name-.png");
  });
});

describe("filenameFromMediaKey", () => {
  it("recovers the original filename from a uuid-prefixed key", () => {
    // randomUUID() itself contains dashes — the split must skip the whole uuid,
    // not stop at its first dash.
    expect(
      filenameFromMediaKey(
        "media/550e8400-e29b-41d4-a716-446655440000-favicon.png",
      ),
    ).toBe("favicon.png");
  });

  it("keeps dashes that belong to the original filename", () => {
    expect(
      filenameFromMediaKey(
        "media/550e8400-e29b-41d4-a716-446655440000-my-holiday-photo.png",
      ),
    ).toBe("my-holiday-photo.png");
  });

  it("falls back to the whole segment when there is no uuid prefix", () => {
    expect(filenameFromMediaKey("media/legacy.png")).toBe("legacy.png");
  });
});
