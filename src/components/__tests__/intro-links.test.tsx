// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// WebGL, tested in its own file.
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

  it("draws no button of its own", () => {
    render(<IntroLinks />);
    expect(screen.queryByRole("link", { name: "About me" })).toBeNull();
  });
});
