import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/store/editor";
import type { Document, PostCategory } from "@/domain/post";

const postActions = vi.hoisted(() => ({
  isPostSlugAvailable: vi.fn(async () => true),
}));
vi.mock("@/app/actions/post", () => postActions);

const { PostMetadataPanel } = await import("../post-metadata-panel");

const OPENING: Document = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      children: [{ type: "text", text: "The opening line of the post." }],
    },
  ],
};

function seed({
  category = "ARTICLE",
  slug = "hello" as string | null,
  description = null as string | null,
  draftId = "post-1" as string | null,
}: {
  category?: PostCategory;
  slug?: string | null;
  description?: string | null;
  draftId?: string | null;
} = {}) {
  useEditorStore.setState({
    category,
    slug,
    description,
    draftId,
    title: "Hello",
    document: OPENING,
    isDirty: false,
  });
}

const panel = () => screen.getByRole("dialog", { name: "Metadata" });
const slugBox = () => within(panel()).getByLabelText("Slug");

beforeEach(() => {
  useEditorStore.getState().reset();
  postActions.isPostSlugAvailable.mockReset().mockResolvedValue(true);
});

afterEach(() => cleanup());

describe("PostMetadataPanel", () => {
  it("is headed Metadata and goes away from its header", async () => {
    seed();
    const onDismiss = vi.fn();
    render(<PostMetadataPanel onDismiss={onDismiss} />);
    expect(within(panel()).getByText("Metadata")).toBeDefined();

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Close properties panel" }));
    await waitFor(() => expect(onDismiss).toHaveBeenCalledOnce());
  });

  // The buffer can become a different post under an open sidebar — the editor
  // reading one in, a new draft's first save giving it an id. The sidebar has
  // to describe the post that arrives, not the buffer it met.
  it("describes the post once the editor has read it in", async () => {
    render(<PostMetadataPanel onDismiss={vi.fn()} />);
    act(() =>
      seed({ slug: "hello", description: "For search.", draftId: "post-1" }),
    );
    expect((slugBox() as HTMLInputElement).value).toBe("hello");
    expect(
      (
        within(panel()).getByRole("textbox", {
          name: "Description",
        }) as HTMLTextAreaElement
      ).value,
    ).toBe("For search.");
  });

  describe("category", () => {
    it("offers every category a post can be filed under, with this one chosen", () => {
      seed({ category: "WORK" });
      render(<PostMetadataPanel onDismiss={vi.fn()} />);
      const options = within(panel()).getAllByRole("option");
      expect(options.map((option) => option.textContent)).toEqual([
        "Project",
        "Article",
        "Prototype",
      ]);
      expect(
        within(panel())
          .getByRole("option", { name: "Project" })
          .getAttribute("aria-selected"),
      ).toBe("true");
    });

    it("files the post under the one chosen, as an unsaved change", async () => {
      seed();
      render(<PostMetadataPanel onDismiss={vi.fn()} />);
      await userEvent
        .setup()
        .click(within(panel()).getByRole("option", { name: "Prototype" }));
      expect(useEditorStore.getState().category).toBe("PROTOTYPE");
      expect(useEditorStore.getState().isDirty).toBe(true);
    });

    // A page is read at an address of its own — `/about`, `/` — so there is
    // nothing to file it under and no slug to change.
    it("offers no address on a page", () => {
      seed({ category: "PAGE", slug: "about" });
      render(<PostMetadataPanel onDismiss={vi.fn()} />);
      expect(within(panel()).queryByRole("option")).toBeNull();
      expect(within(panel()).queryByLabelText("Slug")).toBeNull();
      expect(
        within(panel()).getByRole("button", { name: "Add description" }),
      ).toBeDefined();
    });
  });

  describe("slug", () => {
    it("shows the post's address", () => {
      seed({ slug: "hello" });
      render(<PostMetadataPanel onDismiss={vi.fn()} />);
      expect((slugBox() as HTMLInputElement).value).toBe("hello");
    });

    it("takes a new address once it is free, after the typing stops", async () => {
      seed();
      render(<PostMetadataPanel onDismiss={vi.fn()} />);
      fireEvent.change(slugBox(), { target: { value: "renamed" } });

      // Not on the keystroke.
      expect(useEditorStore.getState().slug).toBe("hello");
      await waitFor(() =>
        expect(useEditorStore.getState().slug).toBe("renamed"),
      );
      expect(postActions.isPostSlugAvailable).toHaveBeenCalledWith(
        "renamed",
        "post-1",
      );
      expect(useEditorStore.getState().isDirty).toBe(true);
    });

    // Refused silently: no message beside the box, and the post keeps the
    // address it had. The box is marked invalid for assistive technology.
    const invalid = () => slugBox().getAttribute("aria-invalid") === "true";
    const pause = () => new Promise((resolve) => setTimeout(resolve, 500));

    it("keeps the old address when the domain refuses the new one, and says nothing", async () => {
      seed();
      render(<PostMetadataPanel onDismiss={vi.fn()} />);
      fireEvent.change(slugBox(), { target: { value: "Not OK" } });
      await waitFor(() => expect(invalid()).toBe(true));
      expect(useEditorStore.getState().slug).toBe("hello");
      expect(postActions.isPostSlugAvailable).not.toHaveBeenCalled();
      expect(
        within(panel()).queryByText(
          "Use lowercase letters, numbers and hyphens.",
        ),
      ).toBeNull();
    });

    it("keeps the old address when another post already has the new one", async () => {
      postActions.isPostSlugAvailable.mockResolvedValue(false);
      seed();
      render(<PostMetadataPanel onDismiss={vi.fn()} />);
      fireEvent.change(slugBox(), { target: { value: "taken" } });
      await waitFor(() => expect(invalid()).toBe(true));
      expect(useEditorStore.getState().slug).toBe("hello");
      expect(
        within(panel()).queryByText("Another post already uses that address."),
      ).toBeNull();
    });

    // Only the answer to the LAST thing typed may land: a slow "is it free?"
    // for a half-typed address must not overwrite the finished one.
    it("ignores an answer that arrives for an address since replaced", async () => {
      let answerFirst: (free: boolean) => void = () => {};
      postActions.isPostSlugAvailable
        .mockImplementationOnce(
          () => new Promise<boolean>((resolve) => (answerFirst = resolve)),
        )
        .mockResolvedValueOnce(true);
      seed();
      render(<PostMetadataPanel onDismiss={vi.fn()} />);

      fireEvent.change(slugBox(), { target: { value: "first" } });
      await waitFor(() =>
        expect(postActions.isPostSlugAvailable).toHaveBeenCalledOnce(),
      );
      fireEvent.change(slugBox(), { target: { value: "second" } });
      await waitFor(() =>
        expect(useEditorStore.getState().slug).toBe("second"),
      );
      answerFirst(true);
      await Promise.resolve();
      expect(useEditorStore.getState().slug).toBe("second");
    });

    it("drops the invalid mark once the address is fixed", async () => {
      seed();
      render(<PostMetadataPanel onDismiss={vi.fn()} />);
      fireEvent.change(slugBox(), { target: { value: "Bad" } });
      await waitFor(() => expect(invalid()).toBe(true));
      fireEvent.change(slugBox(), { target: { value: "good" } });
      await waitFor(() => expect(invalid()).toBe(false));
      expect(useEditorStore.getState().slug).toBe("good");
    });

    // A draft that has never been saved has no address; its first save mints
    // one from the title unless the author types one first.
    it("offers the address the title would mint on a draft that has none", () => {
      seed({ slug: null, draftId: null });
      useEditorStore.setState({ title: "A New Idea" });
      render(<PostMetadataPanel onDismiss={vi.fn()} />);
      expect((slugBox() as HTMLInputElement).value).toBe("");
      expect(slugBox().getAttribute("placeholder")).toBe("a-new-idea");
    });

    it("leaves a new draft's address to the title when the box is emptied", async () => {
      seed({ slug: null, draftId: null });
      render(<PostMetadataPanel onDismiss={vi.fn()} />);
      fireEvent.change(slugBox(), { target: { value: "x" } });
      fireEvent.change(slugBox(), { target: { value: "" } });
      await pause();
      expect(useEditorStore.getState().slug).toBeNull();
      expect(invalid()).toBe(false);
    });
  });

  describe("description", () => {
    it("is shut while the page is described by its opening", () => {
      seed();
      render(<PostMetadataPanel onDismiss={vi.fn()} />);
      expect(within(panel()).queryByRole("textbox", { name: "Description" })).toBeNull();
    });

    it("opens on the written description", () => {
      seed({ description: "For search." });
      render(<PostMetadataPanel onDismiss={vi.fn()} />);
      expect(
        (within(panel()).getByRole("textbox", { name: "Description" }) as HTMLTextAreaElement)
          .value,
      ).toBe("For search.");
    });

    // The placeholder is what the page says NOW, so the author can see what
    // they are replacing.
    it("shows the opening it stands in for, and takes what is typed", async () => {
      seed();
      render(<PostMetadataPanel onDismiss={vi.fn()} />);
      const user = userEvent.setup();
      await user.click(
        within(panel()).getByRole("button", { name: "Add description" }),
      );
      const box = within(panel()).getByRole("textbox", {
        name: "Description",
      }) as HTMLTextAreaElement;
      expect(box.placeholder).toBe("The opening line of the post.");
      // Opening the section is not itself a change.
      expect(useEditorStore.getState().isDirty).toBe(false);

      await user.type(box, "Hi");
      expect(useEditorStore.getState().description).toBe("Hi");
      expect(useEditorStore.getState().isDirty).toBe(true);
    });

    it("hands the page back to its opening when removed", async () => {
      seed({ description: "For search." });
      render(<PostMetadataPanel onDismiss={vi.fn()} />);
      await userEvent
        .setup()
        .click(
          within(panel()).getByRole("button", { name: "Remove description" }),
        );
      expect(useEditorStore.getState().description).toBeNull();
    });

    it("holds a description to the length the domain allows", async () => {
      seed({ description: "" });
      render(<PostMetadataPanel onDismiss={vi.fn()} />);
      expect(
        within(panel()).getByRole("textbox", { name: "Description" }).getAttribute("maxlength"),
      ).toBe("200");
    });
  });
});
