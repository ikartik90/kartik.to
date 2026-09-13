import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetSession } = vi.hoisted(() => ({ mockGetSession: vi.fn() }));

// The guard now lives in `@/lib/auth/server` and is shared by every action
// module. Stubbed at its SESSION source rather than by replacing the module, so
// these tests still run the real comparison — a mock of `requireAdmin` would
// make every "Unauthorized" case below assert its own stub.
vi.mock("@neondatabase/auth/next/server", () => ({
  createNeonAuth: () => ({ getSession: () => mockGetSession() }),
}));

vi.mock("@/lib/env", () => ({
  env: {
    ADMIN_GITHUB_ID: "admin@example.com",
    R2_PUBLIC_BASE_URL: "https://cdn.example.com",
  },
}));

const mockListR2IconKeys = vi.fn();
const mockHeadR2Object = vi.fn();
const mockCreateR2UploadUrl = vi.fn();
const mockUpdateR2ObjectMetadata = vi.fn();
const mockDeleteR2Object = vi.fn();

vi.mock("@/lib/storage/r2", () => ({
  ICON_PREFIX: "icons/",
  listR2IconKeys: (...args: unknown[]) => mockListR2IconKeys(...args),
  headR2Object: (...args: unknown[]) => mockHeadR2Object(...args),
  createR2UploadUrl: (...args: unknown[]) => mockCreateR2UploadUrl(...args),
  updateR2ObjectMetadata: (...args: unknown[]) =>
    mockUpdateR2ObjectMetadata(...args),
  deleteR2Object: (...args: unknown[]) => mockDeleteR2Object(...args),
  publicUrlForKey: (key: string) => `https://cdn.example.com/${key}`,
}));

const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const mockIconFindMany = vi.fn();
const mockIconUpsert = vi.fn();
const mockIconDeleteMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    icon: {
      findMany: (...args: unknown[]) => mockIconFindMany(...args),
      upsert: (...args: unknown[]) => mockIconUpsert(...args),
      deleteMany: (...args: unknown[]) => mockIconDeleteMany(...args),
    },
  },
}));

const {
  listIcons,
  listHeldIcons,
  createIconUploadUrl,
  finalizeIconUpload,
  setIconReview,
  setIconLabels,
  deleteIcon,
} = await import("../icon-set");
const { listApprovedIconsWithSvg } = await import("@/lib/icons");

const STROKED = "icons/550e8400-e29b-41d4-a716-446655440000-check.svg";
const FLAT = "icons/550e8400-e29b-41d4-a716-446655440001-trash.svg";

function head(overrides: Record<string, string> = {}) {
  return {
    size: 512,
    contentType: "image/svg+xml",
    metadata: {
      filename: "check.svg",
      native: "20",
      flattened: "0",
      review: "approved",
      ...overrides,
    },
  };
}

function signedIn() {
  mockGetSession.mockResolvedValue({ data: { user: { email: "admin@example.com" } } });
}

function signedOut() {
  mockGetSession.mockResolvedValue({ data: null });
}

describe("listIcons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signedOut();
    // No icon has been renamed unless a test says so.
    mockIconFindMany.mockResolvedValue([]);
  });

  it("lists what is in the bucket", async () => {
    mockListR2IconKeys.mockResolvedValue([STROKED]);
    mockHeadR2Object.mockResolvedValue(head());

    const icons = await listIcons();
    expect(icons).toHaveLength(1);
    expect(icons[0]).toMatchObject({
      key: STROKED,
      name: "check.svg",
      native: 20,
      flattened: false,
      review: "approved",
      url: `https://cdn.example.com/${STROKED}`,
    });
  });

  it("keeps a held icon away from a visitor entirely", async () => {
    mockListR2IconKeys.mockResolvedValue([STROKED, FLAT]);
    mockHeadR2Object.mockImplementation((key: string) =>
      Promise.resolve(
        key === FLAT
          ? head({ filename: "trash.svg", flattened: "1", review: "held" })
          : head(),
      ),
    );

    const icons = await listIcons();
    expect(icons.map((icon) => icon.key)).toEqual([STROKED]);
  });

  it("shows the author everything, held ones included", async () => {
    signedIn();
    mockListR2IconKeys.mockResolvedValue([STROKED, FLAT]);
    mockHeadR2Object.mockImplementation((key: string) =>
      Promise.resolve(
        key === FLAT
          ? head({ filename: "trash.svg", flattened: "1", review: "held" })
          : head(),
      ),
    );

    const icons = await listIcons();
    expect(icons.map((icon) => icon.review)).toEqual(["approved", "held"]);
  });

  it("holds an object whose review state was never written", async () => {
    // Anything already in the bucket predates this page. It has not been
    // looked at, so it is not on show — the safe direction for a default.
    mockListR2IconKeys.mockResolvedValue([STROKED]);
    mockHeadR2Object.mockResolvedValue(head({ review: "" }));

    expect(await listIcons()).toEqual([]);
  });

  it("falls back to the key's own name and a 20 grid for an unmeasured object", async () => {
    signedIn();
    mockListR2IconKeys.mockResolvedValue([STROKED]);
    mockHeadR2Object.mockResolvedValue({
      size: 512,
      contentType: "image/svg+xml",
      metadata: {},
    });

    const [icon] = await listIcons();
    expect(icon.name).toBe("check.svg");
    expect(icon.native).toBe(20);
    expect(icon.review).toBe("held");
  });

  it("sorts by name so the grid does not reshuffle between visits", async () => {
    signedIn();
    mockListR2IconKeys.mockResolvedValue([FLAT, STROKED]);
    mockHeadR2Object.mockImplementation((key: string) =>
      Promise.resolve(key === FLAT ? head({ filename: "trash.svg" }) : head()),
    );

    const icons = await listIcons();
    expect(icons.map((icon) => icon.name)).toEqual(["check.svg", "trash.svg"]);
  });
});

describe("createIconUploadUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signedIn();
    mockCreateR2UploadUrl.mockResolvedValue({
      uploadUrl: "https://upload",
      publicUrl: "https://cdn.example.com/icons/x.svg",
      key: "icons/x.svg",
    });
  });

  it("signs a PUT under the icons prefix", async () => {
    await createIconUploadUrl({ filename: "Arrow Up.svg", size: 900 });

    const [key, contentType] = mockCreateR2UploadUrl.mock.calls[0];
    expect(key).toMatch(/^icons\/[0-9a-f-]{36}-arrow-up\.svg$/i);
    expect(contentType).toBe("image/svg+xml");
  });

  it("asks for no metadata on the signature, which could not carry it", async () => {
    // R2 accepts a presigned PUT whose `x-amz-meta-*` were hoisted into the
    // query string and stores NONE of them, with a 200. Everything the object
    // is measured as is stamped on afterwards by `finalizeIconUpload`.
    await createIconUploadUrl({ filename: "a.svg", size: 900 });
    expect(mockCreateR2UploadUrl.mock.calls[0]).toHaveLength(2);
  });

  it("refuses a visitor", async () => {
    signedOut();
    await expect(
      createIconUploadUrl({ filename: "a.svg", size: 10 }),
    ).rejects.toThrow("Unauthorized");
  });

  it("refuses a file too big to be an icon", async () => {
    await expect(
      createIconUploadUrl({ filename: "a.svg", size: 5_000_000 }),
    ).rejects.toThrow();
  });
});

describe("finalizeIconUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signedIn();
    mockHeadR2Object.mockResolvedValue(head());
  });

  it("stamps the measurements onto the object the bytes just landed in", async () => {
    await finalizeIconUpload({ key: STROKED, native: 16, flattened: false });

    expect(mockUpdateR2ObjectMetadata).toHaveBeenCalledWith(STROKED, {
      filename: "check.svg",
      native: "16",
      flattened: "0",
      review: "approved",
    });
  });

  it("holds a flattened upload back, whatever the client would prefer", async () => {
    await finalizeIconUpload({
      key: FLAT,
      native: 20,
      flattened: true,
      review: "approved",
    });

    expect(mockUpdateR2ObjectMetadata).toHaveBeenCalledWith(
      FLAT,
      expect.objectContaining({ flattened: "1", review: "held" }),
    );
  });

  it("names the file from the key it minted, not from anything sent", async () => {
    await finalizeIconUpload({
      key: FLAT,
      native: 20,
      flattened: false,
      filename: "../../evil.svg",
    });

    expect(mockUpdateR2ObjectMetadata.mock.calls[0][1].filename).toBe("trash.svg");
  });

  it("hands back the icon as it now reads", async () => {
    const icon = await finalizeIconUpload({
      key: STROKED,
      native: 20,
      flattened: false,
    });
    expect(icon).toMatchObject({ key: STROKED, name: "check.svg" });
  });

  it("refuses a visitor", async () => {
    signedOut();
    await expect(
      finalizeIconUpload({ key: STROKED, native: 20, flattened: false }),
    ).rejects.toThrow("Unauthorized");
  });

  it("refuses a key outside the icon set", async () => {
    await expect(
      finalizeIconUpload({ key: "media/photo.png", native: 20, flattened: false }),
    ).rejects.toThrow("Invalid icon key");
    expect(mockUpdateR2ObjectMetadata).not.toHaveBeenCalled();
  });
});

describe("setIconReview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signedIn();
    mockHeadR2Object.mockResolvedValue(head({ review: "held", flattened: "1" }));
  });

  it("puts a held icon on show, and hands back what it wrote", async () => {
    mockUpdateR2ObjectMetadata.mockImplementation(() => {
      mockHeadR2Object.mockResolvedValue(
        head({ filename: "trash.svg", flattened: "1", review: "approved" }),
      );
    });

    const icon = await setIconReview({ key: FLAT, review: "approved" });
    expect(mockUpdateR2ObjectMetadata).toHaveBeenCalledWith(FLAT, {
      review: "approved",
    });
    expect(icon).toMatchObject({ key: FLAT, review: "approved", flattened: true });
  });

  it("refuses a visitor", async () => {
    signedOut();
    await expect(
      setIconReview({ key: FLAT, review: "approved" }),
    ).rejects.toThrow("Unauthorized");
  });

  it("refuses a key from outside the set", async () => {
    await expect(
      setIconReview({ key: "media/photo.png", review: "approved" }),
    ).rejects.toThrow("Invalid icon key");
  });
});

describe("deleteIcon", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signedIn();
  });

  it("removes the object", async () => {
    await deleteIcon({ key: STROKED });
    expect(mockDeleteR2Object).toHaveBeenCalledWith(STROKED);
  });

  it("refuses a visitor", async () => {
    signedOut();
    await expect(deleteIcon({ key: STROKED })).rejects.toThrow("Unauthorized");
    expect(mockDeleteR2Object).not.toHaveBeenCalled();
  });

  it("refuses a key from outside the set, so it cannot reach the library", async () => {
    await expect(deleteIcon({ key: "media/photo.png" })).rejects.toThrow(
      "Invalid icon key",
    );
    expect(mockDeleteR2Object).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// An icon's NAME and its aliases, which are the only two things about an icon
// that its own file cannot say — see the `Icon` model.
// ---------------------------------------------------------------------------

describe("icon labels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signedOut();
    mockIconFindMany.mockResolvedValue([]);
  });

  it("calls an icon what its filename says until somebody says otherwise", async () => {
    mockListR2IconKeys.mockResolvedValue([STROKED]);
    mockHeadR2Object.mockResolvedValue(head({ filename: "chevron-down.svg" }));

    const [icon] = await listIcons();

    expect(icon.title).toBe("Chevron Down");
    expect(icon.aliases).toEqual([]);
  });

  it("prefers the row where there is one", async () => {
    mockListR2IconKeys.mockResolvedValue([STROKED]);
    mockHeadR2Object.mockResolvedValue(head({ filename: "chevron-down.svg" }));
    mockIconFindMany.mockResolvedValue([
      { key: STROKED, title: "Caret", aliases: ["Arrow", "Expand"] },
    ]);

    const [icon] = await listIcons();

    expect(icon.title).toBe("Caret");
    expect(icon.aliases).toEqual(["Arrow", "Expand"]);
  });

  it("refuses to rename anything for a visitor", async () => {
    await expect(
      setIconLabels({ key: STROKED, title: "Caret", aliases: [] }),
    ).rejects.toThrow(/Unauthorized/);
    expect(mockIconUpsert).not.toHaveBeenCalled();
  });

  it("refuses a key that is not an icon's", async () => {
    signedIn();
    await expect(
      setIconLabels({ key: "media/secret.png", title: "Nice", aliases: [] }),
    ).rejects.toThrow(/Invalid icon key/);
    expect(mockIconUpsert).not.toHaveBeenCalled();
  });

  it("stores the name and its aliases, tidied", async () => {
    signedIn();

    await setIconLabels({
      key: STROKED,
      title: "  Chevron Down  ",
      aliases: ["Arrow", " arrow ", "", "Caret"],
    });

    expect(mockIconUpsert).toHaveBeenCalledWith({
      where: { key: STROKED },
      create: { key: STROKED, title: "Chevron Down", aliases: ["Arrow", "Caret"] },
      update: { title: "Chevron Down", aliases: ["Arrow", "Caret"] },
    });
  });

  it("deletes the row when the name is cleared, rather than storing an empty one", async () => {
    // An icon with no row is called what its filename says, so emptying the
    // field is how you get that name back — and a row holding "" would have
    // to be told apart from an unset one everywhere it was read.
    signedIn();

    await setIconLabels({ key: STROKED, title: "   ", aliases: [] });

    expect(mockIconUpsert).not.toHaveBeenCalled();
    expect(mockIconDeleteMany).toHaveBeenCalledWith({ where: { key: STROKED } });
  });

  it("takes an icon's labels with the icon", async () => {
    signedIn();
    await deleteIcon({ key: STROKED });

    expect(mockDeleteR2Object).toHaveBeenCalledWith(STROKED);
    expect(mockIconDeleteMany).toHaveBeenCalledWith({ where: { key: STROKED } });
  });
});


// ---------------------------------------------------------------------------
// The set as the SERVER draws it.
//
// The page prerenders the approved icons, so this read must ask nothing about
// who is calling — a session read is what would make the route dynamic, and
// the whole point is that the answer is the same for everyone.
// ---------------------------------------------------------------------------

describe("the set the page is prerendered from", () => {
  const SOURCES: Record<string, string> = {
    [`https://cdn.example.com/${STROKED}`]:
      '<svg viewBox="0 0 20 20" fill="none"><path d="M4 10L9 15" stroke="#000" stroke-width="1.25"/></svg>',
    [`https://cdn.example.com/${FLAT}`]:
      '<svg viewBox="0 0 20 20"><path d="M4 10L9 15L16 5Z" fill="#000"/></svg>',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    signedOut();
    mockIconFindMany.mockResolvedValue([]);
    mockListR2IconKeys.mockResolvedValue([STROKED, FLAT]);
    mockHeadR2Object.mockImplementation((key: string) =>
      key === FLAT
        ? head({ filename: "trash.svg", flattened: "1", review: "held" })
        : head(),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve({ ok: true, text: () => Promise.resolve(SOURCES[url] ?? "") }),
      ),
    );
  });

  it("draws every approved icon, parsed and ready", async () => {
    const set = await listApprovedIconsWithSvg();

    expect(set).toHaveLength(1);
    expect(set[0].icon.name).toBe("check.svg");
    // Parsed on the SERVER — the geometry is in hand, so the page can be HTML
    // rather than a request for two hundred files.
    expect(set[0].svg).toMatchObject({ viewBox: 20, flattened: false });
    expect(set[0].svg?.nodes.length).toBeGreaterThan(0);
  });

  it("leaves the held icons out of it entirely, not merely unmarked", async () => {
    // The page this feeds is public HTML. A held icon that reached it would be
    // in the payload for everyone, whatever the grid chose to draw — which is
    // the one thing holding an icon back has to prevent.
    const set = await listApprovedIconsWithSvg();
    expect(set.map((entry) => entry.icon.key)).not.toContain(FLAT);
  });

  it("asks nothing about who is calling, even when the author is", async () => {
    // A session read is what would make the route dynamic. The approved set is
    // the same for everyone, so this must never look.
    signedIn();
    const set = await listApprovedIconsWithSvg();

    expect(mockGetSession).not.toHaveBeenCalled();
    expect(set).toHaveLength(1);
  });

  it("keeps an icon whose file will not come, rather than dropping the tile", async () => {
    // The listing says it exists; the grid marks it broken. Dropping it here
    // would make a failed read look like a deleted icon.
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, text: () => Promise.resolve("") })));
    const set = await listApprovedIconsWithSvg();

    expect(set).toHaveLength(1);
    expect(set[0].svg).toBeNull();
  });
});

describe("listHeldIcons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIconFindMany.mockResolvedValue([]);
    mockListR2IconKeys.mockResolvedValue([STROKED, FLAT]);
    mockHeadR2Object.mockImplementation((key: string) =>
      key === FLAT
        ? head({ filename: "trash.svg", flattened: "1", review: "held" })
        : head(),
    );
  });

  it("hands the author the part of the set the page did not prerender", async () => {
    signedIn();
    const held = await listHeldIcons();

    expect(held.map((icon) => icon.name)).toEqual(["trash.svg"]);
  });

  it("refuses anyone else", async () => {
    signedOut();
    await expect(listHeldIcons()).rejects.toThrow("Unauthorized");
  });
});

// ---------------------------------------------------------------------------
// Revalidation.
//
// The grid is prerendered now, so a write that does not say so leaves the page
// showing the set as it was at the last build — the icon uploaded a minute ago
// simply is not there, and nothing in the UI can explain why.
// ---------------------------------------------------------------------------

describe("what a write tells the prerendered page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signedIn();
    mockIconFindMany.mockResolvedValue([]);
    mockListR2IconKeys.mockResolvedValue([STROKED]);
    mockHeadR2Object.mockResolvedValue(head());
    mockIconUpsert.mockResolvedValue({});
    mockIconDeleteMany.mockResolvedValue({});
    mockUpdateR2ObjectMetadata.mockResolvedValue({});
    mockDeleteR2Object.mockResolvedValue({});
  });

  it("rebuilds the page when an icon lands", async () => {
    await finalizeIconUpload({ key: STROKED, native: 20, flattened: false });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/playground/icons");
  });

  it("rebuilds it when one is published", async () => {
    await setIconReview({ key: STROKED, review: "approved" });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/playground/icons");
  });

  it("rebuilds it when one is deleted", async () => {
    await deleteIcon({ key: STROKED });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/playground/icons");
  });

  it("rebuilds it when one is renamed, since the name is in the HTML", async () => {
    await setIconLabels({ key: STROKED, title: "Tick", aliases: ["check"] });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/playground/icons");
  });
});
