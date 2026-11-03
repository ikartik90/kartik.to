"use client";

import { cloneElement, createContext, useState, type ReactElement, type ReactNode } from "react";
import { css } from "../../../../styled-system/css";
import { useControllable } from "./controllable";
import { Table } from "./data-table";
import { Search } from "./search";
import { ownPart, partsOf, refuseOthers, restOf, textOf, useOwner } from "./slots";
import {
  Checkbox,
  FieldContext,
  Pill,
  Typography,
  pressesRow,
  sheetRowStyle,
  stickyHeadStyle,
  tableFrameStyle,
  tableScrollerRaw,
  useField,
  useFocusWithin,
} from "./ui";

// SW Curie's Atoms/Form/Multiselect as a table: a context search heading its options, each a row of its checkbox, its
// words and, given one, its pill at the end. A field's box: its outline lights up while anything in it has focus
// (Active), or takes its field's warning or alert; its rows scroll in the room it's left.

const undividedRaw = css.raw({ "&:not(:last-child)": { boxShadow: "none" } });
const acrossRaw = css.raw({ gridColumn: "1 / -1" });
// A body cell lays its words out in a lead that fills it.
const atEndRaw = css.raw({ "& > [data-lead]": { justifyContent: "flex-end" } });

// What a multiselect holds picked and what's searched in it, for its options.
const PickContext = createContext<{ value: string[]; onChange: (picked: string[]) => void; search: string } | null>(null);

/**
 * Atoms/Form/Multiselect: its search narrows its `Multiselect.Option`s to those whose words hold what's searched. It
 * holds the options picked, from `defaultValue`, unless its owner holds `value`. Named by its field's label, or
 * `aria-label`.
 */
function MultiselectRoot({
  value: held,
  defaultValue = [],
  onChange: heard,
  placeholder = "Search...",
  "aria-label": label,
  children,
}: {
  value?: string[];
  defaultValue?: string[];
  onChange?: (picked: string[]) => void;
  placeholder?: string;
  "aria-label"?: string;
  children?: ReactNode;
}) {
  refuseOthers(children, MultiselectOption);
  const [value, onChange] = useControllable(held, defaultValue, heard);
  const [search, setSearch] = useState("");
  const [focused, focus] = useFocusWithin();
  const field = useField({ active: focused });
  const options = partsOf(children, MultiselectOption);
  const pills = options.some((option) => partsOf((option.props as { children?: ReactNode }).children, Pill).length > 0);
  const named = field.labelId ? { "aria-labelledby": field.labelId } : { "aria-label": label ?? placeholder };
  return (
    <div className={tableFrameStyle} data-box="" data-multiselect="" data-state={field.state} {...focus}>
      <Table {...named} columns={pills ? "auto minmax(0, 1fr) auto" : "auto minmax(0, 1fr)"} css={tableScrollerRaw}>
        <Table.Head className={stickyHeadStyle}>
          <Table.Row>
            <Table.Cell css={acrossRaw}>
              <Search
                size="small"
                id={field.id}
                placeholder={placeholder}
                {...named}
                aria-describedby={field.hintId}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </Table.Cell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {/* Its checkboxes are its own, not its field's. */}
          <FieldContext value={{}}>
            <PickContext value={{ value, onChange, search }}>{options}</PickContext>
          </FieldContext>
        </Table.Body>
      </Table>
    </div>
  );
}
MultiselectRoot.displayName = "Multiselect";

/**
 * A multiselect's row: its checkbox, its words (its value unless given one), and a `Pill` given last at the row's end.
 * Shown while its words hold what's searched; `disabled`, kept as it's held, the whole row disabled.
 */
function MultiselectOption({ value: own, disabled, children }: { value?: string; disabled?: boolean; children: ReactNode }) {
  const pick = useOwner(PickContext, MultiselectOption);
  const words = restOf(children, Pill);
  const name = textOf(words);
  if (!name.toLowerCase().includes(pick.search.trim().toLowerCase())) return null;
  const value = own ?? name;
  const on = pick.value.includes(value);
  const pill = partsOf(children, Pill).map((each) => (disabled ? cloneElement(each as ReactElement<{ disabled?: boolean }>, { disabled }) : each));
  const set = (next: boolean) => pick.onChange(next ? [...pick.value, value] : pick.value.filter((picked) => picked !== value));
  return (
    <Table.Row
      className={disabled ? undefined : sheetRowStyle}
      data-picked={on && !disabled ? "" : undefined}
      onClick={disabled ? undefined : (event) => pressesRow(event) && set(!on)}
    >
      <Table.Cell css={undividedRaw}>
        <Checkbox aria-label={name} checked={on} disabled={disabled} onChange={set} />
      </Table.Cell>
      <Table.Cell css={undividedRaw}>
        <Typography variant="body" color={disabled ? "disabled" : undefined}>
          {words}
        </Typography>
      </Table.Cell>
      {pill.length > 0 && <Table.Cell css={atEndRaw}>{pill}</Table.Cell>}
    </Table.Row>
  );
}
MultiselectOption.displayName = "Multiselect.Option";

export const Multiselect = Object.assign(MultiselectRoot, { Option: ownPart(MultiselectOption) });
