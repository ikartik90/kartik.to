// @vitest-environment jsdom
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRef } from "react";
import { useDismiss } from "../use-dismiss";

afterEach(() => {
  cleanup();
  document.querySelectorAll("dialog").forEach((el) => el.remove());
});

function Harness(props: {
  onDismiss: () => void;
  dismissOnReflow?: boolean;
  enabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss({
    ref,
    onDismiss: props.onDismiss,
    dismissOnReflow: props.dismissOnReflow,
    enabled: props.enabled,
  });
  return (
    <div>
      <div ref={ref} data-testid="inside">
        <button>in</button>
      </div>
      <div data-testid="outside">out</div>
    </div>
  );
}

/** An open modal dialog with the focus in it, as `showModal()` leaves things. */
function openDialog(): HTMLInputElement {
  const dialog = document.createElement("dialog");
  dialog.setAttribute("open", "");
  const field = document.createElement("input");
  dialog.append(field);
  document.body.append(dialog);
  return field;
}

describe("useDismiss", () => {
  it("dismisses on Escape", () => {
    const onDismiss = vi.fn();
    render(<Harness onDismiss={onDismiss} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  // Escape closes ONE thing. Every open surface listens at the document, so
  // without an order among them a keypress meant for the combobox standing on a
  // panel takes the panel with it — which is the bug this locks out.
  it("gives Escape to the surface opened last, not to every open one", () => {
    const panel = vi.fn();
    const menu = vi.fn();
    const { rerender } = render(<Harness onDismiss={panel} />);
    rerender(
      <>
        <Harness onDismiss={panel} />
        <Harness onDismiss={menu} />
      </>,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(menu).toHaveBeenCalledTimes(1);
    expect(panel).not.toHaveBeenCalled();
  });

  // And the next press is the panel's, so two presses close two surfaces —
  // the layering is an order, not a mute.
  it("hands Escape back to the surface underneath once the top one goes", () => {
    const panel = vi.fn();
    const menu = vi.fn();
    const { rerender } = render(
      <>
        <Harness onDismiss={panel} />
        <Harness onDismiss={menu} />
      </>,
    );
    rerender(<Harness onDismiss={panel} />);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(panel).toHaveBeenCalledTimes(1);
  });

  it("prevents the default Escape action (so Safari doesn't leave fullscreen)", () => {
    const onDismiss = vi.fn();
    render(<Harness onDismiss={onDismiss} />);
    // fireEvent returns false when the dispatched event's default was prevented.
    const notPrevented = fireEvent.keyDown(document, { key: "Escape" });
    expect(notPrevented).toBe(false);
  });

  it("leaves other keys' default action intact", () => {
    const onDismiss = vi.fn();
    render(<Harness onDismiss={onDismiss} />);
    const notPrevented = fireEvent.keyDown(document, { key: "a" });
    expect(notPrevented).toBe(true);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("dismisses on outside pointer-down but not inside", () => {
    const onDismiss = vi.fn();
    render(<Harness onDismiss={onDismiss} />);
    fireEvent.pointerDown(screen.getByText("in"));
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.pointerDown(screen.getByTestId("outside"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("dismisses on scroll/resize only when dismissOnReflow is set", () => {
    const onDismiss = vi.fn();
    const { rerender } = render(<Harness onDismiss={onDismiss} />);
    fireEvent.scroll(window);
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(onDismiss).not.toHaveBeenCalled();

    rerender(<Harness onDismiss={onDismiss} dismissOnReflow />);
    fireEvent.scroll(window);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });

  // A modal <dialog> stands over every surface on the page and joins nothing:
  // it is shown by a `showModal()` made on a ref, from outside. So the rail it
  // covers is still the topmost LAYER, and would take the press meant for the
  // palette over it — the bug this locks out.
  it("leaves an Escape made inside an open dialog to that dialog", () => {
    const rail = vi.fn();
    render(<Harness onDismiss={rail} />);
    const field = openDialog();

    fireEvent.keyDown(field, { key: "Escape" });
    expect(rail).not.toHaveBeenCalled();
  });

  // The next press, made after the dialog has gone, is the rail's again — two
  // presses close two things, exactly as two stacked menus do.
  it("hands Escape back to the surface once the dialog has closed", () => {
    const rail = vi.fn();
    render(<Harness onDismiss={rail} />);
    const field = openDialog();
    fireEvent.keyDown(field, { key: "Escape" });

    field.closest("dialog")!.remove();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(rail).toHaveBeenCalledTimes(1);
  });

  // And a menu opened ON the dialog is a menu like any other: the exemption is
  // for what stands BEHIND one, not for everything while one is up.
  it("still dismisses a surface that lives inside the open dialog", () => {
    const menu = vi.fn();
    const dialog = document.createElement("dialog");
    dialog.setAttribute("open", "");
    document.body.append(dialog);
    render(<Harness onDismiss={menu} />, { container: dialog });

    fireEvent.keyDown(screen.getByText("in"), { key: "Escape" });
    expect(menu).toHaveBeenCalledTimes(1);
  });

  it("attaches nothing when disabled", () => {
    const onDismiss = vi.fn();
    render(<Harness onDismiss={onDismiss} enabled={false} dismissOnReflow />);
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.pointerDown(screen.getByTestId("outside"));
    fireEvent.scroll(window);
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
