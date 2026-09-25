import { describe, it, expect } from "vitest";
import {
  ALLOWED_MEDIA_CONTENT_TYPES,
  CreateMediaUploadInputSchema,
  MediaAssetSchema,
  MAX_DOCUMENT_UPLOAD_BYTES,
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_VIDEO_UPLOAD_BYTES,
  isAllowedMediaContentType,
  isAllowedUploadContentType,
  isDocumentContentType,
  isVideoContentType,
  maxUploadBytesFor,
  mediaKindOf,
  sanitizeMediaFilename,
  sanitizeMediaDisplayName,
  filenameFromMediaKey,
  filenameFromMediaUrl,
  MediaFolderSchema,
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

  it("carries the source's measured shape, and does without it", () => {
    expect(
      CreateMediaUploadInputSchema.parse({
        filename: "photo.png",
        contentType: "image/png",
        size: 1024,
        width: 1600,
        height: 900,
      }),
    ).toMatchObject({ width: 1600, height: 900 });

    const unmeasured = CreateMediaUploadInputSchema.parse({
      filename: "photo.png",
      contentType: "image/png",
      size: 1024,
    });
    expect(unmeasured.width).toBeUndefined();

    expect(
      MediaAssetSchema.parse({
        key: "media/abc-photo.png",
        url: "https://cdn.example.com/media/abc-photo.png",
        filename: "photo.png",
        contentType: "image/png",
        size: 1024,
        width: 1600,
        height: 900,
      }),
    ).toMatchObject({ width: 1600, height: 900 });
  });

  it("refuses a dimension no source could have", () => {
    expect(() =>
      CreateMediaUploadInputSchema.parse({
        filename: "photo.png",
        contentType: "image/png",
        size: 1024,
        width: 0,
        height: 900,
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

describe("sanitizeMediaDisplayName", () => {
  it("keeps a name a person would actually type", () => {
    expect(sanitizeMediaDisplayName("Old shift form (v2).mp4")).toBe(
      "Old shift form (v2).mp4",
    );
  });

  it("folds an accent rather than dropping the letter under it", () => {
    expect(sanitizeMediaDisplayName("Résumé.pdf")).toBe("Resume.pdf");
  });

  it("collapses whitespace and drops control characters", () => {
    expect(sanitizeMediaDisplayName("  two\n\tnames  ")).toBe("two names");
  });

  it("caps a name at the length the store will take", () => {
    expect(sanitizeMediaDisplayName("a".repeat(200))).toHaveLength(120);
  });
});

describe("filenameFromMediaKey", () => {
  it("recovers the original filename from a uuid-prefixed key", () => {
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

describe("documents", () => {
  it("takes a PDF", () => {
    expect(isDocumentContentType("application/pdf")).toBe(true);
  });

  it("does not mistake a picture for one", () => {
    expect(isDocumentContentType("image/png")).toBe(false);
  });

  it("is not one of the media types", () => {
    expect(isAllowedMediaContentType("application/pdf")).toBe(false);
  });

  it("is allowed to be uploaded", () => {
    expect(isAllowedUploadContentType("application/pdf")).toBe(true);
    expect(isAllowedUploadContentType("image/png")).toBe(true);
    expect(isAllowedUploadContentType("application/zip")).toBe(false);
  });

  it("passes the upload schema", () => {
    expect(
      CreateMediaUploadInputSchema.safeParse({
        filename: "cv.pdf",
        contentType: "application/pdf",
        size: 1024,
      }).success,
    ).toBe(true);
  });

  it("has a ceiling of its own", () => {
    expect(maxUploadBytesFor("application/pdf")).toBe(
      MAX_DOCUMENT_UPLOAD_BYTES,
    );
    expect(
      CreateMediaUploadInputSchema.safeParse({
        filename: "cv.pdf",
        contentType: "application/pdf",
        size: MAX_DOCUMENT_UPLOAD_BYTES + 1,
      }).success,
    ).toBe(false);
  });
});

describe("filenameFromMediaUrl", () => {
  it("recovers the name a node's src was uploaded under", () => {
    expect(
      filenameFromMediaUrl(
        "https://cdn.example.com/media/123e4567-e89b-12d3-a456-426614174000-cv.pdf",
      ),
    ).toBe("cv.pdf");
  });

  it("ignores a query and a fragment", () => {
    expect(
      filenameFromMediaUrl("https://cdn.example.com/media/photo.png?sig=abc#x"),
    ).toBe("photo.png");
  });

  it("falls back to whatever the last segment is", () => {
    expect(filenameFromMediaUrl("https://cdn.example.com/abc123")).toBe(
      "abc123",
    );
  });
});

describe("MediaFolderSchema", () => {
  it("names the two halves of the bucket", () => {
    expect(MediaFolderSchema.parse("media")).toBe("media");
    expect(MediaFolderSchema.parse("profiles")).toBe("profiles");
  });

  it("refuses a folder that is not one of them", () => {
    expect(() => MediaFolderSchema.parse("avatars")).toThrow();
    expect(() => MediaFolderSchema.parse("")).toThrow();
    expect(() => MediaFolderSchema.parse("../media")).toThrow();
  });
});

describe("CreateMediaUploadInputSchema folder", () => {
  const base = {
    filename: "photo.png",
    contentType: "image/png",
    size: 500,
  };

  it("defaults to the media library", () => {
    expect(CreateMediaUploadInputSchema.parse(base).folder).toBe("media");
  });

  it("takes profiles", () => {
    expect(
      CreateMediaUploadInputSchema.parse({ ...base, folder: "profiles" }).folder,
    ).toBe("profiles");
  });

  it("refuses an unknown folder rather than defaulting it", () => {
    expect(() =>
      CreateMediaUploadInputSchema.parse({ ...base, folder: "elsewhere" }),
    ).toThrow();
  });
});
