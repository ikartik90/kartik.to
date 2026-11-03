"use client";

import { Fragment, useCallback, useId, useRef, useState } from "react";
import { css } from "../../../../styled-system/css";
import { useDismiss } from "@/hooks/use-dismiss";
import { useControllable, useOpen } from "./controllable";
import { ItemContext, ListItem, listStyle, useListKeys } from "./dropdown";
import {
  Chip,
  Divider,
  Presence,
  Typography,
  anchorStyle,
  boxRaw,
  useEscapeLayer,
  useField,
  useHang,
  useFocusWithin,
} from "./ui";

// A tags field: a Text Input's box holding its tags as large chips, then what's typed, which suggests the tags its
// owner already has or creates one. It grows a line at a time as its chips wrap.

const boxStyle = css(boxRaw, {
  flexWrap: "wrap",
  gap: "var(--sw-gap-xs) var(--sw-gap-md)",
  height: "auto",
  minHeight: "2.5rem",
  paddingBlock: "var(--sw-padding-xs)",
  "& > input": { flexBasis: "4rem" },
  "&[data-disabled]": { cursor: "default" },
});

// The chips sit in the box's own lines, beside what's typed.
const chipsStyle = css({ display: "contents" });

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Its tags, each a large chip its cross takes away, and a type-ahead after them: what's typed suggests the `options` not
 * yet added whose words hold it, then, unless a tag's already called that, to create it. It holds its tags, from
 * `defaultValue`, unless its owner holds `value`. As `keywords`, a comma adds what's typed, and its last suggestion adds
 * it as a keyword.
 */
export function TagsField({
  options,
  value: held,
  defaultValue = [],
  onChange,
  keywords,
  disabled: off,
}: {
  options: string[];
  value?: string[];
  defaultValue?: string[];
  onChange?: (tags: string[]) => void;
  keywords?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  const [tags, setTags] = useControllable(held, defaultValue, onChange);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const { open, setOpen, outside } = useOpen(false);
  const close = useCallback(() => setOpen(false), [setOpen]);
  const typed = query.trim();
  const suggestions = options.filter(
    (option) => !tags.some((tag) => same(tag, option)) && option.toLowerCase().includes(typed.toLowerCase()),
  );
  const creates = typed !== "" && ![...options, ...tags].some((tag) => same(tag, typed));
  const items = [...suggestions, ...(creates ? [typed] : [])];
  const listing = open && items.length > 0;
  const { side, style, hang, mark, ignore } = useHang(root, list, listing);
  useDismiss({ ref: root, onDismiss: close, enabled: open, dismissOnOutsidePointer: outside, ignoreSelector: ignore });
  useEscapeLayer(list, open, close);
  const keys = useListKeys(list, listing, () => setOpen(true), { typed: query });
  const [focused, focus] = useFocusWithin();
  const field = useField({ active: focused });
  const disabled = off ?? field.disabled;
  const add = (tag: string) => {
    setTags([...tags, tag]);
    setQuery("");
    close();
  };

  return (
    <div ref={root} className={anchorStyle} data-anchor="" {...focus}>
      <Typography
        tag="div"
        variant="bodyLarge"
        className={boxStyle}
        data-box=""
        data-state={disabled ? undefined : field.state}
        data-disabled={disabled ? "" : undefined}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) event.preventDefault();
        }}
        onClick={() => input.current?.focus()}
      >
        <div role="group" aria-labelledby={field.labelId} className={chipsStyle}>
          {tags.map((tag) => (
            <Chip key={tag} size="large" state="affirmative" disabled={disabled}>
              {tag}
              <Chip.Remove aria-label={`Remove ${tag}`} onClick={() => setTags(tags.filter((t) => t !== tag))} />
            </Chip>
          ))}
        </div>
        <input
          ref={input}
          id={field.id ?? id}
          role="combobox"
          aria-expanded={listing}
          aria-controls={`${id}-list`}
          aria-describedby={field.hintId}
          autoComplete="off"
          disabled={disabled}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (keys(event)) return;
            if (event.key === "Enter" && items[0]) {
              event.preventDefault();
              add(items[0]);
            } else if (keywords && event.key === ",") {
              event.preventDefault();
              if (typed) add(items.find((item) => same(item, typed)) ?? typed);
            } else if (event.key === "Backspace" && query === "" && tags.length) setTags(tags.slice(0, -1));
          }}
        />
      </Typography>
      {hang(
        <Presence>
          {listing && (
            <div
              ref={list}
              style={style}
              {...mark}
              id={`${id}-list`}
              className={listStyle}
              role="listbox"
              aria-labelledby={field.labelId}
              data-tall=""
              data-side={side}
              data-escape-layer=""
            >
              {items.map((item, i) => (
                <Fragment key={i === suggestions.length ? `create-${item}` : item}>
                  {i > 0 && <Divider />}
                  <ItemContext value={{ of: ListItem, selected: false, pick: () => add(item), keepFocus: true }}>
                    <ListItem>
                      <Typography variant="bodyLarge">{i < suggestions.length ? item : keywords ? `Add "${item}" keyword` : `Create "${item}" tag`}</Typography>
                    </ListItem>
                  </ItemContext>
                </Fragment>
              ))}
            </div>
          )}
        </Presence>,
      )}
    </div>
  );
}
