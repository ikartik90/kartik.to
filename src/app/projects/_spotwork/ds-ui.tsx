"use client";

import {
  createContext,
  useContext,
  useId,
  useState,
  type ComponentProps,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import { css } from "../../../../styled-system/css";
import { pageColumnRaw } from "./check-ins-app";
import { DESIGN_SYSTEM } from "./copy";
import { Table } from "./data-table";
import { TabGroup } from "./tabs";
import { Badge, Field, Switch, Typography, partition } from "./ui";
import SmallChevronDownIcon from "./assets/icons/small/chevron-down.svg";
import SmallChevronRightIcon from "./assets/icons/small/chevron-right.svg";

// The design system's page parts: a page of sections, each a card of a token collection or one of Figma's components.

const pageRaw = css.raw({
  display: "flex",
  flexDirection: "column",
  gap: "var(--sw-gap-3xl)",
  padding: "var(--sw-padding-3xl)",
});

export const pageStyle = css(pageRaw);

const centredPageStyle = css(pageRaw, pageColumnRaw, { paddingInline: "var(--sw-padding-none)" });

/** A section's page: its title over its cards, across the page or, `centred`, in the Check-ins page's column. */
export function DsPage({ title, centred, children }: { title: string; centred?: boolean; children: ReactNode }) {
  return (
    <div className={centred ? centredPageStyle : pageStyle}>
      <Typography tag="h1" variant="title">
        {title}
      </Typography>
      {children}
    </div>
  );
}

// The dots of the floor the design system's cover and its stories' specimens stand on.
export const floorRaw = css.raw({
  backgroundImage: "radial-gradient(var(--sw-border-subdued) 1px, transparent 1px)",
  backgroundSize: "var(--sw-padding-xxl) var(--sw-padding-xxl)",
});

// The ground Figma draws a set on, for the tones made for one.
const groundsRaw = css.raw({
  "&[data-ground=warning]": { backgroundColor: "var(--sw-surface-warning)", backgroundImage: "none" },
  "&[data-ground=dark]": { backgroundColor: "var(--sw-surface-inverted-default)", backgroundImage: "none" },
});

export const groundsStyle = css(groundsRaw);

const sectionStyle = css(groundsRaw, {
  display: "flex",
  flexDirection: "column",
  borderRadius: "var(--sw-radius-md)",
  backgroundColor: "var(--sw-surface-default)",
  boxShadow: "inset 0 0 0 1px var(--sw-border-subdued)",
  "&[data-ground=dark] > [data-head] > *": { color: "var(--sw-glyph-inverted-default)" },
  "& > [data-head]": {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "var(--sw-gap-xl)",
    padding: "var(--sw-padding-xl)",
    boxShadow: "inset 0 -1px 0 var(--sw-border-subdued)",
  },
  // An untitled section's controls, at its heading's end all the same.
  "& > [data-head] > :first-child:not(h2, [role=tablist])": { marginInlineStart: "auto" },
  "& > [data-body]": { display: "flex", flexDirection: "column", gap: "var(--sw-gap-3xl)", padding: "var(--sw-padding-xl)" },
  // Ending in a table, it ends 4px under the last row, as a card ending in its records does.
  "& > [data-body]:has(> [role=table]:last-child)": { paddingBlockEnd: "var(--sw-padding-xs)" },
  // Tabbed, its tabs fill its head; its edge is drawn over them, which would cover an inset one.
  "&[data-tabbed]": { position: "relative" },
  "&[data-tabbed]::after": {
    content: '""',
    position: "absolute",
    inset: 0,
    borderRadius: "inherit",
    boxShadow: "inset 0 0 0 1px var(--sw-border-subdued)",
    pointerEvents: "none",
  },
  "&[data-tabbed] > [data-head]": {
    alignItems: "stretch",
    padding: "var(--sw-padding-none)",
    overflow: "hidden",
    borderStartStartRadius: "var(--sw-radius-md)",
    borderStartEndRadius: "var(--sw-radius-md)",
    backgroundColor: "var(--sw-surface-subdued)",
    "& > [role=tablist]": { flex: "1 1 auto" },
    "& > :not([role=tablist])": { alignSelf: "center", marginInlineEnd: "var(--sw-margin-xl)" },
  },
});

export const groundStyle = css(groundsRaw, {
  padding: "var(--sw-padding-xl)",
  marginInline: "-1rem",
  // Within its card's edges, which a ground run out to them would cover.
  "&[data-inset]": { marginInline: "var(--sw-margin-none)", borderRadius: "var(--sw-radius-md)" },
  // A story's floor, its one specimen in the middle; its padding leaves a tooltip room.
  "&[data-canvas]": {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginInline: "var(--sw-margin-none)",
    padding: "var(--sw-padding-3xl)",
  },
  // A specimen that stretches to what holds it, across the floor.
  "&[data-canvas][data-layout=fill]": { flexDirection: "column", alignItems: "stretch" },
  // One that is the floor itself, clipped to the box's rounded top.
  "&[data-canvas][data-layout=edge]": { flexDirection: "column", alignItems: "stretch", padding: "var(--sw-padding-none)", overflow: "hidden" },
  // One wider than the floor, at its own width, the floor scrolling sideways.
  "&[data-canvas][data-layout=scroll]": { justifyContent: "safe center", overflowX: "auto" },
  "&[data-canvas][data-layout=grow], &[data-canvas][data-layout=grow] > [data-variants] > [data-cell]": {
    alignItems: "flex-start",
  },
});

/** A control at the end of a section's heading. */
function DsSectionAction({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/** One of a section's tabs: its `label`, and what shows while it's current, its own `Action`s with the section's. */
function DsSectionTab({ children }: { label: string; children: ReactNode }) {
  return <>{children}</>;
}

/**
 * A token collection (or one of Figma's sets) under its `title`; a page's only section goes untitled. Given `Tab`s, its
 * head is their tab group, `label`led, the first current until another's picked.
 */
function DsSectionRoot({ title, label, children }: { title?: string; label?: string; children: ReactNode }) {
  const id = useId();
  const [current, setCurrent] = useState(0);
  const [found, rest] = partition(children, DsSectionTab);
  const tabs = found as ReactElement<ComponentProps<typeof DsSectionTab>>[];
  const [actions, body] = partition(tabs.length ? [rest, tabs[current].props.children] : rest, DsSectionAction);
  return (
    <section className={sectionStyle} aria-label={title} data-tabbed={tabs.length ? "" : undefined}>
      {tabs.length > 0 ? (
        <div data-head="">
          <TabGroup size="small" label={label} value={String(current)} onChange={(tab) => setCurrent(Number(tab))}>
            {tabs.map((tab, i) => (
              <TabGroup.Tab key={tab.props.label} value={String(i)} id={`${id}-${i}`} aria-controls={`${id}-panel`}>
                {tab.props.label}
              </TabGroup.Tab>
            ))}
          </TabGroup>
          {actions}
        </div>
      ) : (
        (title || actions.length > 0) && (
          <div data-head="">
            {title && (
              <Typography tag="h2" variant="heading">
                {title}
              </Typography>
            )}
            {actions}
          </div>
        )
      )}
      {tabs.length > 0 ? (
        <div data-body="" id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${current}`}>
          {body}
        </div>
      ) : (
        <div data-body="">{body}</div>
      )}
    </section>
  );
}

export const DsSection = Object.assign(DsSectionRoot, { Action: DsSectionAction, Tab: DsSectionTab });

/** A switch under its `label`, for a section's heading. */
export function DsSwitch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <Field orientation="horizontal">
      <Field.Label>{label}</Field.Label>
      <Switch checked={checked} onChange={onChange} />
    </Field>
  );
}

const PixelsContext = createContext<{ pixels: boolean; setPixels: (on: boolean) => void }>({
  pixels: false,
  setPixels: () => {},
});

/** The site's one choice of sizes in rem or in px, wherever they're written. */
export function PixelValues({ children }: { children: ReactNode }) {
  const [pixels, setPixels] = useState(false);
  return <PixelsContext value={{ pixels, setPixels }}>{children}</PixelsContext>;
}

/** Whether sizes are written in px. */
export const usePixels = () => useContext(PixelsContext).pixels;

/** The switch between sizes in rem and in px, every one of them following it. */
export function PixelSwitch() {
  const { pixels, setPixels } = useContext(PixelsContext);
  return <DsSwitch label={DESIGN_SYSTEM.showPixels} checked={pixels} onChange={setPixels} />;
}

// A group its page was sent to takes the target surface and border, carried past its edges by shadows so nothing in it moves.
const groupStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "var(--sw-gap-xl)",
  "&[data-target]": {
    borderRadius: "var(--sw-radius-md)",
    backgroundColor: "var(--sw-surface-target)",
    boxShadow: "0 0 0 var(--sw-gap-xl) var(--sw-surface-target), 0 0 0 calc(var(--sw-gap-xl) + 1.5px) var(--sw-border-target)",
    scrollMarginBlockStart: "calc(2 * var(--sw-gap-xl))",
  },
});

/** A group inside a section, under its own heading; `targeted`, marked as what its page was sent to. */
export function DsGroup({
  title,
  tag = "h3",
  targeted,
  children,
}: {
  title: string;
  tag?: "h2" | "h3";
  targeted?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={groupStyle} data-target={targeted ? "" : undefined}>
      <Typography tag={tag} variant={tag === "h2" ? "heading" : "subheading"}>
        {title}
      </Typography>
      {children}
    </div>
  );
}

const labelStyle = css({ whiteSpace: "nowrap" });

/** A specimen's caption, or a figure's (`figcaption`). */
export function DsLabel({ tag = "span", children }: { tag?: "span" | "figcaption"; children: ReactNode }) {
  return (
    <Typography tag={tag} variant="metadata" color="placeholder" className={labelStyle}>
      {children}
    </Typography>
  );
}

/** A token's value or variable. */
export function DsCode({ children }: { children: ReactNode }) {
  return (
    <Typography variant="metadata" color="subdued">
      {children}
    </Typography>
  );
}

// Inside its card: no outline round it or lines between its columns, only its header's and its rows'. A cell's line is
// as tall as its row, its words centred in it, nothing cut short; a head row's cell spans the row.
const headRaw = css.raw({ "&:not(:last-child)": { boxShadow: "none" } });
const cellRaw = css.raw({
  "&:not(:last-child)": { boxShadow: "none" },
  "&:first-child": { paddingInlineStart: "calc(var(--sw-padding-sm) + var(--depth, 0) * var(--sw-padding-xxl))" },
  "&[role=rowheader]": { gridColumn: "1 / -1" },
  "& > [data-lead]": { alignSelf: "stretch" },
  "& > [data-lead] > [data-typography]": { overflow: "visible" },
});

// A head row's toggle, pressed anywhere on its row; its chevron as wide as the rows under it are indented.
const folderStyle = css({
  display: "flex",
  alignItems: "center",
  cursor: "pointer",
  outline: "none",
  "&::after": { content: '""', position: "absolute", inset: 0 },
  "&:focus-visible::after": { boxShadow: "inset 0 0 0 1.5px var(--sw-border-focus)" },
});
const folderNameStyle = css({ display: "flex", alignItems: "center", gap: "var(--sw-gap-xs)" });

/** A cell is its words, or its parts, each on a line of the row's. */
type Row = { key: string; cells: (ReactNode | ReactNode[])[]; depth?: number };

const depthOf = (row: Row) => row.depth ?? 0;

/** How many rows follow `rows[i]` deeper than it. */
function heldBy(rows: Row[], i: number) {
  const end = rows.findIndex((row, j) => j > i && depthOf(row) <= depthOf(rows[i]));
  return (end < 0 ? rows.length : end) - i - 1;
}

/** `rows` but those under a head row closed in `open`, each with its place in `rows`. */
function shownRows(rows: Row[], open: ReadonlySet<string>) {
  let closedAt = Infinity;
  return rows.flatMap((row, i) => {
    if (depthOf(row) > closedAt) return [];
    closedAt = row.cells.length === 1 && !open.has(row.key) ? depthOf(row) : Infinity;
    return [{ row, i }];
  });
}

/**
 * A table of tokens in the app's own table look. A row of one cell heads the rows `depth` deeper under it, closed until
 * pressed, with a count of them.
 */
export function DsTable({ label, columns, rows }: { label: string; columns: { label: string; width: string }[]; rows: Row[] }) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const toggle = (key: string) => setOpen((keys) => new Set(keys.has(key) ? [...keys].filter((k) => k !== key) : [...keys, key]));
  return (
    <Table aria-label={label} columns={columns.map((column) => column.width).join(" ")}>
      <Table.Head>
        <Table.Row>
          {columns.map((column) => (
            <Table.Cell key={column.label} css={headRaw}>
              <Typography variant="metadata">{column.label}</Typography>
            </Table.Cell>
          ))}
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {shownRows(rows, open).map(({ row, i }) => {
          const head = row.cells.length === 1;
          const expanded = open.has(row.key);
          return (
            <Table.Row key={row.key} style={{ "--depth": row.depth } as CSSProperties}>
              {head ? (
                <Table.Cell header css={cellRaw}>
                  <Typography
                    tag="button"
                    variant="bodyStrong"
                    type="button"
                    className={folderStyle}
                    aria-expanded={expanded}
                    onClick={() => toggle(row.key)}
                  >
                    {expanded ? <SmallChevronDownIcon aria-hidden /> : <SmallChevronRightIcon aria-hidden />}
                    <span className={folderNameStyle}>
                      {row.cells[0]}
                      <Badge>{heldBy(rows, i)}</Badge>
                    </span>
                  </Typography>
                </Table.Cell>
              ) : (
                row.cells.map((cell, j) => (
                  <Table.Cell key={j} css={cellRaw}>
                    {Array.isArray(cell) ? (
                      cell
                    ) : (
                      <Typography tag="div" variant="body">
                        {cell}
                      </Typography>
                    )}
                  </Table.Cell>
                ))
              )}
            </Table.Row>
          );
        })}
      </Table.Body>
    </Table>
  );
}

