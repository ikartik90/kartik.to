// @vitest-environment jsdom
import { render, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Notice } from "../notice";

describe("Notice", () => {
  afterEach(() => cleanup());

  it("sets the icon and the label side by side in the root", () => {
    const { container, getByTestId, getByText } = render(
      <Notice>
        <Notice.Icon>
          <svg data-testid="glyph" />
        </Notice.Icon>
        <Notice.Label>Heads up</Notice.Label>
      </Notice>,
    );

    const root = container.firstChild as HTMLElement;
    expect(getByTestId("glyph").parentElement!.parentElement).toBe(root);
    expect(getByText("Heads up").closest("p")!.parentElement).toBe(root);
  });

  it("merges a caller's css over a part's own, so one value wins", () => {
    const { getByText } = render(
      <Notice>
        <Notice.Label css={{ textStyle: "bodySmall" }}>Merged</Notice.Label>
      </Notice>,
    );
    const classes = getByText("Merged").closest("p")!.className.split(" ");
    expect(classes).toContain("textStyle_bodySmall");
    expect(classes).not.toContain("textStyle_sidenote");
  });

  it("marks the icon decorative so the meaning stays on the label", () => {
    const { container } = render(
      <Notice>
        <Notice.Icon>
          <svg />
        </Notice.Icon>
        <Notice.Label>Message</Notice.Label>
      </Notice>,
    );
    const icon = container.querySelector("svg")!.parentElement!;
    expect(icon.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders the label as a paragraph and keeps its emphasized runs", () => {
    const { getByText } = render(
      <Notice>
        <Notice.Icon>
          <svg />
        </Notice.Icon>
        <Notice.Label>
          Starts on <strong>Tuesday</strong>
        </Notice.Label>
      </Notice>,
    );
    const emphasis = getByText("Tuesday");
    expect(emphasis.tagName).toBe("STRONG");
    expect(emphasis.closest("p")).not.toBeNull();
  });

  it("forwards arbitrary attributes (role, aria-live) to the root", () => {
    const { container } = render(
      <Notice role="status" aria-live="polite">
        <Notice.Icon>
          <svg />
        </Notice.Icon>
        <Notice.Label>Live</Notice.Label>
      </Notice>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("role")).toBe("status");
    expect(root.getAttribute("aria-live")).toBe("polite");
  });
});
