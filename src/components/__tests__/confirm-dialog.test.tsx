// @vitest-environment jsdom
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConfirmDialog, type ConfirmDialogProps } from "../confirm-dialog";
import { HAS_CURSOR_QUERY } from "@/data/media-queries";
import SaveIcon from "@/assets/icons/save.svg";
import TrashIcon from "@/assets/icons/trash.svg";

let hasCursor = true;

beforeEach(() => {
  hasCursor = true;
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: query === HAS_CURSOR_QUERY ? hasCursor : false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });

  // jsdom ships no `<dialog>` behaviour.
  HTMLDialogElement.prototype.showModal = vi.fn(function (
    this: HTMLDialogElement,
  ) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  });
});

afterEach(cleanup);

function renderExit(overrides: Partial<ConfirmDialogProps> = {}) {
  const props = {
    open: true,
    title: "Unsaved Changes",
    message: "You have unsaved changes to this preset. How do you want to proceed?",
    confirmLabel: "Save changes and exit",
    confirmIcon: SaveIcon,
    onConfirm: vi.fn(),
    alternate: {
      label: "Discard changes",
      icon: TrashIcon,
      onClick: vi.fn(),
    },
    onClose: vi.fn(),
    ...overrides,
  };
  const view = render(<ConfirmDialog {...props} />);
  return { ...view, props };
}

function renderDelete() {
  return renderExit({
    title: "Delete Preset",
    message: "You are about to delete this preset. This cannot be undone.",
    confirmLabel: "Delete",
    confirmIcon: TrashIcon,
    alternate: undefined,
  });
}

const dialog = () => screen.getByRole("dialog", { hidden: true });
const answers = () =>
  within(dialog())
    .getAllByRole("option", { hidden: true })
    .map((option) => option.getAttribute("data-value"));
const press = (key: string, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(document.activeElement ?? document.body, { key, ...init });

describe("ConfirmDialog", () => {
  it("lists the answers as rows: the affirmative, the alternate, then Cancel", () => {
    renderExit();
    expect(answers()).toEqual([
      "Save changes and exit",
      "Discard changes",
      "Cancel",
    ]);
  });

  it("lists only the affirmative and Cancel when there is no alternate", () => {
    renderDelete();
    expect(answers()).toEqual(["Delete", "Cancel"]);
  });

  it("says the question under its title", () => {
    renderExit();
    expect(
      within(dialog()).getByText(
        "You have unsaved changes to this preset. How do you want to proceed?",
      ),
    ).toBeTruthy();
  });

  it("names each row's key where there is a keyboard", () => {
    renderExit();
    const keys = within(dialog())
      .getAllByRole("option", { hidden: true })
      .map((option) => option.getAttribute("aria-keyshortcuts"));
    expect(keys).toEqual(["1", "0", "Escape"]);
    expect(
      [...dialog().querySelectorAll("kbd")].map((kbd) => kbd.textContent),
    ).toEqual(["1", "0", "Esc"]);
  });

  it("draws no key chips on a device without one", () => {
    hasCursor = false;
    renderExit();
    expect(dialog().querySelectorAll("kbd")).toHaveLength(0);
  });

  it("takes the focus into the rows on open, so the keys reach them", () => {
    renderExit();
    expect(dialog().contains(document.activeElement)).toBe(true);
  });

  it("starts on the affirmative", () => {
    renderExit();
    const selected = dialog().querySelector('[aria-selected="true"]');
    expect(selected?.getAttribute("data-value")).toBe("Save changes and exit");
  });

  it("answers with the affirmative on 1", () => {
    const { props } = renderExit();
    press("1");
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(props.alternate.onClick).not.toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalled();
  });

  it("answers with the alternate on 0", () => {
    const { props } = renderExit();
    press("0");
    expect(props.alternate.onClick).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).not.toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalled();
  });

  it("cancels on Escape without answering", () => {
    const { props } = renderExit();
    press("Escape");
    expect(props.onClose).toHaveBeenCalled();
    expect(props.onConfirm).not.toHaveBeenCalled();
    expect(props.alternate.onClick).not.toHaveBeenCalled();
  });

  it("does nothing on 0 when there is no alternate", () => {
    const { props } = renderDelete();
    press("0");
    expect(props.onConfirm).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("leaves a modified digit to the browser", () => {
    const { props } = renderExit();
    press("1", { metaKey: true });
    press("1", { ctrlKey: true });
    press("1", { altKey: true });
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it("answers with the highlighted row on Enter", () => {
    const { props } = renderExit();
    press("ArrowDown");
    press("Enter");
    expect(props.alternate.onClick).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it("answers with a row that is clicked", () => {
    const { props } = renderExit();
    fireEvent.click(
      within(dialog()).getByRole("option", {
        name: "Discard changes",
        hidden: true,
      }),
    );
    expect(props.alternate.onClick).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalled();
  });

  it("closes without answering from the Cancel row", () => {
    const { props } = renderExit();
    fireEvent.click(
      within(dialog()).getByRole("option", { name: "Cancel", hidden: true }),
    );
    expect(props.onClose).toHaveBeenCalled();
    expect(props.onConfirm).not.toHaveBeenCalled();
    expect(props.alternate.onClick).not.toHaveBeenCalled();
  });

  it("ignores the keys once closed, even with the focus left on the rows", () => {
    const { props } = renderExit();
    const root = document.querySelector("[cmdk-root]") as HTMLElement;
    press("Escape");
    expect(props.onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(root, { key: "1" });
    fireEvent.keyDown(root, { key: "0" });
    fireEvent.keyDown(root, { key: "Enter" });
    expect(props.onConfirm).not.toHaveBeenCalled();
    expect(props.alternate.onClick).not.toHaveBeenCalled();
  });

  it("starts on the affirmative again each time it opens", () => {
    const { props, rerender } = renderExit();
    press("ArrowDown");
    press("ArrowDown");
    expect(
      dialog().querySelector('[aria-selected="true"]')?.getAttribute("data-value"),
    ).toBe("Cancel");

    rerender(<ConfirmDialog {...props} open={false} />);
    rerender(<ConfirmDialog {...props} open />);
    expect(
      dialog().querySelector('[aria-selected="true"]')?.getAttribute("data-value"),
    ).toBe("Save changes and exit");
  });
});
