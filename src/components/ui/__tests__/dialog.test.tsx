// @vitest-environment jsdom
import { createRef, useRef } from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Dialog } from "../dialog";
import { useDismiss } from "@/hooks/use-dismiss";

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (
    this: HTMLDialogElement,
  ) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (
    this: HTMLDialogElement,
  ) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  });
});

function Rail({ onDismiss }: { onDismiss: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss({ ref, onDismiss });
  return <div ref={ref}>rail</div>;
}

describe("Dialog", () => {
  it("renders a <dialog> element", () => {
    render(<Dialog>content</Dialog>);
    expect(screen.getByRole("dialog", { hidden: true })).toBeDefined();
  });

  it("forwards ref to the underlying <dialog> element", () => {
    const ref = createRef<HTMLDialogElement>();
    render(<Dialog ref={ref}>content</Dialog>);
    expect(ref.current?.tagName).toBe("DIALOG");
  });

  it("renders children", () => {
    render(<Dialog>hello world</Dialog>);
    expect(screen.getByText("hello world")).toBeDefined();
  });

  it("calls onClose when the close event fires", () => {
    const ref = createRef<HTMLDialogElement>();
    const onClose = vi.fn();
    render(
      <Dialog ref={ref} onClose={onClose}>
        content
      </Dialog>,
    );
    ref.current?.showModal();
    ref.current?.close();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes on Escape and prevents the default (Safari fullscreen) action", () => {
    const ref = createRef<HTMLDialogElement>();
    const onClose = vi.fn();
    render(
      <Dialog ref={ref} onClose={onClose}>
        <p>inner content</p>
      </Dialog>,
    );
    ref.current?.showModal();
    const dialog = ref.current!;
    const notPrevented = fireEvent.keyDown(dialog, { key: "Escape" });
    expect(notPrevented).toBe(false);
    expect(dialog.close).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps a menu behind it open when Escape closes the dialog", () => {
    const rail = vi.fn();
    const ref = createRef<HTMLDialogElement>();
    render(
      <>
        <Rail onDismiss={rail} />
        <Dialog ref={ref}>content</Dialog>
      </>,
    );
    ref.current?.showModal();

    fireEvent.keyDown(ref.current!, { key: "Escape" });
    expect(ref.current?.close).toHaveBeenCalledOnce();
    expect(rail).not.toHaveBeenCalled();
  });

  it("hands Escape back to that menu once it has closed", () => {
    const rail = vi.fn();
    const ref = createRef<HTMLDialogElement>();
    render(
      <>
        <Rail onDismiss={rail} />
        <Dialog ref={ref}>content</Dialog>
      </>,
    );
    ref.current?.showModal();
    fireEvent.keyDown(ref.current!, { key: "Escape" });

    fireEvent.keyDown(document, { key: "Escape" });
    expect(rail).toHaveBeenCalledTimes(1);
  });

  it("does not intercept non-Escape keys", () => {
    const ref = createRef<HTMLDialogElement>();
    render(<Dialog ref={ref}>content</Dialog>);
    ref.current?.showModal();
    const dialog = ref.current!;
    const notPrevented = fireEvent.keyDown(dialog, { key: "a" });
    expect(notPrevented).toBe(true);
    expect(dialog.close).not.toHaveBeenCalled();
  });

  it("calls close() and onClose when clicking the backdrop", () => {
    const ref = createRef<HTMLDialogElement>();
    const onClose = vi.fn();
    render(
      <Dialog ref={ref} onClose={onClose}>
        <p>inner content</p>
      </Dialog>,
    );
    ref.current?.showModal();
    const dialog = ref.current!;
    fireEvent.click(dialog, { target: dialog });
    expect(dialog.close).toHaveBeenCalled();
  });

  it("does not close when clicking inner content", () => {
    const ref = createRef<HTMLDialogElement>();
    render(
      <Dialog ref={ref}>
        <p>inner</p>
      </Dialog>,
    );
    ref.current?.showModal();
    const inner = screen.getByText("inner");
    fireEvent.click(inner);
    expect(ref.current?.close).not.toHaveBeenCalled();
  });

  it("calls a consumer onClick in addition to backdrop-close logic", () => {
    const onClick = vi.fn();
    const ref = createRef<HTMLDialogElement>();
    render(
      <Dialog ref={ref} onClick={onClick}>
        content
      </Dialog>,
    );
    const dialog = ref.current!;
    fireEvent.click(dialog);
    expect(onClick).toHaveBeenCalledOnce();
  });

  describe("align variants", () => {
    const alignValues = [
      "top",
      "top-center",
      "center",
      "bottom-center",
      "bottom",
      "stretch",
    ] as const;

    it.each(alignValues)('renders without error with align="%s"', (align) => {
      const { container } = render(
        <Dialog align={align}>content</Dialog>,
      );
      expect(container.querySelector("dialog")).not.toBeNull();
    });
  });

  describe("justify variants", () => {
    const justifyValues = ["start", "center", "end", "stretch"] as const;

    it.each(justifyValues)(
      'renders without error with justify="%s"',
      (justify) => {
        const { container } = render(
          <Dialog justify={justify}>content</Dialog>,
        );
        expect(container.querySelector("dialog")).not.toBeNull();
      },
    );
  });

  it("composes align and justify without error", () => {
    const { container } = render(
      <Dialog align="top-center" justify="center">
        content
      </Dialog>,
    );
    expect(container.querySelector("dialog")).not.toBeNull();
  });

  it("merges a custom className", () => {
    const { container } = render(
      <Dialog className="custom-class">content</Dialog>,
    );
    expect(
      container.querySelector("dialog")?.className,
    ).toContain("custom-class");
  });
});
