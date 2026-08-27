"use client";

import { useMemo, useState, type ReactNode } from "react";
import { css, cx } from "../../../../styled-system/css";
import { comboboxPopover } from "../../../../styled-system/recipes";
import { Popover } from "@/components/ui/popover";
import { Field, useField } from "./field";
import { OptionList, collectOptions, type OptionItem } from "./option-list";
import ChevronDownIcon from "@/assets/icons/chevron-down.svg";
import ChevronUpIcon from "@/assets/icons/chevron-up.svg";
import { WireframeText } from "../wireframe";

// ---------------------------------------------------------------------------
// Combobox — the Select field's control, the OptionList's DatePicker. Composed
// INTO a <Field> exactly like DatePicker (label + hint are the consumer's
// Field.Label/Field.Hint siblings, not props):
//
//   <Field>
//     <Field.Label>Fruit</Field.Label>
//     <Combobox value={value} onValueChange={setValue}>
//       {fruits.map((f) => (
//         <Combobox.Option key={f.value} value={f.value}>{f.label}</Combobox.Option>
//       ))}
//     </Combobox>
//     <Field.Hint>Pick one</Field.Hint>
//   </Field>
//
// Options are authored as `Combobox.Option` children (the same leaf as
// `OptionList.Option`) — so the trigger can read their DATA to show the selected
// label even while the popover is closed (the option elements exist as props even
// when unmounted), and the SAME children are handed straight to the popover's
// OptionList when it opens.
//
// Collapsed, it renders the shared `field` frame (a button trigger showing the
// selected label + a chevron-down icon); the whole frame is the open
// target. Activated, the chevron flips up and a popover COVERS the frame (the
// `comboboxPopover` anchor recipe, the Select sibling of datePopover) holding the
// OptionList in `onBrand` tone with a filter search on top. Focus moves into the
// search on open and returns to the trigger on close (select / Escape /
// outside-click) — the DatePicker interaction, one control family over.
//
// `search={false}` drops the filter box for a list too short to filter; focus
// then lands on the highlighted OPTION and the arrows rove it — the OptionList's
// search-less keyboard model, not a degraded version of this one.
//
// The popover's list takes the FIELD's size, so a `sm` Select opens a `sm` menu.
// ---------------------------------------------------------------------------

const triggerClass = css({
  textAlign: "left",
  cursor: "pointer",
  // Placeholder colour (resting + active) is owned by the shared `field`
  // recipe's control slot, keyed off the `[data-placeholder]` sentinel — so it
  // recolors to the brand accent on focus/open like every other field control.
});

export interface ComboboxProps {
  /** Controlled selection (an option `value`). */
  value?: string | null;
  /** Initial selection when uncontrolled. */
  defaultValue?: string | null;
  /** Fired with the picked option's `value`. */
  onValueChange?: (value: string) => void;
  /** Shown in the trigger when nothing is selected. */
  placeholder?: string;
  /** Placeholder for the popover's filter search. */
  searchPlaceholder?: string;
  /**
   * Whether the popover carries a filter box. On by default — the Select's
   * whole point is a list too long to scan. Turn it off for a menu with so few
   * options that a type-ahead over them is furniture rather than help (the
   * colour picker's three formats): the list then takes focus itself and the
   * arrows rove it, which is the OptionList's other keyboard model.
   *
   * A prop rather than a composed child, because `children` is spent on the
   * OPTIONS here — the trigger has to read them as data to show the selected
   * label while the popover is closed, so there is no slot left to compose the
   * search into (as there is on a bare `OptionList`).
   */
  search?: boolean;
  /**
   * Whether the popover renders in a `document.body` portal. On by default, so
   * it escapes an ancestor that clips or contains it (a DemoFrame).
   *
   * Turn it OFF inside a `position: fixed` surface. CSS anchor positioning will
   * not accept an anchor whose containing-block chain does not pass through the
   * portalled popover's own containing block — and a fixed ancestor ends that
   * chain at the viewport, so the trigger becomes unanchorable and the menu
   * falls back to its static position at the foot of the document. Kept in
   * place, menu and trigger share a containing block and the anchor resolves.
   * The surface must then not clip its overflow (see `colorPickerPopover`).
   */
  portal?: boolean;
  /**
   * How the search narrows the options — forwarded to the OptionList. Defaults to
   * a case-insensitive label substring match.
   */
  filter?: (options: OptionItem[], query: string) => OptionItem[];
  /** Row shown when the filter leaves nothing. */
  emptyLabel?: string;
  /** The `Combobox.Option`s. */
  children: ReactNode;
}

/**
 * The Select control. Reads the field wiring (controlId to be the labelable
 * control, registerControl for the frame's focus-forward, focusControl to
 * restore focus on close) — so it must live inside a `<Field>`, like DatePicker.
 */
function ComboboxRoot({
  value,
  defaultValue,
  onValueChange,
  placeholder = "Select an option",
  searchPlaceholder = "Search…",
  search = true,
  portal = true,
  filter,
  emptyLabel,
  children,
}: ComboboxProps) {
  const { controlId, size, registerControl, focusControl, styles } =
    useField("Combobox");
  const [open, setOpen] = useState(false);

  const isControlled = value !== undefined;
  const [internal, setInternal] = useState<string | null>(defaultValue ?? null);
  const selected = isControlled ? (value ?? null) : internal;

  const close = () => {
    setOpen(false);
    focusControl();
  };

  const handleSelect = (next: string) => {
    if (!isControlled) setInternal(next);
    onValueChange?.(next);
    close();
  };

  // The selected option's label drives the trigger, read from the authored
  // children — available even while the popover (and its OptionList) is closed
  // and unmounted. A stale value with no matching option reads as empty, so the
  // placeholder shows rather than a blank frame.
  const display = useMemo(
    () => collectOptions(children).find((o) => o.value === selected)?.label ?? "",
    [children, selected],
  );

  return (
    <>
      <Field.Frame
        // The whole frame is the open target — the decorative chevron and the
        // frame's dead padding are non-interactive, so without this only a direct
        // hit on the value text would open it.
        onClick={() => setOpen(true)}
        className={css({ cursor: "pointer" })}
        style={{ anchorName: open ? "--combobox-popover" : undefined }}
      >
        <button
          ref={registerControl}
          id={controlId}
          type="button"
          data-control
          data-placeholder={display ? undefined : ""}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cx(styles.control, triggerClass)}
        >
          <WireframeText>{display || placeholder}</WireframeText>
        </button>
        {open ? (
          <ChevronUpIcon aria-hidden />
        ) : (
          <ChevronDownIcon aria-hidden />
        )}
      </Field.Frame>

      {open && (
        <Popover
          className={comboboxPopover()}
          role="dialog"
          ariaLabel="Choose an option"
          portal={portal}
          onDismiss={close}
        >
          <OptionList
            value={selected}
            onValueChange={handleSelect}
            filter={filter}
            emptyLabel={emptyLabel}
            tone="onBrand"
            // The list is scaled by the FIELD, like every other part of it: a
            // 28px trigger opening a menu on the 32px row pitch would be the
            // one place in the family where a size stopped at the frame. The
            // list draws two sizes to the field's three, so `lg` reads as the
            // base — it is the taller of the two either way.
            size={size === "sm" ? "sm" : "md"}
          >
            {search && (
              <Field.Search autoFocus placeholder={searchPlaceholder} />
            )}
            <OptionList.Listbox autoFocus={!search}>
              {children}
            </OptionList.Listbox>
          </OptionList>
        </Popover>
      )}
    </>
  );
}

/**
 * Compound select. `Combobox` is the trigger + popover assembly; `Combobox.Option`
 * (the shared `OptionList.Option` leaf) authors each row — so the same children
 * feed both the closed trigger's label and the open popover's list.
 */
export const Combobox = Object.assign(ComboboxRoot, {
  Option: OptionList.Option,
});
