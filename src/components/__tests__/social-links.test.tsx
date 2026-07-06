// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  act,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@paper-design/shaders", () => ({
  toProcessedGemSmoke: vi.fn(() => Promise.resolve({ pngBlob: new Blob() })),
}));

vi.mock("@paper-design/shaders-react", () => ({
  GemSmoke: ({
    image,
    "data-shader-active": shaderActive,
  }: {
    image: string;
    "data-shader-active"?: string;
  }) => (
    <div
      data-social-icon-shader
      data-mask-src={image}
      data-shader-active={shaderActive}
    />
  ),
}));

import { SocialLinks } from "../social-links";

describe("SocialLinks", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("renders icon triggers with labels and tooltip text", () => {
    render(<SocialLinks />);

    expect(screen.getByRole("link", { name: "GitHub Profile" })).toBeDefined();
    expect(screen.getByRole("link", { name: "X Profile" })).toBeDefined();
    expect(
      screen.getByRole("link", { name: "LinkedIn Profile" }),
    ).toBeDefined();
    expect(screen.getByRole("button", { name: "Email Address" })).toBeDefined();

    expect(
      document.querySelector("[data-social-tooltip]")?.textContent,
    ).toBeDefined();
    expect(screen.getAllByText("GitHub Profile").length).toBeGreaterThanOrEqual(
      1,
    );
    expect(screen.getAllByText("X Profile").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("LinkedIn Profile").length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Email Address").length).toBeGreaterThanOrEqual(
      1,
    );
  });

  it("renders tooltip icons with viewBox so CSS scaling works at 14px", () => {
    render(<SocialLinks />);

    document
      .querySelectorAll<SVGSVGElement>("[data-social-tooltip-icon]")
      .forEach((svg) => {
        expect(svg.getAttribute("viewBox")).toBe("0 0 20 20");
      });
  });

  it("copies email from trigger click and shows check icon", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<SocialLinks />);

    const emailItem = Array.from(
      document.querySelectorAll("[data-social-link-item]"),
    ).find((item) => item.querySelector('button[aria-label="Email Address"]'));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Email Address" }));
    });

    expect(writeText).toHaveBeenCalledWith("ikartik90@gmail.com");
    expect(emailItem?.getAttribute("data-copy-success")).toBe("");
    expect(screen.getByRole("button", { name: "Copied" })).toBeDefined();
    expect(
      document.querySelector('[data-copy-action-icon="check"]'),
    ).toBeTruthy();
  });

  it("shows check icon after copying email tooltip and dismisses on other hover", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<SocialLinks />);

    const emailItem = Array.from(
      document.querySelectorAll("[data-social-link-item]"),
    ).find((item) => item.textContent?.includes("Email Address"));
    const emailTooltip = emailItem?.querySelector<HTMLButtonElement>(
      "[data-social-tooltip]",
    );

    await act(async () => {
      fireEvent.click(emailTooltip!);
    });

    expect(writeText).toHaveBeenCalledWith("ikartik90@gmail.com");
    expect(emailItem?.getAttribute("data-copy-success")).toBe("");
    expect(
      emailTooltip?.querySelector('[data-copy-action-icon="check"]'),
    ).toBeTruthy();
    expect(screen.getAllByText("Copied").length).toBeGreaterThanOrEqual(1);

    fireEvent.mouseEnter(screen.getByRole("link", { name: "GitHub Profile" }));
    expect(emailItem?.getAttribute("data-copy-success")).toBeNull();
    expect(emailItem?.getAttribute("data-tooltip-dismissed")).toBe("");

    await act(async () => {
      fireEvent.click(emailTooltip!);
    });
    expect(emailItem?.getAttribute("data-copy-success")).toBe("");

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(emailItem?.getAttribute("data-copy-success")).toBeNull();
    expect(emailItem?.getAttribute("data-tooltip-dismissed")).toBe("");
  });

  it("renders crisp SVG icons by default and shader only when hover mask is ready", async () => {
    render(<SocialLinks />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(document.querySelectorAll("[data-social-icon-shader]").length).toBe(
      4,
    );
    expect(document.querySelectorAll("[data-shader-active]").length).toBe(0);

    await act(async () => {
      fireEvent.mouseEnter(
        screen.getByRole("link", { name: "GitHub Profile" }),
      );
      await Promise.resolve();
    });

    const githubLink = screen.getByRole("link", { name: "GitHub Profile" });
    expect(
      githubLink.querySelector("[data-social-icon-shader][data-shader-active]"),
    ).toBeTruthy();
    expect(
      githubLink
        .querySelector("[data-social-icon-shader]")
        ?.getAttribute("data-mask-src"),
    ).toBe("/social-shader-masks/octocat.svg");
  });
});
