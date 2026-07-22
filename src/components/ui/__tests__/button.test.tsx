// @vitest-environment jsdom
import { createRef } from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { Button } from "../button";

describe("Button", () => {
  afterEach(() => cleanup());

  it("renders secondary label", () => {
    render(<Button>Cancel</Button>);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDefined();
  });

  it("renders link variant", () => {
    render(
      <Button variant="link">browse to upload</Button>,
    );
    expect(screen.getByRole("button", { name: "browse to upload" })).toBeDefined();
  });

  it("renders icon variant with aria-label", () => {
    render(
      <Button variant="icon" aria-label="Close dialog">
        ×
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Close dialog" })).toBeDefined();
  });

  it("blocks click when disabled", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Insert Image
      </Button>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Insert Image" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("forwards ref", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Go</Button>);
    expect(ref.current?.tagName).toBe("BUTTON");
  });
});
