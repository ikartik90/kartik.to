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

const triggerClass = css({
  textAlign: "left",
  cursor: "pointer",
});

export interface ComboboxProps {
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  /** Set false for a list too short to filter; the list then takes focus itself. */
  search?: boolean;
  /** Set false inside a `position: fixed` surface, where a portalled menu cannot anchor. */
  portal?: boolean;
  /** Defaults to a case-insensitive label substring match. */
  filter?: (options: OptionItem[], query: string) => OptionItem[];
  emptyLabel?: string;
  /** The `Combobox.Option`s. */
  children: ReactNode;
}

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

  // Read from the children, so the label shows while the list is unmounted.
  const display = useMemo(
    () => collectOptions(children).find((o) => o.value === selected)?.label ?? "",
    [children, selected],
  );

  return (
    <>
      <Field.Frame
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
          // WebKit's default Tab order skips a bare <button>.
          tabIndex={0}
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
            // Scaled by the field; the list has two sizes, so `lg` takes `md`.
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

export const Combobox = Object.assign(ComboboxRoot, {
  Option: OptionList.Option,
});
