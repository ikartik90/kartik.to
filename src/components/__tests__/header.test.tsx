// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Header } from "../header";

describe("Header", () => {
  it("renders an element with the logo aria-label", () => {
    const { getByRole } = render(<Header />);
    expect(getByRole("img", { name: "Kartik Iyer" })).toBeDefined();
  });
});
