import { describe, it, expect, beforeEach } from "vitest";
import { useEditorStore, EMPTY_DOCUMENT } from "../editor";
import type { Document } from "@/domain/post";

const DOC: Document = {
  type: "doc",
  content: [{ type: "paragraph", children: [{ type: "text", text: "hello" }] }],
};

const DOC2: Document = {
  type: "doc",
  content: [{ type: "paragraph", children: [{ type: "text", text: "world" }] }],
};

describe("useEditorStore", () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  describe("initial state", () => {
    it("starts with an empty title", () => {
      expect(useEditorStore.getState().title).toBe("");
    });

    it("starts with no draftId", () => {
      expect(useEditorStore.getState().draftId).toBeNull();
    });

    it("starts with an empty document", () => {
      expect(useEditorStore.getState().document).toEqual(EMPTY_DOCUMENT);
    });

    it("starts not dirty", () => {
      expect(useEditorStore.getState().isDirty).toBe(false);
    });

    it("starts with category ARTICLE", () => {
      expect(useEditorStore.getState().category).toBe("ARTICLE");
    });

    it("starts with an empty history", () => {
      expect(useEditorStore.getState().history).toEqual([]);
      expect(useEditorStore.getState().historyIndex).toBe(-1);
    });
  });

  describe("setTitle", () => {
    it("updates the title", () => {
      useEditorStore.getState().setTitle("My Article");
      expect(useEditorStore.getState().title).toBe("My Article");
    });

    it("marks the store dirty", () => {
      useEditorStore.getState().setTitle("My Article");
      expect(useEditorStore.getState().isDirty).toBe(true);
    });
  });

  describe("setDocument", () => {
    it("updates the document", () => {
      useEditorStore.getState().setDocument(DOC);
      expect(useEditorStore.getState().document).toEqual(DOC);
    });

    it("marks the store dirty", () => {
      useEditorStore.getState().setDocument(DOC);
      expect(useEditorStore.getState().isDirty).toBe(true);
    });
  });

  describe("setDraftId", () => {
    it("stores the draft id", () => {
      useEditorStore.getState().setDraftId("abc-123");
      expect(useEditorStore.getState().draftId).toBe("abc-123");
    });

    it("does not mark the store dirty", () => {
      useEditorStore.getState().setDraftId("abc-123");
      expect(useEditorStore.getState().isDirty).toBe(false);
    });
  });

  describe("setDirty", () => {
    it("sets isDirty to true", () => {
      useEditorStore.getState().setDirty(true);
      expect(useEditorStore.getState().isDirty).toBe(true);
    });

    it("sets isDirty to false", () => {
      useEditorStore.getState().setDirty(true);
      useEditorStore.getState().setDirty(false);
      expect(useEditorStore.getState().isDirty).toBe(false);
    });
  });

  describe("reset", () => {
    it("restores all fields to initial values", () => {
      useEditorStore.getState().setTitle("Draft");
      useEditorStore.getState().setDocument(DOC);
      useEditorStore.getState().setDraftId("xyz");
      useEditorStore.getState().setDirty(true);
      useEditorStore.getState().pushHistory({ title: "Draft", document: DOC });

      useEditorStore.getState().reset();

      const { title, draftId, document, category, isDirty, history, historyIndex } =
        useEditorStore.getState();
      expect(title).toBe("");
      expect(draftId).toBeNull();
      expect(category).toBe("ARTICLE");
      expect(document).toEqual(EMPTY_DOCUMENT);
      expect(isDirty).toBe(false);
      expect(history).toEqual([]);
      expect(historyIndex).toBe(-1);
    });
  });

  describe("pushHistory", () => {
    it("appends a snapshot and advances historyIndex", () => {
      const snap = { title: "T", document: DOC };
      useEditorStore.getState().pushHistory(snap);
      expect(useEditorStore.getState().history).toHaveLength(1);
      expect(useEditorStore.getState().historyIndex).toBe(0);
    });

    it("accumulates multiple snapshots in order", () => {
      useEditorStore.getState().pushHistory({ title: "A", document: DOC });
      useEditorStore.getState().pushHistory({ title: "B", document: DOC2 });
      const { history, historyIndex } = useEditorStore.getState();
      expect(history).toHaveLength(2);
      expect(historyIndex).toBe(1);
      expect(history[0].title).toBe("A");
      expect(history[1].title).toBe("B");
    });

    it("trims the redo stack when a new snapshot is pushed after undoing", () => {
      useEditorStore.getState().pushHistory({ title: "A", document: DOC });
      useEditorStore.getState().pushHistory({ title: "B", document: DOC2 });
      useEditorStore.getState().undo(); // back to A
      useEditorStore.getState().pushHistory({ title: "C", document: DOC });
      const { history, historyIndex } = useEditorStore.getState();
      // B is gone; history is now [A, C]
      expect(history).toHaveLength(2);
      expect(historyIndex).toBe(1);
      expect(history[1].title).toBe("C");
    });
  });

  describe("undo", () => {
    it("restores the previous snapshot", () => {
      useEditorStore.getState().pushHistory({ title: "A", document: DOC });
      useEditorStore.getState().setTitle("B");
      useEditorStore.getState().pushHistory({ title: "B", document: DOC2 });

      useEditorStore.getState().undo();

      expect(useEditorStore.getState().title).toBe("A");
      expect(useEditorStore.getState().document).toEqual(DOC);
    });

    it("decrements historyIndex", () => {
      useEditorStore.getState().pushHistory({ title: "A", document: DOC });
      useEditorStore.getState().pushHistory({ title: "B", document: DOC2 });
      useEditorStore.getState().undo();
      expect(useEditorStore.getState().historyIndex).toBe(0);
    });

    it("marks the store dirty", () => {
      useEditorStore.getState().pushHistory({ title: "A", document: DOC });
      useEditorStore.getState().pushHistory({ title: "B", document: DOC2 });
      useEditorStore.getState().setDirty(false);
      useEditorStore.getState().undo();
      expect(useEditorStore.getState().isDirty).toBe(true);
    });

    it("is a no-op when already at the oldest snapshot", () => {
      useEditorStore.getState().pushHistory({ title: "A", document: DOC });
      useEditorStore.getState().undo(); // no-op: index is already 0
      expect(useEditorStore.getState().title).toBe("");
      expect(useEditorStore.getState().historyIndex).toBe(0);
    });
  });

  describe("redo", () => {
    it("restores the next snapshot", () => {
      useEditorStore.getState().pushHistory({ title: "A", document: DOC });
      useEditorStore.getState().pushHistory({ title: "B", document: DOC2 });
      useEditorStore.getState().undo();
      useEditorStore.getState().redo();

      expect(useEditorStore.getState().title).toBe("B");
      expect(useEditorStore.getState().document).toEqual(DOC2);
    });

    it("increments historyIndex", () => {
      useEditorStore.getState().pushHistory({ title: "A", document: DOC });
      useEditorStore.getState().pushHistory({ title: "B", document: DOC2 });
      useEditorStore.getState().undo();
      useEditorStore.getState().redo();
      expect(useEditorStore.getState().historyIndex).toBe(1);
    });

    it("marks the store dirty", () => {
      useEditorStore.getState().pushHistory({ title: "A", document: DOC });
      useEditorStore.getState().pushHistory({ title: "B", document: DOC2 });
      useEditorStore.getState().undo();
      useEditorStore.getState().setDirty(false);
      useEditorStore.getState().redo();
      expect(useEditorStore.getState().isDirty).toBe(true);
    });

    it("is a no-op when already at the newest snapshot", () => {
      useEditorStore.getState().pushHistory({ title: "A", document: DOC });
      useEditorStore.getState().redo(); // no-op: at latest
      expect(useEditorStore.getState().historyIndex).toBe(0);
    });
  });
});
