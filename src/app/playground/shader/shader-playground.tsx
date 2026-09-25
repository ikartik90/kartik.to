"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { css, cx } from "../../../../styled-system/css";
import { propertiesPanel, toolbar } from "../../../../styled-system/recipes";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { usePropertiesPanelInset } from "@/hooks/use-properties-panel-inset";
import { useSheetDrag } from "@/hooks/use-sheet-drag";
import { isBottomSheetLayout } from "@/data/media-queries";
import { useShaderPresetDraftStore } from "@/store/shader-preset-draft";
import { AspectRail } from "@/components/aspect-rail";
import { deleteShaderPreset, publishShaderPreset, unpublishShaderPreset } from "@/app/actions/shader-preset";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DemoPreloader } from "@/components/demo-component";
import { useTrickleProgress } from "@/hooks/use-demo-loader";
import { PresetsPane } from "./presets-pane";
import { ShaderStage } from "@/components/shaders/shader-stage";
import { useDraftHistory } from "./use-draft-history";
import { MenuButton } from "@/components/menu-button";
import { ThemeToggleButton } from "@/components/theme-toggle";
import { useThemeToggle } from "@/hooks/use-theme-toggle";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input/field";
import { Slider } from "@/components/ui/input/slider";
import { Switch } from "@/components/ui/input/switch";
import { ColorSwatchGrid } from "@/components/ui/input/color-swatch-grid";
import { SegmentedControl } from "@/components/ui/input/segmented-control";
import { ToggleBar } from "@/components/ui/input/toggle-bar";
import { OptionList } from "@/components/ui/input/option-list";
import { Typography } from "@/components/ui/typography";
import { Tooltip } from "@/components/ui/tooltip";
import BottomSheetIcon from "@/assets/icons/bottom-sheet.svg";
import RightSidebarIcon from "@/assets/icons/right-sidebar.svg";
import PublishIcon from "@/assets/icons/publish.svg";
import ResetIcon from "@/assets/icons/reset.svg";
import TrashIcon from "@/assets/icons/trash.svg";
import DarkIcon from "@/assets/icons/dark.svg";
import LightIcon from "@/assets/icons/light.svg";
import UnpublishIcon from "@/assets/icons/unpublish.svg";
import {
  SHADER_IDS,
  extraColorRows,
  SHADER_SPECS,
  FRAMING_CONTROL_KEYS,
  MOTION_CONTROL_KEYS,
  type ControlSpec,
  type ParamValue,
  type ShaderId,
} from "@/data/shader-specs";
import {
  framingFor,
  paletteFor,
  shaderParamsFor,
  type ShaderPresetSettings,
  type ShaderPresetTheme,
  type ThemedColor,
} from "@/domain/shader-preset";
import { ASPECT_RATIOS } from "@/utils/demo-frame-sizing";

// `padding: none` overrides the site's padding on `main`. The panel's width is not reserved
// here: `usePropertiesPanelInset` already insets the body.
const pageStyle = css({
  minHeight: "100dvh",
  backgroundColor: "bg.canvas",
  display: "flex",
  padding: "none",
  gap: 0,
  "--sheet-space": "0px",
  "--presets-space": "0px",
  "--canvas-band": "max(token(spacing.5xl), var(--presets-space))",
  "--canvas-head": "var(--canvas-band)",
  "--canvas-foot": "calc(var(--sheet-space) + var(--canvas-band))",
  "--card-gutter": "token(spacing.xxl)",
  "--chrome-band": "token(spacing.5xl)",
  "--rail-space": "0px",
  "--card-space":
    "calc(var(--canvas-head) + var(--canvas-foot) + var(--rail-space) + 2 * var(--card-gutter))",
  // On a phone the foot holds the larger of the sheet and the strip, which the sheet covers.
  _bottomSheet: {
    "--sheet-space": "50dvh",
    "--chrome-band": "calc(token(spacing.md) + token(spacing.4xl))",
    "--rail-space": "calc(token(spacing.4xl) + token(spacing.md))",
    "--canvas-head": "var(--chrome-band)",
    "--canvas-foot": "max(var(--sheet-space), var(--presets-space))",
    "--card-gutter": "token(spacing.md)",
  },
  "&:has([data-presets])": {
    "--presets-space":
      "calc(token(spacing.5xl) + 2 * token(spacing.lg) + token(spacing.xl) + token(spacing.sm))",
  },
  "&[data-sheet-dismissed]": { "--sheet-space": "0px" },
});

const canvasStyle = css({
  position: "relative",
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  paddingBlockStart: "var(--canvas-head)",
  paddingBlockEnd: "var(--canvas-foot)",
  transition: "padding-block 200ms ease-out",
  // Margin, not padding: the absolutely positioned chrome is laid out against the padding box.
  _narrowRail: { marginInlineEnd: "token(sizes.propertiesPanelWidth)" },

  _bottomSheet: { flexDirection: "column", gap: "md" },
});

const canvasChromeStyle = css({
  position: "absolute",
  insetBlockStart: 0,
  insetInline: 0,
  marginInline: "auto",
  width: "min(token(spacing.full), token(sizes.articleShowcase))",
  maxWidth:
    "min(token(sizes.articleShowcase), calc(token(spacing.full) - 2 * token(spacing.xxl)))",
  height: "var(--chrome-band)",

  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  alignItems: "center",

  _bottomSheet: { paddingBlockStart: "md" },
});

// Not clipped: the unsaved-framing dots hang outside the rail.
const aspectRailStyle = css({
  borderWidth: "token(spacing.3xs)",
  borderStyle: "solid",
  borderColor: "border.divider",
  overflow: "visible",

  // One ink for the whole strip; the panel button would otherwise inherit the page's.
  color: "field.text.default",

  position: "absolute",
  insetBlockStart: "calc((var(--chrome-band) - token(spacing.4xl)) / 2)",
  insetInline: 0,
  marginInline: "auto",
  // Both insets are 0, so without this the rail would fill the canvas.
  width: "max-content",

  "--entrance-from":
    "calc(-100% - (var(--chrome-band) - token(spacing.4xl)) / 2)",

  // Hidden, not unmounted, while it waits; `visibility` keeps it out of the tab order.
  visibility: "hidden",

  // `backwards` holds it off screen through the delay.
  "[data-entered] &": {
    visibility: "visible",
    animation: "playgroundChromeIn 150ms ease-out 50ms backwards",
  },

  _bottomSheet: {
    position: "static",
    "--entrance-from": "calc(-100% - token(spacing.md))",
  },
});

// Sized on one axis with the ratio doing the rest. `100%` is the canvas, not the viewport,
// which ignores the rail's inset.
const shaderPresetStyle = css({
  position: "relative",
  isolation: "isolate",

  animation: "playgroundChromeIn 150ms ease-out",

  // Over the rail, which follows it in the column and slides out from under it.
  _bottomSheet: { zIndex: 1 },
  "--preset-max": "680px",
  aspectRatio: "var(--preset-w) / var(--preset-h)",
  width:
    "min(var(--preset-max), calc(var(--preset-max) * var(--preset-w) / var(--preset-h)), calc(token(spacing.full) - 2 * var(--card-gutter)), calc((100dvh - var(--card-space)) * var(--preset-w) / var(--preset-h)))",
  transition: "width 200ms ease-out",
  borderRadius: "xxl",
  overflow: "hidden",
  // No ground of its own: a transparent `colorBack` must show the page.
});

const chromeEndStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "md",
  justifySelf: "end",
});

// Not `OptionList.Divider`, which needs the list's context this sits outside.
const toolbarSeparatorStyle = css({
  flexShrink: 0,
  width: "token(spacing.xxs)",
  height: "token(sizes.toolbarButton)",
  backgroundColor: "border.divider",
});

const sheetOnlyIconStyle = css({
  display: "none",
  _bottomSheet: { display: "block" },
});
const railOnlyIconStyle = css({ _bottomSheet: { display: "none" } });

// The header is the grip: without `touch-action: none` the browser claims the drag as a scroll.
const sheetGripStyle = css({ _bottomSheet: { touchAction: "none" } });

const headerActionsStyle = css({ display: "flex", alignItems: "center", gap: "xs" });

const panelEntranceStyle = css({
  animationDelay: "100ms",
  animationDuration: "150ms",
  animationFillMode: "backwards",
});

/** The `propertiesPanel` recipe, not the component: its outside-press dismiss would close on the first click. */
const panel = propertiesPanel();

function Group({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className={panel.section}>
      <div className={panel.sectionHeader}>
        <div className={panel.sectionTitle}>
          <Typography tag="p" type="bodySmall">
            {title}
          </Typography>
        </div>
        {actions && <div className={headerActionsStyle}>{actions}</div>}
      </div>
      {children && (
        <div className={panel.controlPanel} role="group" aria-label={title}>
          {children}
        </div>
      )}
    </section>
  );
}

export interface OpenedShaderPreset {
  id: string;
  title: string | null;
  shaderId: ShaderId;
  settings: ShaderPresetSettings;
  publishedAt: Date | null;
}

export function ShaderPlayground({ preset }: { preset?: OpenedShaderPreset }) {
  useDraftHistory();

  // A store, not local state: the palette's ⌘S commits it from the root layout.
  const shaderId = useShaderPresetDraftStore((draft) => draft.shaderId);
  const state = useShaderPresetDraftStore((draft) => draft.settings);
  const selectShaderInStore = useShaderPresetDraftStore((draft) => draft.selectShader);
  const setParamInStore = useShaderPresetDraftStore((draft) => draft.setParam);
  const setColorsInStore = useShaderPresetDraftStore((draft) => draft.setColors);
  const setColorBackInStore = useShaderPresetDraftStore((draft) => draft.setColorBack);
  const setExtraColorInStore = useShaderPresetDraftStore(
    (draft) => draft.setExtraColor,
  );
  const setFramingInStore = useShaderPresetDraftStore((draft) => draft.setFraming);
  const setAspectInStore = useShaderPresetDraftStore((draft) => draft.setAspect);
  const resetParamsInStore = useShaderPresetDraftStore((draft) => draft.resetParams);
  const setPublishedAtInStore = useShaderPresetDraftStore(
    (draft) => draft.setPublishedAt,
  );
  const savedShaderPresetId = useShaderPresetDraftStore((draft) => draft.shaderPresetId);
  const publishedAt = useShaderPresetDraftStore((draft) => draft.publishedAt);
  const isDirty = useShaderPresetDraftStore((draft) => draft.isDirty);
  const editedAspects = useShaderPresetDraftStore((draft) => draft.editedAspects);

  // `null` follows the site: `useThemeToggle` reports light until hydrated, so seeding from it would latch that.
  const { isDark } = useThemeToggle();
  const pageTheme: ShaderPresetTheme = isDark ? "dark" : "light";
  const [groundOverride, setGroundOverride] = useState<ShaderPresetTheme | null>(null);

  // Released during render when the site's theme moves; an effect would flash the stale ground.
  const [lastPageTheme, setLastPageTheme] = useState(pageTheme);
  if (lastPageTheme !== pageTheme) {
    setLastPageTheme(pageTheme);
    setGroundOverride(null);
  }

  const ground = groundOverride ?? pageTheme;

  // Asked of the draft, never the route: the server render has the route's preset but an unseeded draft.
  const [settled, setSettled] = useState(false);
  const [drawn, setDrawn] = useState(false);
  // Latched: "New preset" clears the draft's id while the route's `preset` stays.
  if (!drawn && (preset ? savedShaderPresetId === preset.id : settled)) setDrawn(true);
  const ready = drawn;
  const trickle = useTrickleProgress(!ready);

  const spec = SHADER_SPECS[shaderId];

  const isAdmin = useIsAdmin();

  /** The reset slot offers Delete once there is nothing to reset: a saved, clean draft. */
  const canDelete = isAdmin && savedShaderPresetId !== null && !isDirty;
  const [pendingDelete, setPendingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function deletePreset() {
    if (!savedShaderPresetId || deleting) return;
    setDeleting(true);
    try {
      await deleteShaderPreset(savedShaderPresetId);
      useShaderPresetDraftStore.getState().reset();
      window.history.replaceState(null, "", "/playground/shader");
    } catch (err) {
      console.error("Failed to delete the preset:", err);
    } finally {
      setDeleting(false);
    }
  }

  const [publishing, setPublishing] = useState(false);
  async function togglePublished() {
    if (!savedShaderPresetId || publishing) return;
    setPublishing(true);
    try {
      const saved = publishedAt
        ? await unpublishShaderPreset(savedShaderPresetId)
        : await publishShaderPreset(savedShaderPresetId);
      setPublishedAtInStore(saved.publishedAt);
    } catch (err) {
      console.error("Failed to change the preset's publication:", err);
    } finally {
      setPublishing(false);
    }
  }

  // Looked up, not parsed from the key, so only a known ratio reaches the CSS.
  const aspect = useShaderPresetDraftStore((draft) => draft.aspect);
  const [ratioWidth, ratioHeight] = ASPECT_RATIOS[aspect];

  const [dismissed, setDismissed] = useState(false);

  // An effect, once: `matchMedia` is client-only, and re-asking on rotation would close an open panel.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isBottomSheetLayout()) setDismissed(true);
  }, []);

  usePropertiesPanelInset(!dismissed);
  const panelRef = useRef<HTMLElement>(null);
  const { offset, dragHandlers } = useSheetDrag({
    sheetRef: panelRef,
    onDismiss: () => setDismissed(true),
    enabled: isBottomSheetLayout,
  });

  const shaderPresetId = preset?.id;
  useEffect(() => {
    const store = useShaderPresetDraftStore.getState();
    if (preset) {
      // Already holding it: ⌘S on a new preset replaces the URL, and re-seeding would drop edits made since.
      if (store.shaderPresetId === preset.id) return;
      store.load(preset);
    } else {
      store.openNewDraft();
    }
    // Keyed on the id: the server hands down a fresh `preset` object every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shaderPresetId]);

  function selectShader(next: ShaderId) {
    selectShaderInStore(next);
  }

  const byKey = (keys: string[]) =>
    keys
      .map((key) => spec.controls.find((control) => control.key === key))
      .filter((control) => control !== undefined);
  const shared = new Set([...FRAMING_CONTROL_KEYS, ...MOTION_CONTROL_KEYS]);
  // Filtered out, or a control naming its own group would render twice.
  const ditherControls = spec.controls.filter(
    (control) => control.group === "dither",
  );
  const edgeControls = spec.controls.filter(
    (control) => control.group === "edge",
  );
  const rampControls = spec.controls.filter(
    (control) => control.group === "ramp",
  );
  const gridControls = spec.controls.filter(
    (control) => control.group === "grid",
  );
  const glowControls = spec.controls.filter(
    (control) => control.group === "glow",
  );
  const ownControls = spec.controls.filter(
    (control) => !shared.has(control.key) && control.group === undefined,
  );
  const framingControls = byKey(FRAMING_CONTROL_KEYS);
  const motionControls = [
    ...byKey(MOTION_CONTROL_KEYS),
    ...spec.controls.filter((control) => control.group === "motion"),
  ];

  // Framing is stored per shape; everything else per preset.
  const isFramingControl = (key: string) => FRAMING_CONTROL_KEYS.includes(key);
  const framing = framingFor(state, aspect);
  const valueOf = (key: string) =>
    isFramingControl(key) ? framing[key] : state.params[key];

  function setParam(key: string, value: ParamValue) {
    if (isFramingControl(key)) {
      // Every framing control is a slider, so the value is a number.
      setFramingInStore(key, Number(value));
      return;
    }
    setParamInStore(key, value);
  }

  // Each colour is a light/dark pair; an edit writes only the half on screen.
  const onGround = (color: ThemedColor, value: string): ThemedColor => ({
    ...color,
    [ground]: value,
  });

  const setRampColor = (index: number, value: string) =>
    setColorsInStore(
      state.colors.map((color, i) =>
        i === index ? onGround(color, value) : color,
      ),
    );

  /** A new stop copies both halves of the last one. */
  const addRampColor = () =>
    setColorsInStore([
      ...state.colors,
      state.colors[state.colors.length - 1] ?? {
        light: "#FFFFFFFF",
        dark: "#FFFFFFFF",
      },
    ]);

  const removeRampColor = (index: number) =>
    setColorsInStore(state.colors.filter((_, i) => i !== index));

  const palette = paletteFor(state, ground);

  function renderControl(control: ControlSpec) {
    if (control.kind === "toggle") {
      return (
        <Field size="sm" key={control.key} data-property-control>
          <Switch
            checked={Boolean(valueOf(control.key))}
            onCheckedChange={(checked) => setParam(control.key, checked)}
          />
          <Field.Label>{control.label}</Field.Label>
        </Field>
      );
    }

    if (control.kind === "toggles") {
      const chosen = valueOf(control.key);
      return (
        <Field size="sm" key={control.key} data-property-control>
          <Field.Label>{control.label}</Field.Label>
          <ToggleBar
            ariaLabel={control.label}
            options={control.options}
            value={Array.isArray(chosen) ? chosen : control.value}
            onValueChange={(value) => setParam(control.key, value)}
          />
        </Field>
      );
    }

    if (control.kind === "select") {
      return (
        <Field size="sm" key={control.key} data-property-control>
          <Field.Label>{control.label}</Field.Label>
          <SegmentedControl
            options={control.options}
            value={String(valueOf(control.key))}
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
          value={Number(valueOf(control.key))}
          onValueChange={(value) => setParam(control.key, value)}
        />
      </Field>
    );
  }

  return (
    <main
      className={pageStyle}
      data-sheet-dismissed={dismissed || undefined}
      data-entered={ready || undefined}
    >
      <div className={canvasStyle}>
        {ready ? (
          <div
            className={shaderPresetStyle}
            data-preset-stage
            style={
              {
                "--preset-w": ratioWidth,
                "--preset-h": ratioHeight,
              } as CSSProperties
            }
          >
            <ShaderStage
              spec={spec}
              params={shaderParamsFor(state, aspect)}
              colors={palette.colors}
              colorBack={palette.colorBack}
              extraColors={palette.extraColors}
            />
          </div>
        ) : (
          // Capped at 99, as the demos' own is: the last percent belongs to the
          // thing actually appearing, not to the wait for it.
          <DemoPreloader value={Math.min(99, trickle * 100)} />
        )}

        <div className={canvasChromeStyle}>
          <MenuButton />

          <div className={chromeEndStyle}>
            <ThemeToggleButton />
          </div>
        </div>

        <div className={cx(toolbar({ size: "md" }), aspectRailStyle)}>
          <AspectRail
            ariaLabel="Preview aspect ratio"
            aspect={aspect}
            onPick={setAspectInStore}
            markedAspects={isAdmin ? editedAspects : undefined}
          />

          {dismissed && (
            <>
              <span aria-hidden className={toolbarSeparatorStyle} />
              <Button
                variant="icon"
                aria-label="Preset properties"
                onClick={() => setDismissed(false)}
              >
                <RightSidebarIcon className={railOnlyIconStyle} />
                <BottomSheetIcon className={sheetOnlyIconStyle} />
                <Button.Tooltip>
                  <Tooltip.Text>Preset properties</Tooltip.Text>
                </Button.Tooltip>
              </Button>
            </>
          )}
        </div>

        <PresetsPane onSettled={() => setSettled(true)} />
      </div>

      {/* Mounted on `ready`, like the card: before that the draft holds another shader's numbers.
          `translate` is inline only during a drag, so CSS owns the resting states. */}
      {ready && (
        <aside
          ref={panelRef}
          className={cx(panel.root, panelEntranceStyle)}
          aria-label="Preset properties"
          data-dismissed={dismissed || undefined}
          data-dragging={offset !== null || undefined}
          style={offset !== null ? { translate: `0 ${offset}px` } : undefined}
        >
          <div className={cx(panel.header, sheetGripStyle)} {...dragHandlers}>
            <Typography tag="p" type="bodyLarge" className={panel.title}>
              Preset properties
            </Typography>
            <div className={headerActionsStyle}>
              <Button
                variant="icon"
                aria-label="Close properties"
                onClick={() => setDismissed(true)}
              >
                <RightSidebarIcon className={railOnlyIconStyle} />
                <BottomSheetIcon className={sheetOnlyIconStyle} />
                <Button.Tooltip>
                  <Tooltip.Text>Close properties</Tooltip.Text>
                </Button.Tooltip>
              </Button>
            </div>
          </div>

          <Group
            title="Preset actions"
            actions={
              <>
                {canDelete ? (
                  <Button
                    variant="icon"
                    aria-label="Delete preset"
                    disabled={deleting}
                    onClick={() => setPendingDelete(true)}
                  >
                    <TrashIcon />
                    <Button.Tooltip>
                      <Tooltip.Text>Delete preset</Tooltip.Text>
                    </Button.Tooltip>
                  </Button>
                ) : (
                  <Button
                    variant="icon"
                    aria-label="Reset"
                    onClick={resetParamsInStore}
                  >
                    <ResetIcon />
                    <Button.Tooltip>
                      <Tooltip.Text>Reset</Tooltip.Text>
                    </Button.Tooltip>
                  </Button>
                )}

                {isAdmin && (
                  <Button
                    variant="icon"
                    aria-label={publishedAt ? "Unpublish" : "Publish"}
                    disabled={!savedShaderPresetId || publishing}
                    onClick={() => void togglePublished()}
                  >
                    {publishedAt ? <UnpublishIcon /> : <PublishIcon />}
                    <Button.Tooltip>
                      <Tooltip.Text>
                        {publishedAt ? "Unpublish" : "Publish"}
                      </Tooltip.Text>
                    </Button.Tooltip>
                  </Button>
                )}
              </>
            }
          />

          {isAdmin && (
            <Group title="Shader">
              <OptionList
                size="sm"
                data-property-block
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
          )}

          <Group title="Colours">
            <Field size="sm" data-property-control data-control-align="start">
              <Field.Label>{spec.colorsLabel}</Field.Label>
              <ColorSwatchGrid
                ariaLabel={`${spec.colorsLabel} colours`}
                capacity={spec.maxColors}
                values={palette.colors}
                onValueChange={setRampColor}
                onAdd={addRampColor}
                onRemove={removeRampColor}
              />
              <Button
                variant="icon"
                aria-label={
                  ground === "dark"
                    ? "Show the light colours"
                    : "Show the dark colours"
                }
                onClick={() =>
                  setGroundOverride(ground === "dark" ? "light" : "dark")
                }
              >
                {ground === "dark" ? <LightIcon /> : <DarkIcon />}
                <Button.Tooltip>
                  <Tooltip.Text>
                    {ground === "dark" ? "Light colours" : "Dark colours"}
                  </Tooltip.Text>
                </Button.Tooltip>
              </Button>
            </Field>

            {extraColorRows(spec).map((row) => (
              <Field size="sm" key={row.label} data-property-control>
                <Field.Label>{row.label}</Field.Label>
                <ColorSwatchGrid
                  ariaLabel={`${row.label} colours`}
                  capacity={row.colors.length}
                  labels={row.colors.map((extra) => `${extra.label} colour`)}
                  values={row.colors.map(
                    (extra) => palette.extraColors[extra.key],
                  )}
                  onValueChange={(index, value) => {
                    const { key } = row.colors[index];
                    setExtraColorInStore(
                      key,
                      onGround(state.extraColors[key], value),
                    );
                  }}
                />
              </Field>
            ))}

            {spec.hasColorBack && state.colorBack && (
              <Field size="sm" data-property-control>
                <Field.Label>Background</Field.Label>
                <ColorSwatchGrid
                  ariaLabel="Background colour"
                  capacity={1}
                  values={[palette.colorBack ?? "#000000FF"]}
                  onValueChange={(_, value) =>
                    setColorBackInStore(
                      onGround(state.colorBack ?? { light: value, dark: value }, value),
                    )
                  }
                />
              </Field>
            )}
          </Group>

          <Group title={spec.ownLabel}>{ownControls.map(renderControl)}</Group>

          {gridControls.length > 0 && (
            <Group title="Grid">{gridControls.map(renderControl)}</Group>
          )}

          {glowControls.length > 0 && (
            <Group title="Glow">{glowControls.map(renderControl)}</Group>
          )}

          {rampControls.length > 0 && (
            <Group title="Ramp">{rampControls.map(renderControl)}</Group>
          )}

          {edgeControls.length > 0 && (
            <Group title="Edge">{edgeControls.map(renderControl)}</Group>
          )}

          {ditherControls.length > 0 && (
            <Group title="Dither">{ditherControls.map(renderControl)}</Group>
          )}

          <Group title={`Framing ${aspect.replace("/", ":")}`}>
            {framingControls.map(renderControl)}
          </Group>

          {motionControls.length > 0 && (
            <Group title="Motion">{motionControls.map(renderControl)}</Group>
          )}
        </aside>
      )}

      <ConfirmDialog
        open={pendingDelete}
        title="Delete Preset"
        message="You are about to delete this preset. This cannot be undone."
        confirmLabel="Delete"
        confirmIcon={TrashIcon}
        onConfirm={() => void deletePreset()}
        onClose={() => setPendingDelete(false)}
      />
    </main>
  );
}
