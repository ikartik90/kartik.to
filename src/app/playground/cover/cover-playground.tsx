"use client";

import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import {
  ColorPanels,
  GodRays,
  StaticMeshGradient,
  Swirl,
  Warp,
} from "@paper-design/shaders-react";
import { css, cx } from "../../../../styled-system/css";
import { propertiesPanel } from "../../../../styled-system/recipes";
import { usePropertiesPanelInset } from "@/hooks/use-properties-panel-inset";
import { useSheetDrag } from "@/hooks/use-sheet-drag";
import { isBottomSheetLayout } from "@/data/media-queries";
import { useCoverDraftStore } from "@/store/cover-draft";
import { CosmicTrack } from "@/components/shaders/cosmic-track";
import { MenuButton } from "@/components/menu-button";
import { ThemeToggleButton } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input/field";
import { Slider } from "@/components/ui/input/slider";
import { Switch } from "@/components/ui/input/switch";
import { ColorInput } from "@/components/ui/input/color-input";
import { SegmentedControl } from "@/components/ui/input/segmented-control";
import { OptionList } from "@/components/ui/input/option-list";
import { Typography } from "@/components/ui/typography";
import { Tooltip } from "@/components/ui/tooltip";
import BottomSheetIcon from "@/assets/icons/bottom-sheet.svg";
import CrossIcon from "@/assets/icons/cross.svg";
import {
  SHADER_IDS,
  SHADER_SPECS,
  FRAMING_CONTROL_KEYS,
  MOTION_CONTROL_KEYS,
  type ControlSpec,
  type Params,
  type ShaderId,
  type ShaderSpec,
} from "@/data/shader-specs";
import type { CoverSettings } from "@/domain/cover";

// ---------------------------------------------------------------------------
// Cover Playground — where a cover's background is tuned, on its way to being
// published as a component. The art it is aimed at is the fanned light blades
// and soft colour washes of the reference covers.
//
// One shader is mounted at a time, which is deliberate: every paper-shaders
// instance holds its OWN webgl2 context, the library pools nothing and
// registers no `webglcontextlost` handler, so a page that rendered all five
// side by side would be one long session away from blank canvases. Compare by
// switching, not by tiling.
//
// The controls come from the table in `shader-specs.ts` rather than being
// written out here, so a range can only be wrong in one place.
//
// Client-side throughout: this is one long-lived piece of local state — which
// shader, its uniforms, the canvas theme — over a WebGL canvas, and none of it
// is the server's business. `page.tsx` next to this file is the route.
// ---------------------------------------------------------------------------

/** The preview is ~380×680 at 2×; no detail in a soft gradient survives above it. */
const MAX_PIXELS = 1280 * 1280;

// The page is the viewport, edge to edge — the canvas takes all of it.
//
// The panel's width is NOT reserved here: `usePropertiesPanelInset` insets the
// body while a panel is docked, everywhere in the app, and this page opts into
// that like every other. Reserving it a second time would inset the canvas
// twice and leave a band of nothing between the two.
//
// `padding: none` is stated rather than omitted because `main` already carries
// the site's own (globals.css) — 20px inline, 32px block — which would inset
// the canvas from the edges it is meant to reach. That inset is also why the
// panel is `fixed` rather than a flex child: in flow it would sit inside the
// padding instead of flush to the viewport's top, bottom and right.
//
// Two lengths the page hands down rather than each part working out for
// itself, because they are the SAME division of the viewport read twice: the
// canvas leaves room at its foot for the sheet, and the card sizes itself to
// what is left. Written as one variable the other is derived from, so the two
// cannot disagree about where the halfway line is.
//
//   --sheet-space  what the properties panel is holding: nothing while it is a
//                  side rail (it is `fixed`, and the body's own inset already
//                  answers for that), half the viewport while it is a sheet,
//                  and nothing again once the sheet has been sent away.
//   --card-space   everything the cover may NOT have: the sheet, the gutter
//                  controls' band, and the page's own margins.
const pageStyle = css({
  minHeight: "100dvh",
  backgroundColor: "bg.canvas",
  display: "flex",
  padding: "none",
  gap: 0,
  "--sheet-space": "0px",
  "--card-space": "calc(2 * token(spacing.xxl))",
  _bottomSheet: {
    "--sheet-space": "50dvh",
    "--card-space":
      "calc(var(--sheet-space) + token(spacing.5xl) + 2 * token(spacing.xxl))",
  },
  // The sheet is gone, so the canvas has the whole screen back. An attribute
  // rather than a second media query: it outranks the one above wherever it is
  // set, and means nothing at all in the orientations that have no sheet.
  "&[data-sheet-dismissed]": { "--sheet-space": "0px" },
});

// The canvas: everything the panel leaves, with the cover in the middle of
// THAT rather than of the viewport, so the panel never covers the thing being
// judged. Positioned because the theme control sits in its corner. It takes no
// ground of its own — the page's `bg.canvas` is already the right one, in
// whichever theme is in force.
const canvasStyle = css({
  position: "relative",
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  // Under a sheet the canvas is only the top half, and the cover centres in
  // THAT — otherwise it would centre on the whole screen and sit half behind
  // the panel. The band the gutter controls occupy is kept clear at the same
  // time: on a phone they overlay the picture rather than sitting beside it.
  _bottomSheet: {
    paddingBlockStart: "token(spacing.5xl)",
    paddingBlockEnd: "var(--sheet-space)",
    transition: "padding-block-end 200ms ease-out",
  },
  // The same phone on its side: a rail again, on a viewport globals.css does
  // not inset for (that starts at 820px). MARGIN rather than padding, because
  // what has to move is not just the picture — the gutter controls are
  // absolutely positioned against this box, and an absolute child is laid out
  // against the PADDING box, so padding would leave the theme toggle sitting
  // underneath the rail.
  _narrowRail: { marginInlineEnd: "token(sizes.propertiesPanelWidth)" },
});

// The gutter controls, in the seat they take everywhere else: an 80px band
// across the top, the menu on the left and the theme toggle answering from the
// right.
//
// Flush with the SHOWCASE, not with the viewport. The pair is confined to the
// same centred `min(100%, 960px)` box the site header and an article's intro
// are — the width the page reads at — so past 960 the two controls hold still
// and below it they come in with the box, on the page's own 20px margin. The
// canvas behind them still runs to the edges; only the controls are confined,
// which is the whole point of the rule. (Same declarations as
// `[data-site-header]` in globals.css. Restated because that rule also hangs
// the pair off `bottom: 100%`, clear of the row they are anchored to — which
// on an article is the intro and here would be the top of the screen.)
//
// Out of flow, for the reason that rule gives: the controls are the only thing
// that has ever run out of room, so the card underneath keeps the whole canvas
// to centre itself in rather than being pushed down by a strip.
const canvasChromeStyle = css({
  position: "absolute",
  insetBlockStart: 0,
  insetInline: 0,
  marginInline: "auto",
  width: "min(token(spacing.full), token(sizes.articleShowcase))",
  maxWidth:
    "min(token(sizes.articleShowcase), calc(token(spacing.full) - 2 * token(spacing.xxl)))",
  height: "token(spacing.5xl)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
});

// The cover the reference art is drawn on: portrait, generously rounded. The
// shader fills it because Fit opens on `cover` — a ground with margins is just
// a smaller picture — but Fit is a control now, so this is a default and not a
// guarantee.
// The card is 380×680 wherever there is room for it, and the same shape
// smaller wherever there is not — a phone under a sheet, a phone on its side,
// a short desktop window. Sized on ONE axis with the ratio doing the rest, so
// it can never come out stretched: the width is the narrowest of what the
// design asks for, what the viewport is, and what the height left over allows.
const coverStyle = css({
  position: "relative",
  isolation: "isolate",
  aspectRatio: "380 / 680",
  width:
    "min(380px, calc(100dvw - 2 * token(spacing.xxl)), calc((100dvh - var(--card-space)) * 380 / 680))",
  transition: "width 200ms ease-out",
  borderRadius: "xxl",
  overflow: "hidden",
  backgroundColor: "bg.surface",
});

const layerStyle = css({ position: "absolute", inset: 0 });

// The gutter row's right-hand end. The theme toggle used to answer the menu on
// its own; the sheet's way back stands beside it, so the pair reads as one
// group rather than a third control drifting somewhere else on the band.
const chromeEndStyle = css({ display: "flex", alignItems: "center", gap: "md" });

// Controls that only exist while the panel is a sheet: its close button, and
// the button that brings it back. Both are meaningless against a docked rail —
// there is nothing to close and nothing to reopen — so the media query is what
// mounts them, and a phone turned on its side is back to the rail with neither
// in sight and no state to put right.
const sheetOnlyStyle = css({ display: "none", _bottomSheet: { display: "flex" } });

// The header IS the grip. `touch-action: none` is what makes a downward drag
// belong to the sheet instead of being read as a scroll of the panel under it
// — without it the browser claims the gesture before the first pointermove
// arrives. Scoped to the sheet, so the docked rail's header keeps every gesture
// it has today.
const sheetGripStyle = css({ _bottomSheet: { touchAction: "none" } });

const rowStyle = css({ display: "flex", flexWrap: "wrap", gap: "sm" });

const captionStyle = css({ textStyle: "caption", color: "text.default/50" });

/**
 * The docked panel, borrowed from the collection editor's media inspector —
 * the SAME `propertiesPanel` recipe, applied slot by slot instead of through
 * `<PropertiesPanel>`.
 *
 * The component is not usable here: it is a dismissible dialog (Escape, or a
 * press anywhere outside it) wrapping a `Popover`, and on a page whose entire
 * content is the thing you click, the first click on the cover would slide the
 * panel away with nothing left to bring it back. The recipe is the part worth
 * reusing — flush to the viewport's top, bottom and right edge, its own scroll
 * container, a sticky header over the sections — and taking it directly is what
 * keeps this page's rail from being a second, drifting copy of those values.
 *
 * `data-property-control` on a row is what the recipe's `controlPanel` slot
 * relays into its label ∣ control grid, which is also what makes a
 * SegmentedControl measurable inside a Field.
 */
const panel = propertiesPanel();

/**
 * One titled block of the rail — the recipe's section, its header strip and its
 * control panel. No add/remove button in the strip: every group here describes
 * properties the shader HAS, so there is nothing for adding one to mean (the
 * same call the media panel's always-on section makes, which is why that one
 * draws no header at all — these have headers because there are five of them
 * and they need telling apart).
 */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={panel.section}>
      <div className={panel.sectionHeader}>
        <div className={panel.sectionTitle}>
          <Typography tag="p" type="bodySmall">
            {title}
          </Typography>
        </div>
      </div>
      <div className={panel.controlPanel} role="group" aria-label={title}>
        {children}
      </div>
    </section>
  );
}

/**
 * The mounted shader. Each component takes a different prop set, so the params
 * object is spread in wholesale — the control table is what guarantees the keys
 * match the uniforms, and `shader-specs.test.ts` is what guarantees the table
 * does. A component ignores anything it does not recognise.
 */
function ShaderStage({
  spec,
  params,
  colors,
  colorBack,
  extraColors,
}: {
  spec: ShaderSpec;
  params: Params;
  colors: string[];
  colorBack: string | undefined;
  extraColors: Record<string, string>;
}) {
  const props = {
    ...params,
    ...extraColors,
    ...(spec.hasColorBack ? { colorBack } : {}),
    colors,
    className: layerStyle,
    // Pinned, not exposed: the card IS the canvas here, and a ground with
    // margins is just a smaller picture. See `FRAMING_CONTROLS`.
    fit: "cover" as const,
    maxPixelCount: MAX_PIXELS,
  };

  switch (spec.id) {
    case "cosmicTrack":
      return <CosmicTrack {...(props as ComponentProps<typeof CosmicTrack>)} />;
    case "colorPanels":
      return <ColorPanels {...(props as ComponentProps<typeof ColorPanels>)} />;
    case "godRays":
      return <GodRays {...(props as ComponentProps<typeof GodRays>)} />;
    case "warp":
      return <Warp {...(props as ComponentProps<typeof Warp>)} />;
    case "swirl":
      return <Swirl {...(props as ComponentProps<typeof Swirl>)} />;
    case "staticMeshGradient":
      return (
        <StaticMeshGradient
          {...(props as ComponentProps<typeof StaticMeshGradient>)}
        />
      );
  }
}

/** A saved cover this page was opened on, if it was opened on one. */
export interface OpenedCover {
  id: string;
  title: string | null;
  shaderId: ShaderId;
  settings: CoverSettings;
}

export function CoverPlayground({ cover }: { cover?: OpenedCover }) {
  // The draft lives in a STORE rather than in this component, because the
  // commands that commit it — "Save changes and exit", ⌘S — are in the command
  // palette, which is mounted in the root layout and knows nothing about the
  // page under it. See `@/store/cover-draft`.
  const shaderId = useCoverDraftStore((draft) => draft.shaderId);
  const state = useCoverDraftStore((draft) => draft.settings);
  const selectShaderInStore = useCoverDraftStore((draft) => draft.selectShader);
  const setParamInStore = useCoverDraftStore((draft) => draft.setParam);
  const setColorsInStore = useCoverDraftStore((draft) => draft.setColors);
  const setColorBackInStore = useCoverDraftStore((draft) => draft.setColorBack);
  const setExtraColorInStore = useCoverDraftStore(
    (draft) => draft.setExtraColor,
  );
  const resetParamsInStore = useCoverDraftStore((draft) => draft.resetParams);

  // This page's rail is the propertiesPanel RECIPE rather than the component —
  // the component is a dismissible dialog, and a playground whose whole content
  // is the thing you click would close it on the first press with nothing left
  // to bring it back. So the inset the component arranges for itself is asked
  // for here directly, and permanently: this rail never leaves.
  usePropertiesPanelInset(true);
  const spec = SHADER_SPECS[shaderId];

  const [copied, setCopied] = useState(false);

  // Whether the sheet has been sent away. Read ONLY inside the bottom-sheet
  // media query (see `panda.config.ts`), which is what makes rotating the phone
  // the whole of the repair: in landscape the rail is back whatever this says.
  const [dismissed, setDismissed] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const { offset, dragHandlers } = useSheetDrag({
    sheetRef: panelRef,
    onDismiss: () => setDismissed(true),
    // Asked at press time rather than watched: a docked rail's header is
    // dragged by nobody, and the answer cannot change mid-gesture.
    enabled: isBottomSheetLayout,
  });

  // Adopt the cover this route was opened on — and RESET when there is none, so
  // arriving at the bare route after editing a saved one starts blank rather
  // than silently continuing to edit the last cover under a URL that claims to
  // be a new one. Keyed on the id, so re-renders do not re-seed over live edits.
  const coverId = cover?.id;
  useEffect(() => {
    const store = useCoverDraftStore.getState();
    if (cover) {
      // Already holding this one — do NOT re-seed. ⌘S on a never-saved cover
      // creates the row and then replaces the URL with its id, so this route
      // mounts a moment later carrying a cover the draft is already editing.
      // Loading it again would throw away anything tuned during that gap, which
      // is exactly the window the author is most likely to still be working in.
      if (store.coverId === cover.id) return;
      store.load(cover);
    } else {
      store.reset();
    }
    // Keyed on the ID, not the object: a server component hands down a fresh
    // prop object on every render, and depending on that identity would re-seed
    // the draft over whatever was being edited each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coverId]);

  /** Switching shader re-seeds from that shader's defaults — its control table is a different shape. */
  function selectShader(next: ShaderId) {
    selectShaderInStore(next);
    setCopied(false);
  }

  /** The shared blocks, in the order they are grouped — and what is left is the shader's own. */
  const byKey = (keys: string[]) =>
    keys
      .map((key) => spec.controls.find((control) => control.key === key))
      .filter((control) => control !== undefined);
  const shared = new Set([...FRAMING_CONTROL_KEYS, ...MOTION_CONTROL_KEYS]);
  const ownControls = spec.controls.filter(
    (control) => !shared.has(control.key),
  );
  const framingControls = byKey(FRAMING_CONTROL_KEYS);
  const motionControls = byKey(MOTION_CONTROL_KEYS);

  function setParam(key: string, value: number | boolean | string) {
    setParamInStore(key, value);
    setCopied(false);
  }

  /**
   * Growing the colour list copies the LAST colour rather than inserting a
   * default: a new stop the same as its neighbour is invisible until you edit
   * it, whereas a black one drops a hole into the gradient you were tuning.
   * (Same reasoning as the media properties panel.)
   */
  function setColorCount(count: number) {
    const colors = state.colors.slice(0, count);
    while (colors.length < count) {
      colors.push(colors[colors.length - 1] ?? "#FFFFFFFF");
    }
    setColorsInStore(colors);
  }

  /** The settings as a JSX tag, ready to paste into a component. */
  async function copyProps() {
    const lines = [
      ...Object.entries(state.params).map(([key, value]) =>
        typeof value === "string"
          ? `  ${key}="${value}"`
          : typeof value === "boolean"
            ? value
              ? `  ${key}`
              : ""
            : `  ${key}={${value}}`,
      ),
      ...(state.colorBack ? [`  colorBack="${state.colorBack}"`] : []),
      ...Object.entries(state.extraColors).map(
        ([key, value]) => `  ${key}="${value}"`,
      ),
      `  colors={${JSON.stringify(state.colors)}}`,
      `  fit="cover"`,
    ].filter(Boolean);

    const jsx = `<${spec.label.replace(/ /g, "")}\n${lines.join("\n")}\n/>`;

    // A denied clipboard permission is a rejected promise, and an unhandled one
    // in a dev tool is just noise in the console you were trying to read. Fall
    // back to logging the tag — the point is to get the settings OUT.
    try {
      await navigator.clipboard.writeText(jsx);
      setCopied(true);
    } catch {
      console.info(jsx);
    }
  }

  /**
   * One control, whatever kind it is. Lifted out of the JSX because the sidebar
   * renders the list TWICE — a shader's own parameters and the shared framing —
   * and a second copy of this switch is a second place for a control kind to go
   * missing.
   */
  function renderControl(control: ControlSpec) {
    if (control.kind === "toggle") {
      return (
        <Field size="sm" key={control.key} data-property-control>
          <Switch
            checked={Boolean(state.params[control.key])}
            onCheckedChange={(checked) => setParam(control.key, checked)}
          />
          <Field.Label>{control.label}</Field.Label>
        </Field>
      );
    }

    if (control.kind === "select") {
      return (
        <Field size="sm" key={control.key} data-property-control>
          <Field.Label>{control.label}</Field.Label>
          <SegmentedControl
            options={control.options}
            value={String(state.params[control.key])}
            onValueChange={(value) => setParam(control.key, value)}
          />
        </Field>
      );
    }

    return (
      <Field size="sm" key={control.key} data-property-control>
        <Field.Label>{control.label}</Field.Label>
        <Slider
          min={control.min}
          max={control.max}
          step={control.step}
          value={Number(state.params[control.key])}
          onValueChange={(value) => setParam(control.key, value)}
        />
      </Field>
    );
  }

  return (
    <main className={pageStyle} data-sheet-dismissed={dismissed || undefined}>
      <div className={canvasStyle}>
        <div className={coverStyle}>
          <ShaderStage
            spec={spec}
            params={state.params}
            colors={state.colors}
            colorBack={state.colorBack}
            extraColors={state.extraColors}
          />
        </div>

        {/* The site's own two gutter controls, exactly as an article carries
            them — same button, same chip, same store. The playground has no
            intro row to hang them off, so the band is measured from the canvas
            instead. */}
        <div className={canvasChromeStyle}>
          <MenuButton />
          <div className={chromeEndStyle}>
            {dismissed && (
              <Button
                variant="icon"
                className={sheetOnlyStyle}
                aria-label="Properties"
                onClick={() => setDismissed(false)}
              >
                <BottomSheetIcon />
                <Button.Tooltip>
                  <Tooltip.Text>Properties</Tooltip.Text>
                </Button.Tooltip>
              </Button>
            )}
            <ThemeToggleButton />
          </div>
        </div>
      </div>

      {/* The rail, and the same panel along the bottom edge on a phone held
          upright — one element either way, because it is one panel: the shape
          is the recipe's media query, and the only thing this page adds is
          whether the sheet has been sent away.

          `translate` inline for the length of a drag and nothing after it: the
          finger places the sheet while it is on it, and lets CSS have it back
          at the end so the dismissed state (or the slide home) is not outranked
          by a stale transform. */}
      <aside
        ref={panelRef}
        className={panel.root}
        aria-label="Properties"
        data-dismissed={dismissed || undefined}
        data-dragging={offset !== null || undefined}
        style={offset !== null ? { translate: `0 ${offset}px` } : undefined}
      >
        <div className={cx(panel.header, sheetGripStyle)} {...dragHandlers}>
          <Typography tag="p" type="bodyLarge" className={panel.title}>
            Properties
          </Typography>
          <Button
            variant="icon"
            className={sheetOnlyStyle}
            aria-label="Close properties"
            onClick={() => setDismissed(true)}
          >
            <CrossIcon />
            <Button.Tooltip>
              <Tooltip.Text>Close properties</Tooltip.Text>
            </Button.Tooltip>
          </Button>
        </div>

        <Group title="Shader">
          {/* A list rather than a row of chips: six names read as a set to pick
              ONE of, and the selected row says which is mounted without the
              reader having to compare button emphases. `sm` because the panel's
              own rows are 24px — a 32px-pitch list inside it would be the
              loudest thing in the rail. */}
          <OptionList
            size="sm"
            // The recipe's own width is the 208px popover pitch it shares with
            // the calendar. In here the panel is the frame, so the list takes
            // the column it was given — `utilities` outranks `recipes`, which
            // is what lets a consumer widen it without a variant.
            className={css({ width: "token(spacing.full)" })}
            value={shaderId}
            onValueChange={(value) => selectShader(value as ShaderId)}
          >
            <Field.Search placeholder="Search…" />
            <OptionList.Listbox aria-label="Shader">
              {SHADER_IDS.map((id) => (
                <OptionList.Option key={id} value={id}>
                  {SHADER_SPECS[id].label}
                </OptionList.Option>
              ))}
            </OptionList.Listbox>
          </OptionList>
        </Group>

        <Group title="Colours">
          <Field size="sm" data-property-control>
            <Field.Label>Count</Field.Label>
            <Slider
              min={1}
              max={spec.maxColors}
              step={1}
              value={state.colors.length}
              onValueChange={setColorCount}
            />
          </Field>

          {state.colors.map((color, index) => (
            <Field size="sm" key={index} data-property-control>
              <Field.Label>{`Colour ${index + 1}`}</Field.Label>
              <ColorInput
                value={color}
                onValueChange={(value) =>
                  setColorsInStore(
                    state.colors.map((existing, i) =>
                      i === index ? value : existing,
                    ),
                  )
                }
              />
            </Field>
          ))}

          {spec.hasColorBack && state.colorBack && (
            <Field size="sm" data-property-control>
              <Field.Label>Background</Field.Label>
              <ColorInput
                value={state.colorBack}
                onValueChange={(value) => setColorBackInStore(value)}
              />
            </Field>
          )}

          {spec.extraColors.map((extra) => (
            <Field size="sm" key={extra.key} data-property-control>
              <Field.Label>{extra.label}</Field.Label>
              <ColorInput
                value={state.extraColors[extra.key]}
                onValueChange={(value) => setExtraColorInStore(extra.key, value)}
              />
            </Field>
          ))}
        </Group>

        <Group title="Parameters">{ownControls.map(renderControl)}</Group>

        <Group title="Framing">{framingControls.map(renderControl)}</Group>

        {/* Absent entirely for a shader that never samples time, rather than
            present and inert — see `MOTION_CONTROLS`. */}
        {motionControls.length > 0 && (
          <Group title="Motion">{motionControls.map(renderControl)}</Group>
        )}

        <Group title="Output">
          <div className={rowStyle}>
            <Button size="sm" onClick={copyProps}>
              {copied ? "Copied" : "Copy as JSX"}
            </Button>
            <Button
              size="sm"
              emphasis="tertiary"
              onClick={() => {
                resetParamsInStore();
                setCopied(false);
              }}
            >
              Reset params
            </Button>
          </div>
          <p className={captionStyle}>
            The defaults are a starting point, not a match — the last mile is
            eyeballing.
          </p>
        </Group>
      </aside>
    </main>
  );
}
