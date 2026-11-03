import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Search } from "../search";

afterEach(cleanup);

describe("Atoms/Context Search (Search, size small)", () => {
  it("is a search box named by its placeholder, taking what's typed", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [query, setQuery] = useState("");
      return <Search size="small" placeholder="Find a worker..." value={query} onChange={(event) => setQuery(event.target.value)} />;
    }
    render(<Harness />);
    const input = screen.getByRole<HTMLInputElement>("searchbox", { name: "Find a worker..." });
    await user.type(input, "rayna");
    expect(input.value).toBe("rayna");
  });

  it("takes a name of its own", () => {
    render(<Search size="small" placeholder="Find a worker..." aria-label="Find a worker" />);
    expect(screen.getByRole("searchbox", { name: "Find a worker" })).toBeTruthy();
  });

  it("sits in its toolbar boxed, or across its column", () => {
    render(<Search size="small" placeholder="Search..." boxed fill />);
    const box = screen.getByRole("searchbox").parentElement!;
    expect(box.tagName).toBe("LABEL");
    expect(box.hasAttribute("data-boxed")).toBe(true);
    expect(box.hasAttribute("data-fill")).toBe(true);
  });

  it("wears its tone, and holds Active", () => {
    render(<Search size="small" placeholder="Search..." boxed tone="warning" data-active="" />);
    const box = screen.getByRole("searchbox").parentElement!;
    expect(box.getAttribute("data-tone")).toBe("warning");
    expect(box.hasAttribute("data-active")).toBe(true);
  });

  it("can't be typed in while disabled", () => {
    render(<Search size="small" placeholder="Search..." boxed disabled />);
    const input = screen.getByRole<HTMLInputElement>("searchbox");
    expect(input.disabled).toBe(true);
    expect(input.parentElement!.hasAttribute("data-disabled")).toBe(true);
  });
});
