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
  filenameFromMediaKey,
  filenameFromMediaUrl,
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

  // The file's own shape, carried from the moment it is picked to the node
  // that ends up pointing at it — the whole chain a reserved box depends on
  // (`mediaReservedAspect`). Optional at every link, because a measurement can
  // fail and every object stored before this existed has none.
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

  // Zero is what an element that decoded nothing reports. It must never be
  // stored as if it were an answer, at this link or the next one.
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

// ---------------------------------------------------------------------------
// Documents — the second thing the bucket now holds.
//
// A PDF is uploaded and listed exactly as a picture is, and is EXCLUDED from
// everywhere media is offered: it has no `MediaKind`, so nothing can render it
// as a picture or a clip, and a library row for one would be a broken image.
// The one surface that wants it is the link card's document picker.
// ---------------------------------------------------------------------------

describe("documents", () => {
  it("takes a PDF", () => {
    expect(isDocumentContentType("application/pdf")).toBe(true);
  });

  it("does not mistake a picture for one", () => {
    expect(isDocumentContentType("image/png")).toBe(false);
  });

  // The media list is what the image dialog offers and what `mediaKindOf`
  // answers for. A document in it would be shown as a picture that cannot load.
  it("is not one of the media types", () => {
    expect(isAllowedMediaContentType("application/pdf")).toBe(false);
  });

  // The upload path is shared — one bucket, one signer, one allow-list — so
  // the union is what the server validates against.
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

  // Its own ceiling, for the reason a clip has one: a print-quality portfolio
  // is a different order of file from a screenshot, and one cap for both would
  // either refuse ordinary documents or stop being a guard on pictures.
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

  // A signed URL buries the path behind a query, which is the case the plain
  // "everything after the last slash" reading gets wrong.
  it("ignores a query and a fragment", () => {
    expect(
      filenameFromMediaUrl("https://cdn.example.com/media/photo.png?sig=abc#x"),
    ).toBe("photo.png");
  });

  // A worse label, never a broken one — a rewritten path still names something.
  it("falls back to whatever the last segment is", () => {
    expect(filenameFromMediaUrl("https://cdn.example.com/abc123")).toBe(
      "abc123",
    );
  });
});
