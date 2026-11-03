"use client";

import { useState, type ComponentProps, type CSSProperties, type ReactNode } from "react";
import { css } from "../../../../styled-system/css";
import { Table } from "./data-table";
import { Button, Checkbox, Presence, SideSheet } from "./ui";

// A table's column of checkboxes: Select all in the middle of its header, each row's box as far in as its words.
export const pickHeadRaw = css.raw({ justifyContent: "center", paddingInline: "var(--sw-padding-none)" });
export const pickCellRaw = css.raw({ paddingInline: "var(--sw-padding-md)" });

/** The rows ticked, by their keys, out of those `shown`: one hidden since drops out, so nothing out of sight is acted on. */
export function usePicks<K>(shown: K[]) {
  const [picked, setPicked] = useState<K[]>([]);
  const chosen = shown.filter((key) => picked.includes(key));
  return {
    shown,
    chosen,
    has: (key: K) => chosen.includes(key),
    pick: (keys: K[], on: boolean) =>
      setPicked(on ? [...chosen, ...keys.filter((key) => !chosen.includes(key))] : chosen.filter((key) => !keys.includes(key))),
    clear: () => setPicked([]),
  };
}

export type Picks<K> = ReturnType<typeof usePicks<K>>;

/** Select all's header cell, ticked while every row shown is. */
export function PickAll<K>({ picks }: { picks: Picks<K> }) {
  return (
    <Table.Cell css={pickHeadRaw}>
      <Checkbox
        aria-label="Select all"
        checked={picks.shown.length > 0 && picks.chosen.length === picks.shown.length}
        onChange={(on) => picks.pick(picks.shown, on)}
      />
    </Table.Cell>
  );
}

/** A row's box, named by its row's `label`. */
export function PickOne<K>({ picks, value, label }: { picks: Picks<K>; value: K; label: string }) {
  return (
    <Table.Cell css={pickCellRaw}>
      <Checkbox aria-label={label} checked={picks.has(value)} onChange={(on) => picks.pick([value], on)} />
    </Table.Cell>
  );
}

/**
 * A side sheet's action bar over its foot while rows are ticked: Cancel unticks them, then the rows' own action, `label`,
 * on those ticked, which unticks them too. `room` goes on the panel it covers, so its last rows scroll clear of it.
 */
export function usePickBar<K>(
  picks: Picks<K>,
  { label, tone, onAct }: { label: ReactNode; tone?: ComponentProps<typeof Button>["tone"]; onAct: (chosen: K[]) => void },
) {
  const [bar, setBar] = useState<HTMLDivElement | null>(null);
  // `sheetBodyStyle`'s own padding, then the bar's height.
  const room: CSSProperties | undefined = bar ? { paddingBlockEnd: `calc(var(--sw-padding-xxl) + ${bar.offsetHeight}px)` } : undefined;
  const element = (
    <Presence>
      {picks.chosen.length > 0 && (
        <SideSheet.ActionBar floating ref={setBar}>
          <SideSheet.Cancel onClick={picks.clear} />
          <SideSheet.ForwardActions>
            <Button
              tone={tone}
              onClick={() => {
                onAct(picks.chosen);
                picks.clear();
              }}
            >
              {label}
            </Button>
          </SideSheet.ForwardActions>
        </SideSheet.ActionBar>
      )}
    </Presence>
  );
  return { room, bar: element };
}
