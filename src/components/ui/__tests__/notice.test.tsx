// @vitest-environment jsdom
import { render, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Notice } from "../notice";

describe("Notice", () => {
  afterEach(() => cleanup());

  it("composes an icon + label under the root's notice slots", () => {
    const { container, getByText } = render(
      <Notice>
        <Notice.Icon>
          <svg data-testid="glyph" />
        </Notice.Icon>
        <Notice.Label>Heads up</Notice.Label>
      </Notice>,
    );

    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain("notice__root");
    expect(root.querySelector(".notice__icon")).not.toBeNull();
    expect(getByText("Heads up").className).toContain("notice__label");
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
    const icon = container.querySelector(".notice__icon") as HTMLElement;
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
