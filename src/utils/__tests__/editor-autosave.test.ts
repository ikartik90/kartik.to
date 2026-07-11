import { describe, it, expect, beforeEach } from "vitest";
import {
  autosaveKey,
  readAutosave,
  writeAutosave,
  clearAutosave,
} from "../editor-autosave";
import type { Document } from "@/domain/post";

const DOC: Document = {
  type: "doc",
  content: [{ type: "paragraph", children: [{ type: "text", text: "hi" }] }],
};

describe("editor-autosave", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe("autosaveKey", () => {
    it("keys an existing post by its draft id", () => {
      expect(autosaveKey("post-123", "ARTICLE")).toBe(
        "kartik-editor-autosave:post-123",
      );
    });

    it("keys a brand-new post by its category", () => {
      expect(autosaveKey(null, "WORK")).toBe(
        "kartik-editor-autosave:new:WORK",
      );
    });
  });

  it("round-trips a snapshot through write and read", () => {
    const key = autosaveKey("post-1", "ARTICLE");
    writeAutosave(key, {
      title: "Draft title",
      draftId: "post-1",
      category: "ARTICLE",
      document: DOC,
      savedAt: 123,
    });

    const restored = readAutosave(key);
    expect(restored).toEqual({
      version: 1,
      title: "Draft title",
      draftId: "post-1",
      category: "ARTICLE",
      document: DOC,
      savedAt: 123,
    });
  });

  it("returns null when nothing is stored", () => {
    expect(readAutosave(autosaveKey("missing", "ARTICLE"))).toBeNull();
  });

  it("returns null for corrupt JSON", () => {
    const key = autosaveKey("post-2", "ARTICLE");
    window.localStorage.setItem(key, "{not json");
    expect(readAutosave(key)).toBeNull();
  });

  it("rejects a snapshot written under an incompatible schema version", () => {
    const key = autosaveKey("post-3", "ARTICLE");
    window.localStorage.setItem(
      key,
      JSON.stringify({ version: 0, title: "old", document: DOC }),
    );
    expect(readAutosave(key)).toBeNull();
  });

  it("clears a stored snapshot", () => {
    const key = autosaveKey("post-4", "ARTICLE");
    writeAutosave(key, {
      title: "",
      draftId: "post-4",
      category: "ARTICLE",
      document: DOC,
      savedAt: 1,
    });
    expect(readAutosave(key)).not.toBeNull();

    clearAutosave(key);
    expect(readAutosave(key)).toBeNull();
  });
});
