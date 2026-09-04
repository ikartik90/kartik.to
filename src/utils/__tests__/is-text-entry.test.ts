import { describe, it, expect } from "vitest";
import { isTextEntry } from "../is-text-entry";

// ---------------------------------------------------------------------------
// Whether a key press belongs to something the visitor is typing into.
//
// The question a bare-key shortcut has to ask before it claims a character:
// `<` means "go up a level" on a page being read, and means `<` in a field.
// It is also the question ⌘Z asks before it steps the draft back rather than
// letting a field undo its own edit — see `use-draft-history`.
// ---------------------------------------------------------------------------

describe("isTextEntry", () => {
  const el = (html: string): HTMLElement => {
    const host = document.createElement("div");
    host.innerHTML = html;
    return host.firstElementChild as HTMLElement;
  };

  it("is true for an input", () => {
    expect(isTextEntry(el("<input />"))).toBe(true);
  });

  it("is true for a textarea", () => {
    expect(isTextEntry(el("<textarea></textarea>"))).toBe(true);
  });

  // The article editor and its sidenotes are contenteditable rather than
  // fields, and they are the surfaces most likely to be typing a bracket.
  //
  // The property is stubbed because jsdom does not implement it — real engines
  // compute it, and compute it true for any node INSIDE an editable region,
  // which is what a press in the editor actually reports as its target.
  it("is true for a contenteditable", () => {
    const host = el("<div></div>");
    Object.defineProperty(host, "isContentEditable", { value: true });
    expect(isTextEntry(host)).toBe(true);
  });

  it("is false for an ordinary element", () => {
    expect(isTextEntry(el("<div></div>"))).toBe(false);
  });

  it("is false for a button, which takes keys but types nothing", () => {
    expect(isTextEntry(el("<button></button>"))).toBe(false);
  });

  // `event.target` is typed as `EventTarget | null`, and a press with the
  // document itself as its target is not a press into a field.
  it("is false for a null target", () => {
    expect(isTextEntry(null)).toBe(false);
  });

  it("is false for a non-element target", () => {
    expect(isTextEntry(window)).toBe(false);
  });
});
