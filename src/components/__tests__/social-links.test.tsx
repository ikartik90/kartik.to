// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  act,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The mask pre-pass is canvas + WebGL work jsdom cannot do; resolve it at once,
// so a hover here is the already-prepared case.
const preparedMasks = vi.hoisted(() => new Map<string, { src: string }>());
vi.mock("@/utils/gem-smoke-mask", () => ({
  prepareGemSmokeMask: async (src: string) => {
    preparedMasks.set(src, { src });
    return preparedMasks.get(src);
  },
  preparedGemSmokeMask: (src: string) => preparedMasks.get(src) ?? null,
}));

// ShaderMount is WebGL; stand in with a marker element — one per mounted
// instance, which is what this file counts.
vi.mock("@paper-design/shaders-react", () => ({
  ShaderMount: ({
    uniforms,
    ...props
  }: {
    uniforms: { u_image?: { src: string } };
    "data-shader-active"?: string;
  }) => (
    <div
      data-social-icon-shader
      data-mask-src={uniforms.u_image?.src}
      data-shader-active={props["data-shader-active"]}
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

    expect(screen.getByRole("link", { name: "GitHub" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Follow me" })).toBeDefined();
    expect(screen.getByRole("link", { name: "LinkedIn" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Email address" })).toBeDefined();

    expect(
      document.querySelector("[data-social-tooltip]")?.textContent,
    ).toBeDefined();
    expect(screen.getAllByText("GitHub").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Follow me").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("LinkedIn").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Email address").length).toBeGreaterThanOrEqual(
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
    ).find((item) => item.querySelector('button[aria-label="Email address"]'));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Email address" }));
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
    ).find((item) => item.textContent?.includes("Email address"));
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

    fireEvent.mouseEnter(screen.getByRole("link", { name: "GitHub" }));
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

  it("points one shader at the hovered icon, and keeps it after the hover", async () => {
    render(<SocialLinks />);

    // Nothing at rest — the row's single context is built in the background
    // once the page has settled, not during hydration.
    expect(document.querySelectorAll("[data-social-icon-shader]").length).toBe(
      0,
    );

    const githubLink = screen.getByRole("link", { name: "GitHub" });
    await act(async () => {
      fireEvent.mouseEnter(githubLink);
    });
    // A second flush: claiming the icon is one commit, and the mask it needs
    // resolving is the next.
    await act(async () => {});

    const shaders = document.querySelectorAll("[data-social-icon-shader]");
    // ONE for the whole row, wearing the hovered icon's mask — four contexts
    // compiling the same program is what this replaced.
    expect(shaders.length).toBe(1);
    expect(shaders[0].getAttribute("data-mask-src")).toBe(
      "/social-shader-masks/octocat.svg",
    );
    expect(shaders[0].getAttribute("data-shader-active")).toBe("");

    await act(async () => {
      fireEvent.mouseLeave(githubLink);
    });

    const parked = document.querySelectorAll("[data-social-icon-shader]");
    // Still mounted: tearing it down would mean compiling again on the next
    // hover, which is the whole cost being avoided.
    expect(parked.length).toBe(1);
    expect(parked[0].getAttribute("data-shader-active")).toBeNull();
  });
});
