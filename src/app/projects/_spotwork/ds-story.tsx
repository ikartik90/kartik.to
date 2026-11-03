"use client";

import {
  Children,
  Fragment,
  isValidElement,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
} from "react";
import { css, cx } from "../../../../styled-system/css";
import { DESIGN_SYSTEM } from "./copy";
import { exampleName, fileOf } from "./ds-code";
import { highlight } from "./ds-highlight";
import { floorRaw, groundStyle, groundsStyle } from "./ds-ui";
import { TabGroup } from "./tabs";
import { Button, Typography } from "./ui";

// A component's page as shadcn/ui lays one out: examples, each its live component over its code. The components hold
// their own states, so each example works as it is.

export type Example = {
  /** A Figma property it shows; the first example, the component as Figma draws it, has none. */
  title?: string;
  /** The heading it sits under, with the examples beside it that share it. */
  group?: string;
  /** A control at the end of its title. */
  action?: ReactNode;
  ground?: "warning" | "dark";
  /**
   * `fill` stretches the example across its floor; `edge` makes it the floor, out to the box's edges; `scroll` keeps a
   * wider one at its own width, scrolling; `grow` holds one that grows as it's used at the floor's top, so it never moves.
   */
  layout?: "fill" | "edge" | "scroll" | "grow";
  render: () => ReactNode;
};

export type Story = {
  /** Its title, the last part of its Figma name. */
  id: string;
  figma: string;
  examples: Example[];
};

export const defineStory = (story: Story) => story;

/**
 * How many across variants `widths` wide go in `room`: three where each fits a third, else two, else one; and two
 * rather than three where three would leave one alone on the last row and two wouldn't.
 */
export function columnsFor(widths: number[], room: number) {
  const widest = Math.max(0, ...widths);
  const count = widths.length;
  for (let columns = Math.min(3, count); columns > 1; columns--) {
    if (widest * columns > room) continue;
    return columns === 3 && count % 3 === 1 && count % 2 === 0 ? 2 : columns;
  }
  return 1;
}

// Cells fill the floor edge to edge, so the example's box frames them; lines divide them only from each other. While
// measuring, each cell is as wide as its variant.
const variantsStyle = css({
  display: "grid",
  flex: "1 1 auto",
  alignSelf: "stretch",
  // Measuring, wide variants would otherwise stretch the grid past the floor, and its room with them.
  minWidth: 0,
  gridTemplateColumns: "repeat(var(--columns), minmax(0, 1fr))",
  "&[data-measuring]": { gridTemplateColumns: "repeat(var(--columns), max-content)" },
  "& > [data-cell]": {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
    padding: "var(--sw-padding-3xl)",
    borderColor: "var(--sw-border-subdued)",
    borderInlineEndWidth: "1px",
    borderBlockEndWidth: "1px",
  },
  // A filled cell keeps to the box's rounded corners.
  "& > [data-cell]:first-child": { borderStartStartRadius: "calc(var(--sw-radius-md) - 0.0625rem)" },
  "& > [data-top-end]": { borderStartEndRadius: "calc(var(--sw-radius-md) - 0.0625rem)" },
  "& > [data-row-end]": { borderInlineEndWidth: 0 },
  "& > [data-last-row]": { borderBlockEndWidth: 0 },
  // A short last row's last cell, no line after it, runs to the row's end, so it's centred across what it's drawn as.
  "& > [data-fills-row]": { gridColumnEnd: "span var(--span)" },
});

type Ground = Example["ground"];

/** A variant on the surface its tone is made for, which fills its cell. The code shows the variant alone. */
export function Surface({ children }: { ground: Ground; children: ReactNode }) {
  return children;
}

Surface.unwrap = ({ children }: { children: ReactNode }) => children;

const groundOf = (item: ReactNode) =>
  isValidElement<{ ground: Ground }>(item) && item.type === Surface ? item.props.ground : undefined;

/**
 * An example's variants, each centred in a cell of its own, which keeps room below for a popover it holds open. The code
 * shows the variants alone.
 */
export function Variants({ children }: { children: ReactNode }) {
  const items = Children.toArray(children);
  const root = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (columns !== null) return;
    const grid = root.current!;
    setColumns(columnsFor([...grid.children].map((cell) => (cell as HTMLElement).offsetWidth), grid.clientWidth));
  }, [columns]);
  const across = columns ?? items.length;
  const short = items.length % across;
  const lastRow = items.length - (short || across);
  const fills = (i: number) => short > 0 && i === items.length - 1;
  return (
    <div
      ref={root}
      className={variantsStyle}
      style={{ "--columns": across } as CSSProperties}
      data-variants=""
      data-measuring={columns === null ? "" : undefined}
    >
      {items.map((item, i) => (
        <div
          key={i}
          className={groundsStyle}
          data-cell=""
          data-ground={groundOf(item)}
          data-popover-room=""
          data-top-end={i === across - 1 ? "" : undefined}
          data-row-end={(i + 1) % across === 0 || i === items.length - 1 ? "" : undefined}
          data-last-row={i >= lastRow ? "" : undefined}
          data-fills-row={fills(i) ? "" : undefined}
          style={fills(i) ? ({ "--span": across - short + 1 } as CSSProperties) : undefined}
        >
          {item}
        </div>
      ))}
    </div>
  );
}

Variants.unwrap = ({ children }: { children: ReactNode }) => children;

// The two share one grid cell, so the cell is as big as the larger: the reserve, drawn but unseen and untouchable.
const reserveStyle = css({
  display: "grid",
  alignItems: "start",
  "& > *": { gridArea: "1 / 1" },
  "& > [data-reserve]": { visibility: "hidden", pointerEvents: "none" },
});

/**
 * `children` in the room its `largest` state takes, so growing into that state (a switch opening what it holds) moves
 * nothing round it. The code shows `children` alone.
 */
export function Reserve({ largest, children }: { largest: ReactNode; children: ReactNode }) {
  return (
    <div className={reserveStyle}>
      {children}
      <div data-reserve="" aria-hidden inert>
        {largest}
      </div>
    </div>
  );
}

Reserve.unwrap = ({ children }: { children: ReactNode }) => children;

const storyStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "calc(2 * var(--sw-gap-3xl))",
});

const exampleStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "var(--sw-gap-xl)",
});

// An example's title with a control at its end.
const titleStyle = css({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--sw-gap-xl)" });

// A group's examples, nearer each other than the story's; its heading sits over them as a title over its box.
const groupedStyle = css({ display: "flex", flexDirection: "column", gap: "var(--sw-gap-3xl)" });

const floorStyle = css(floorRaw);

// Nothing clips the box, so a popover opened in it can hang over its code, as shadcn/ui's previews let theirs; its
// floor and code round its corners instead.
const boxStyle = css({
  display: "flex",
  flexDirection: "column",
  borderRadius: "var(--sw-radius-md)",
  border: "1px solid var(--sw-border-subdued)",
  backgroundColor: "var(--sw-surface-default)",
  "& > :first-child": {
    borderStartStartRadius: "calc(var(--sw-radius-md) - 0.0625rem)",
    borderStartEndRadius: "calc(var(--sw-radius-md) - 0.0625rem)",
  },
  "& > :last-child, & > [role=tabpanel]": {
    borderEndStartRadius: "calc(var(--sw-radius-md) - 0.0625rem)",
    borderEndEndRadius: "calc(var(--sw-radius-md) - 0.0625rem)",
  },
  // shadcn's preview height.
  "& > [data-canvas]": { minHeight: "18rem" },
  "& > [data-canvas]:has(> [data-variants])": { padding: "var(--sw-padding-none)" },
  // Its tabs' panels share one cell, as tall as the taller, so switching moves nothing; its current tab joins the code.
  "&[data-tabbed]": { display: "grid", gridTemplateRows: "auto auto" },
  "&[data-tabbed] > [role=tabpanel]": { gridArea: "2 / 1" },
  "&[data-tabbed] > [aria-hidden]": { visibility: "hidden" },
  "&[data-tabbed] > [data-code]": { backgroundColor: "var(--sw-surface-default)", boxShadow: "none" },
  // At a card's end, out over its padding to its sides and foot, its border on the card's.
  "&[data-bleed]": {
    marginInline: "calc(-1 * var(--sw-padding-xl))",
    marginBlockEnd: "calc(-1 * var(--sw-padding-xl))",
    borderStartStartRadius: "var(--sw-radius-none)",
    borderStartEndRadius: "var(--sw-radius-none)",
    "& > :first-child": { borderStartStartRadius: "var(--sw-radius-none)", borderStartEndRadius: "var(--sw-radius-none)" },
  },
});

// The site's code face, mono at Body's size and line height, the one font set outside Typography; three lines show
// until it's opened.
const codeStyle = css({
  position: "relative",
  backgroundColor: "var(--sw-surface-subdued)",
  boxShadow: "inset 0 1px 0 var(--sw-border-subdued)",
  "& > pre": {
    margin: "var(--sw-margin-none)",
    paddingBlock: "var(--sw-padding-lg)",
    paddingInlineEnd: "var(--sw-padding-xl)",
    maxHeight: "18rem",
    overflow: "auto",
    font: "var(--sw-text-style-3)",
    fontFamily: "jetbrainsMono",
    tabSize: 2,
    color: "var(--sw-glyph-default)",
    counterReset: "line",
  },
  "&:not([data-open]) > pre": {
    maxHeight: "calc(3 * 1.5rem + 2 * var(--sw-padding-lg))",
    overflow: "hidden",
    maskImage: "linear-gradient(to bottom, black 20%, transparent)",
  },
  "& [data-line]::before": {
    counterIncrement: "line",
    content: "counter(line)",
    display: "inline-block",
    minWidth: "2ch",
    marginInline: "var(--sw-margin-xl) var(--sw-margin-xxl)",
    textAlign: "end",
    color: "var(--sw-glyph-placeholder)",
  },
  "& [data-kind=keyword]": { color: "var(--sw-glyph-alert)" },
  "& [data-kind=string]": { color: "var(--sw-glyph-warning)" },
  "& :is([data-kind=tag], [data-kind=name])": { color: "var(--sw-glyph-success)" },
  "& [data-kind=attribute]": { color: "var(--sw-glyph-selected)" },
  "& [data-kind=comment]": { color: "var(--sw-glyph-placeholder)" },
  // Wrapped, open in full, a line too long breaking under its own indentation (`--indent`, in characters) past its number.
  "&[data-wrap][data-open] > pre": { maxHeight: "none", whiteSpace: "normal" },
  "&[data-wrap] [data-line]": {
    position: "relative",
    display: "block",
    minHeight: "1lh",
    paddingInlineStart: "calc(var(--sw-margin-xl) + 2ch + var(--sw-margin-xxl) + var(--indent, 0) * 1ch)",
    textIndent: "calc(var(--indent, 0) * -1ch)",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  },
  "&[data-wrap] [data-line]::before": { position: "absolute", insetInlineStart: 0, textIndent: 0 },
  "& > [data-cover]": { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" },
  // A secondary button has no fill of its own, so the code would show through it.
  "& > [data-cover] > span": { borderRadius: "var(--sw-radius-xs)", backgroundColor: "var(--sw-surface-default)" },
});

/**
 * `code`, coloured and numbered, folded to its first lines until it's shown in full, or `opened`; to `wrap`, in full
 * once open, its long lines broken rather than scrolled.
 */
function Code({ code, opened = false, wrap, ...props }: { code: string; opened?: boolean; wrap?: boolean } & ComponentProps<"div">) {
  const [open, setOpen] = useState(opened);
  return (
    <div className={codeStyle} data-code="" data-open={open ? "" : undefined} data-wrap={wrap ? "" : undefined} {...props}>
      <pre>
        <code>
          {highlight(code).map((line, i) => (
            <Fragment key={i}>
              {i > 0 && "\n"}
              <span
                data-line=""
                style={wrap ? ({ "--indent": /^ */.exec(line.map((token) => token.text).join(""))![0].length } as CSSProperties) : undefined}
              >
                {line.map((token, j) => (
                  <span key={j} data-kind={token.kind === "plain" ? undefined : token.kind}>
                    {token.text}
                  </span>
                ))}
              </span>
            </Fragment>
          ))}
        </code>
      </pre>
      {!open && (
        <div data-cover="">
          <span>
            <Button size="small" emphasis="secondary" onClick={() => setOpen(true)}>
              {DESIGN_SYSTEM.showCode}
            </Button>
          </span>
        </div>
      )}
    </div>
  );
}

const TABS = ["code", "component"] as const;

/**
 * An example's specimen on its floor, over its folded `code`, which may `wrap`; `tabbed`, its code in full and wrapped
 * on the first of two tabs and its specimen on the second, the two as tall. To `bleed`, at a card's end across it.
 */
export function ExampleBox({
  specimen,
  code,
  wrap,
  tabbed,
  bleed,
  ground,
  layout,
}: { specimen: ReactNode; code: string; wrap?: boolean; tabbed?: boolean; bleed?: boolean } & Pick<Example, "ground" | "layout">) {
  const id = useId();
  const [tab, setTab] = useState<(typeof TABS)[number]>("code");
  // Both panels drawn, the one not current unseen and untouchable.
  const panel = (each: (typeof TABS)[number]) => ({
    id: `${id}-${each}-panel`,
    role: "tabpanel",
    "aria-labelledby": `${id}-${each}`,
    ...(each !== tab && { "aria-hidden": true, inert: true }),
  });
  const floor = (props?: ReturnType<typeof panel>) => (
    <div
      className={cx(groundStyle, floorStyle)}
      data-canvas=""
      data-ground={ground}
      data-layout={layout}
      data-popover-room=""
      {...props}
    >
      {specimen}
    </div>
  );
  return (
    <div className={boxStyle} data-bleed={bleed ? "" : undefined} data-tabbed={tabbed ? "" : undefined}>
      {tabbed ? (
        <>
          <TabGroup size="small" label={DESIGN_SYSTEM.example} value={tab} onChange={setTab}>
            {TABS.map((each) => (
              <TabGroup.Tab key={each} value={each} id={`${id}-${each}`} aria-controls={`${id}-${each}-panel`}>
                {DESIGN_SYSTEM[each]}
              </TabGroup.Tab>
            ))}
          </TabGroup>
          <Code code={code} opened wrap {...panel("code")} />
          {floor(panel("component"))}
        </>
      ) : (
        <>
          {floor()}
          <Code code={code} wrap={wrap} />
        </>
      )}
    </div>
  );
}

function ExampleBlock({ id, example }: { id: string; example: Example }) {
  const titleId = useId();
  const specimen = example.render();
  const Section = example.title ? "section" : "div";
  const heading = example.title && (
    <Typography tag={example.group ? "h3" : "h2"} variant={example.group ? "subheading" : "heading"} id={titleId}>
      {example.title}
    </Typography>
  );
  return (
    <Section className={exampleStyle} aria-labelledby={example.title ? titleId : undefined} data-example="">
      {example.action ? (
        <div className={titleStyle}>
          {heading}
          {example.action}
        </div>
      ) : (
        heading
      )}
      <ExampleBox
        specimen={specimen}
        code={fileOf(exampleName(id, example.title), specimen)}
        ground={example.ground}
        layout={example.layout}
      />
    </Section>
  );
}

/** Examples under their `group`'s heading. */
function ExampleGroup({ id, title, examples }: { id: string; title: string; examples: Example[] }) {
  const titleId = useId();
  return (
    <section className={exampleStyle} aria-labelledby={titleId}>
      <Typography tag="h2" variant="heading" id={titleId}>
        {title}
      </Typography>
      <div className={groupedStyle}>
        {examples.map((example) => (
          <ExampleBlock key={example.title} id={id} example={example} />
        ))}
      </div>
    </section>
  );
}

/** A component's page: its name, then its examples, those of a group together. */
export function DsStory({ story }: { story: Story }) {
  const runs = story.examples.reduce<{ group?: string; examples: Example[] }[]>((all, example) => {
    const last = all.at(-1);
    if (last && example.group && last.group === example.group) last.examples.push(example);
    else all.push({ group: example.group, examples: [example] });
    return all;
  }, []);
  return (
    <section className={storyStyle} aria-label={story.id} data-ds-story={story.figma}>
      <Typography tag="h1" variant="title">
        {story.id}
      </Typography>
      {runs.map(({ group, examples }, i) =>
        group ? (
          <ExampleGroup key={group} id={story.id} title={group} examples={examples} />
        ) : (
          <ExampleBlock key={examples[0].title ?? i} id={story.id} example={examples[0]} />
        ),
      )}
    </section>
  );
}
