// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The icon row is WebGL and has its own file; here it only has to be findable.
vi.mock("../social-links", () => ({ SocialLinks: () => <ul /> }));

import { IntroLinks } from "../intro-links";

describe("IntroLinks", () => {
  afterEach(() => cleanup());

  it("is the row of social icons", () => {
    render(<IntroLinks />);
    expect(
      screen.getByRole("navigation", { name: "Social links" }),
    ).toBeDefined();
  });

  // The way on to the About page is a `button_link` block in the homepage's
  // document now — content the author edits, not a button this row draws.
  it("draws no button of its own", () => {
    render(<IntroLinks />);
    expect(screen.queryByRole("link", { name: "About me" })).toBeNull();
  });
});
