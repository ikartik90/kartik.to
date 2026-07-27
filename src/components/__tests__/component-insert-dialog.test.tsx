// @vitest-environment jsdom
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ComponentInsertDialog } from "../component-insert-dialog";

vi.mock("@/assets/icons/cross.svg", () => ({
  default: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-close" {...props} />
  ),
}));

vi.mock("@/components/demo-frame", () => ({
  DemoFrame: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="demo-frame">{children}</div>
  ),
}));

const mockDemoComponents = vi.hoisted(() => [
  {
    id: "alpha-demo",
    label: "Alpha Demo",
    load: async () => () => <div>alpha</div>,
  },
  {
    id: "beta-demo",
    label: "Beta Demo",
    load: async () => () => <div>beta</div>,
  },
]);

vi.mock("@/components/demo/registry", () => ({
  demoComponents: mockDemoComponents,
}));

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (
    this: HTMLDialogElement,
  ) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  });
});

afterEach(() => cleanup());

describe("ComponentInsertDialog", () => {
  it("lists every available component in the sidebar", () => {
    render(<ComponentInsertDialog open onClose={vi.fn()} onInsert={vi.fn()} />);
    expect(screen.getByRole("option", { name: "Alpha Demo" })).toBeDefined();
    expect(screen.getByRole("option", { name: "Beta Demo" })).toBeDefined();
  });

  it("selects the first component by default and previews it", () => {
    render(<ComponentInsertDialog open onClose={vi.fn()} onInsert={vi.fn()} />);
    expect(
      screen.getByRole("option", { name: "Alpha Demo" }).getAttribute("aria-selected"),
    ).toBe("true");
    // A non-interactive preview is rendered for the selection.
    expect(screen.getByTestId("demo-frame")).toBeDefined();
  });

  it("exposes the sidebar as a labelled listbox owning the options", () => {
    render(<ComponentInsertDialog open onClose={vi.fn()} onInsert={vi.fn()} />);
    const listbox = screen.getByRole("listbox", { name: "Component library" });
    // The options must be OWNED by the listbox, not orphaned siblings.
    expect(
      listbox.contains(screen.getByRole("option", { name: "Alpha Demo" })),
    ).toBe(true);
  });

  it("moves the selection with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<ComponentInsertDialog open onClose={vi.fn()} onInsert={vi.fn()} />);

    const first = screen.getByRole("option", { name: "Alpha Demo" });
    first.focus();
    await user.keyboard("{ArrowDown}");

    // Arrowing roves focus onto the next option, which Enter/click then commits.
    const second = screen.getByRole("option", { name: "Beta Demo" });
    expect(document.activeElement).toBe(second);
  });

  it("offers no delete action and no upload switch", () => {
    render(<ComponentInsertDialog open onClose={vi.fn()} onInsert={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /upload/i })).toBeNull();
  });

  it("inserts the selected component and closes", async () => {
    const onInsert = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <ComponentInsertDialog open onClose={onClose} onInsert={onInsert} />,
    );

    await user.click(screen.getByRole("option", { name: "Beta Demo" }));
    await user.click(screen.getByRole("button", { name: "Insert Component" }));

    expect(onInsert).toHaveBeenCalledWith("beta-demo");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes without inserting when Cancel is clicked", async () => {
    const onInsert = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <ComponentInsertDialog open onClose={onClose} onInsert={onInsert} />,
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onInsert).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
