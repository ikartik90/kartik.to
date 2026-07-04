// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Header } from "../header";

const mockPathname = vi.fn(() => "/");

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

describe("Header", () => {
  beforeEach(() => {
    mockPathname.mockReturnValue("/");
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the circular logo, title, and tagline on the home page", () => {
    render(<Header />);
    expect(screen.getByRole("banner")).toBeDefined();
    expect(
      document.querySelector('img[src*="kartik-iyer-logo"]'),
    ).not.toBeNull();
    expect(screen.getByText("Kartik Iyer")).toBeDefined();
    expect(screen.getByText("DESIGNER • ENGINEER • BUILDER •")).toBeDefined();
  });

  it("renders nothing on non-home pages", () => {
    mockPathname.mockReturnValue("/writing/my-article");
    const { container } = render(<Header />);
    expect(container.firstChild).toBeNull();
  });
});
