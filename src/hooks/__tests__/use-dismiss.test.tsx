// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRef } from "react";
import { useDismiss } from "../use-dismiss";

afterEach(cleanup);

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

describe("useDismiss", () => {
  it("dismisses on Escape", () => {
    const onDismiss = vi.fn();
    render(<Harness onDismiss={onDismiss} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledTimes(1);
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

  it("attaches nothing when disabled", () => {
    const onDismiss = vi.fn();
    render(<Harness onDismiss={onDismiss} enabled={false} dismissOnReflow />);
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.pointerDown(screen.getByTestId("outside"));
    fireEvent.scroll(window);
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
