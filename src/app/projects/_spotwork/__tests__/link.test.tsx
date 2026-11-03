import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Link } from "../ui";

afterEach(cleanup);

describe("Molecules/Link", () => {
  it("is a plain link, opening and closing nothing", () => {
    render(<Link>Link Text</Link>);
    const link = screen.getByRole("button", { name: "Link Text" });
    expect(link.hasAttribute("aria-expanded")).toBe(false);
    expect(link.querySelector("svg")).toBeNull();
  });
});
