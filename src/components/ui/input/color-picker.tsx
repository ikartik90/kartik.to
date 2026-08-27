"use client";

import {
  Fragment,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { css, cx } from "../../../../styled-system/css";
import { colorPicker } from "../../../../styled-system/recipes";
import {
  clampChannel,
  clampOpacity,
  formatColor,
  hexToRgb,
  hsbToRgb,
  parseColor,
  rgbToHex,
  rgbToHsb,
  sanitizeHex,
  type ColorFormat,
  type Hsb,
} from "@/utils/color-value";
import { Button } from "../button";
import { Typography } from "../typography";
import { Combobox } from "./combobox";
import { Field, useField } from "./field";
import { Slider } from "./slider";
import CloseIcon from "@/assets/icons/cross.svg";
import TrashIcon from "@/assets/icons/trash.svg";

// ---------------------------------------------------------------------------
// ColorPicker — the panel a colour swatch opens (Figma 1066:2338): a
// saturation/brightness plane over a hue ramp and an alpha ramp, with a format
// menu and the channel fields for whichever format is chosen underneath.
//
//   <ColorPicker value={color} onValueChange={setColor} onClose={close} />
//
// ONE value in, one value out — `#RRGGBBAA`, the same string `ColorInput` takes,
// so the two are interchangeable ends of the same field and the document never
// learns that a picker exists.
//
// It is a compound: pass children to re-compose the parts (drop the header,
// reorder the ramps, put the fields on top), pass none and you get the drawn
// arrangement. Every part reads the same context, so a re-composed picker is
// still one control over one colour.
//
// ── Why the picker keeps its own HSB ────────────────────────────────────────
// The plane and the hue ramp are coordinates in HSB, and HSB is a LOSSY view of
// a colour on two counts:
//
//   • A grey has no hue. Reach black on the plane and the colour you would read
//     back is 0°, so a picker that re-derived its hue each render would drop the
//     author at red every time they touched the bottom edge — and dragging back
//     out would come back the wrong colour.
//   • 360 × 101 × 101 nameable triples cannot address 256³ colours. Seeding from
//     a colour and immediately spelling it back can shift a channel by one.
//
// So the hue/saturation/brightness the author is standing on is held HERE, and
// the value is only ever written OUT of it — never read back in, except when the
// colour changes from somewhere that is not this picker (a preset, an undo, the
// field's own hex box). Opening the picker emits nothing at all, which is what
// keeps a colour from drifting a digit for having been looked at.
// ---------------------------------------------------------------------------

type ColorPickerStyles = ReturnType<typeof colorPicker>;

type ColorPickerContextValue = {
  /** The colour as stored, split into the two things a field edits. */
  hex: string;
  opacity: number;
  /** Where the author is standing in the colour solid — see the note above. */
  hsb: Hsb;
  format: ColorFormat;
  setFormat: (format: ColorFormat) => void;
  disabled: boolean;
  /** Move within the solid: the plane, the hue ramp and the HSB fields. */
  commitHsb: (next: Partial<Hsb>) => void;
  /** Set the colour outright: the hex and RGB fields. */
  commitHex: (hex: string) => void;
  commitOpacity: (opacity: number) => void;
  onClose?: () => void;
  onRemove?: () => void;
  title: string;
  autoFocus: boolean;
  styles: ColorPickerStyles;
};

const ColorPickerContext = createContext<ColorPickerContextValue | null>(null);

function usePicker(component: string): ColorPickerContextValue {
  const ctx = useContext(ColorPickerContext);
  if (!ctx) throw new Error(`${component} must be used within <ColorPicker>.`);
  return ctx;
}

export interface ColorPickerProps {
  /** The colour, as `#RRGGBBAA`. */
  value: string;
  /** Fired with the recombined `#RRGGBBAA` on every move, drag or keystroke. */
  onValueChange: (value: string) => void;
  /** Fired by the header's close chip. Left off, no chip is drawn. */
  onClose?: () => void;
  /**
   * Fired by the header's trash chip — drop the thing this colour belongs to.
   *
   * Left off, no chip is drawn, which is the case for every colour that is a
   * PROPERTY of something (a ground, a rail): there is nothing to remove, only
   * a value to change. It is the ramp's stops that can leave, and the caller is
   * the one that knows whether this is the last of them.
   */
  onRemove?: () => void;
  /** The header's text. */
  title?: string;
  disabled?: boolean;
  /**
   * Take focus on mount — for a picker in a popover, whose trigger is outside
   * it in the tab order and would otherwise leave the panel unreachable by
   * keyboard. Lands on the plane, which is what the panel is for.
   */
  autoFocus?: boolean;
  className?: string;
  /** Defaults to the drawn arrangement — header, plane, ramps, fields. */
  children?: ReactNode;
}

function ColorPickerRoot({
  value,
  onValueChange,
  onClose,
  onRemove,
  title = "Color Picker",
  disabled = false,
  autoFocus = false,
  className,
  children,
}: ColorPickerProps) {
  const styles = colorPicker();
  const { hex, opacity } = parseColor(value);

  const [hsb, setHsb] = useState<Hsb>(() => rgbToHsb(hexToRgb(hex)));
  const [format, setFormat] = useState<ColorFormat>("hex");

  // The colour this picker is EXPECTING to be handed next. Emitting records
  // the value on the way out, so the prop that comes back is recognised as
  // this picker's own echo and passes through without re-seeding the hue it
  // just came from — the round trip the whole arrangement exists to avoid.
  // Anything else that arrives is a colour from elsewhere (a preset, an undo,
  // the field's own hex box) and does re-seed.
  const [expected, setExpected] = useState(value);
  if (value !== expected) {
    setExpected(value);
    // Take the new colour, but keep the hue if the new one has none to offer.
    const next = rgbToHsb(hexToRgb(parseColor(value).hex));
    setHsb(next.s === 0 ? { ...next, h: hsb.h } : next);
  }

  const emit = (next: string) => {
    setExpected(next);
    onValueChange(next);
  };

  const ctx: ColorPickerContextValue = {
    hex,
    opacity,
    hsb,
    format,
    setFormat,
    disabled,
    commitHsb: (partial) => {
      const next = { ...hsb, ...partial };
      setHsb(next);
      emit(formatColor(rgbToHex(hsbToRgb(next)), opacity));
    },
    commitHex: (nextHex) => {
      // A hue the new colour cannot state is the hue the author was already on
      // — see the note above. `sanitizeHex` lets a half-typed value through, so
      // this runs on every keystroke and the plane walks towards the colour.
      const derived = rgbToHsb(hexToRgb(nextHex));
      setHsb(derived.s === 0 ? { ...derived, h: hsb.h } : derived);
      emit(formatColor(nextHex, opacity));
    },
    commitOpacity: (next) => emit(formatColor(hex, next)),
    onClose,
    onRemove,
    title,
    autoFocus,
    styles,
  };

  return (
    <ColorPickerContext.Provider value={ctx}>
      <div
        className={cx(styles.root, className)}
        // The two things every part below is drawn from, handed to CSS once:
        // the plane's ground is the pure hue, and the alpha ramp fades to the
        // colour itself. Both change with the value, so neither can live in the
        // recipe — but they are still ONE declaration each, not a style object
        // rebuilt on every part.
        style={
          {
            "--color-picker-hue": `#${rgbToHex(hsbToRgb({ h: hsb.h, s: 100, b: 100 }))}`,
            "--color-picker-alpha-to": `#${hex}`,
          } as CSSProperties
        }
      >
        {children ?? (
          <>
            <ColorPickerHeader />
            <ColorPickerBody>
              <ColorPickerMap />
              <ColorPickerHue />
              <ColorPickerAlpha />
            </ColorPickerBody>
            <ColorPickerFooter />
          </>
        )}
      </div>
    </ColorPickerContext.Provider>
  );
}

/**
 * The title strip, and the chips at the end of it.
 *
 * Trash BEFORE close, and the order is the point: close is the one control
 * every panel in the app puts last, so anything else has to arrive to its left
 * rather than displace it. The destructive chip is also the one that must not
 * be where a hand goes by habit to dismiss.
 */
function ColorPickerHeader() {
  const { title, onClose, onRemove, styles } = usePicker("ColorPicker.Header");
  return (
    <header className={styles.header}>
      <Typography tag="p" type="bodySmall" className={styles.title}>
        {title}
      </Typography>
      {onRemove && (
        <Button variant="icon" aria-label="Remove colour" onClick={onRemove}>
          <TrashIcon />
        </Button>
      )}
      {onClose && (
        <Button variant="icon" aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </Button>
      )}
    </header>
  );
}

/** The padded column the plane and the ramps are stacked in. */
function ColorPickerBody({ children }: { children: ReactNode }) {
  const { styles } = usePicker("ColorPicker.Body");
  return <div className={styles.body}>{children}</div>;
}

/** How far one arrow press moves across the plane, in whole percent. */
const MAP_STEP = 1;
const MAP_KEY_DELTA: Record<string, { s?: number; b?: number } | undefined> = {
  ArrowRight: { s: MAP_STEP },
  ArrowLeft: { s: -MAP_STEP },
  ArrowUp: { b: MAP_STEP },
  ArrowDown: { b: -MAP_STEP },
};

const clampPercent = (value: number) => Math.min(Math.max(value, 0), 100);

/**
 * The saturation/brightness plane at the current hue — saturation left to
 * right, brightness bottom to top, which is the arrangement the recipe's two
 * gradients paint.
 *
 * One `role="slider"` rather than two: it is one gesture over one surface, and
 * splitting it would give the pointer two controls to be inside at once. The
 * cost is that a slider role can only carry one number, so `aria-valuetext`
 * states both — the reading a screen reader gets is the coordinate, not half
 * of it.
 */
function ColorPickerMap() {
  const { hsb, disabled, autoFocus, commitHsb, styles } =
    usePicker("ColorPicker.Map");
  const ref = useRef<HTMLDivElement>(null);

  // `autoFocus` as an attribute is only honoured on form controls, and the
  // plane is a <div role="slider"> — so it is done by hand, once, on mount.
  useEffect(() => {
    if (autoFocus && !disabled) ref.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const valueAtPointer = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      s: Math.round(clampPercent(((e.clientX - rect.left) / rect.width) * 100)),
      // Brightness runs UP the plane, so the y axis is inverted: the top edge
      // is the bright end, the bottom is black.
      b: Math.round(
        clampPercent(100 - ((e.clientY - rect.top) / rect.height) * 100),
      ),
    };
  };

  return (
    <div
      ref={ref}
      role="slider"
      aria-label="Saturation and brightness"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={hsb.s}
      aria-valuetext={`Saturation ${hsb.s}%, brightness ${hsb.b}%`}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      className={styles.map}
      onPointerDown={(e) => {
        if (disabled || e.button !== 0) return;
        // Decline the text selection a primary-button press starts — the same
        // reason the Slider's track does, and for the same drag that would
        // otherwise paint a selection across the panel on its way out.
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        e.currentTarget.focus();
        const next = valueAtPointer(e);
        if (next) commitHsb(next);
      }}
      onPointerMove={(e) => {
        if (disabled) return;
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        const next = valueAtPointer(e);
        if (next) commitHsb(next);
      }}
      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
        if (disabled) return;
        const delta = MAP_KEY_DELTA[e.key];
        if (!delta) return;
        // Own the key: the arrows would otherwise scroll the rail out from
        // under the panel.
        e.preventDefault();
        commitHsb({
          s: clampPercent(hsb.s + (delta.s ?? 0)),
          b: clampPercent(hsb.b + (delta.b ?? 0)),
        });
      }}
    >
      <span
        aria-hidden
        className={styles.mapThumb}
        style={{ left: `${hsb.s}%`, top: `${100 - hsb.b}%` }}
      />
    </div>
  );
}

/**
 * A ramp — the shared `Slider` re-composed onto a gradient track.
 *
 * Its parts are spelled out rather than left to the Slider's own arrangement
 * because the track has to carry the gradient and its two end-caps (see the
 * recipe). `ticks={0}` empties the ruler — hue and alpha are continuous, and
 * marks across a rainbow would only be a grid over a thing that has no stops.
 */
function Ramp({
  label,
  max,
  value,
  trackClass,
  onValueChange,
}: {
  label: string;
  max: number;
  value: number;
  trackClass: string;
  onValueChange: (next: number) => void;
}) {
  const { disabled, styles } = usePicker("ColorPicker.Ramp");
  return (
    <Field size="sm">
      <Slider
        min={0}
        max={max}
        step={1}
        ticks={0}
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
      >
        <Slider.Track
          aria-label={label}
          className={cx(trackClass, styles.sliderTrack)}
        />
        <Slider.Separator />
        <Slider.Output aria-label={label} />
      </Slider>
    </Field>
  );
}

/** Hue, in degrees, over the ramp it is an angle on. */
function ColorPickerHue() {
  const { hsb, commitHsb, styles } = usePicker("ColorPicker.HueSlider");
  return (
    <Ramp
      label="Hue"
      max={360}
      value={hsb.h}
      trackClass={styles.hue}
      onValueChange={(h) => commitHsb({ h })}
    />
  );
}

function ColorPickerAlpha() {
  const { opacity, commitOpacity, styles } = usePicker(
    "ColorPicker.AlphaSlider",
  );
  return (
    <Ramp
      label="Opacity"
      max={100}
      value={opacity}
      trackClass={styles.alpha}
      onValueChange={commitOpacity}
    />
  );
}

/** The strip under the ramps: which format, and the channels for it. */
function ColorPickerFooter() {
  const { styles } = usePicker("ColorPicker.Footer");
  return (
    <div className={styles.footer}>
      <ColorPickerFormat />
      <ColorPickerFields />
    </div>
  );
}

const FORMATS: { value: ColorFormat; label: string }[] = [
  { value: "hex", label: "Hex" },
  { value: "rgb", label: "RGB" },
  { value: "hsb", label: "HSB" },
];

/**
 * The format menu. A `Combobox` with its filter box turned off — three options
 * are a menu, not a search — so the Select's trigger, chevron, popover and
 * keyboard are the app's one implementation rather than a second one drawn to
 * look the same.
 */
function ColorPickerFormat() {
  const { format, setFormat, styles } = usePicker("ColorPicker.Format");
  return (
    <Field size="sm" className={styles.format}>
      {/* The trigger shows the format, so a visible label would say it twice.
          It still needs a NAME, and this is the field's own label doing its
          ordinary job with nothing drawn. */}
      <Field.Label className={css({ srOnly: true })}>Colour format</Field.Label>
      <Combobox
        search={false}
        // In place, not portalled: this panel is `position: fixed`, which ends
        // the trigger's containing-block chain at the viewport and leaves a
        // body-portalled menu with no anchor it can accept — see the prop.
        portal={false}
        value={format}
        onValueChange={(next) => setFormat(next as ColorFormat)}
      >
        {FORMATS.map((f) => (
          <Combobox.Option key={f.value} value={f.value}>
            {f.label}
          </Combobox.Option>
        ))}
      </Combobox>
    </Field>
  );
}

/**
 * One channel of the current format — a plain `<input>` wearing the field's own
 * control reset, exactly as the ColorInput's opacity box and the Slider's
 * readout do, carrying `data-control` so the frame lights up while it holds
 * focus.
 *
 * What is typed is held as a DRAFT, because every one of these is lossy on the
 * way out and the round trip would fight the typist: an emptied box would snap
 * back to its committed number before the new one could be typed, and a hex
 * would be zero-padded under the caret on the second keystroke. `null` means
 * "show the committed value", so an edit from anywhere else still lands here.
 */
function Channel({
  label,
  value,
  onCommit,
  claimsField = false,
  numeric = true,
  maxLength,
  className,
}: {
  label: string;
  value: string;
  onCommit: (raw: string) => void;
  /** Whether this is the box the field's label points at. One per field. */
  claimsField?: boolean;
  numeric?: boolean;
  maxLength: number;
  className?: string;
}) {
  const { disabled, styles } = usePicker("ColorPicker.Channel");
  const { styles: fieldStyles } = useField("ColorPicker.Channel");
  const [draft, setDraft] = useState<string | null>(null);

  const shared = {
    value: draft ?? value,
    disabled,
    spellCheck: false,
    autoComplete: "off" as const,
    maxLength,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      const raw = numeric
        ? event.target.value.replace(/[^0-9]/g, "").slice(0, maxLength)
        : sanitizeHex(event.target.value);
      setDraft(raw);
      // An emptied box is still being typed in. Committing it as zero would
      // blink the colour black between "1" and "10".
      if (raw !== "") onCommit(raw);
    },
    // The draft goes on blur and the committed value paints, which is how an
    // emptied or out-of-range box resolves.
    onBlur: () => setDraft(null),
  };

  if (claimsField) {
    return (
      <Field.Control
        {...shared}
        aria-label={label}
        inputMode={numeric ? "numeric" : "text"}
        className={cx(styles.channel, className)}
      />
    );
  }

  return (
    <input
      {...shared}
      type="text"
      data-control
      aria-label={label}
      inputMode={numeric ? "numeric" : "text"}
      className={cx(fieldStyles.control, styles.channel, className)}
    />
  );
}

/** The hairline between two channels — the colour field's own. */
function ChannelSeparator() {
  return (
    <span
      aria-hidden
      className={css({
        alignSelf: "stretch",
        flexShrink: 0,
        width: "token(spacing.3xs)",
        backgroundColor: "field.border.default",
        transition: "background-color 150ms ease",
        "[data-field]:has([data-control]:focus-visible) &": {
          backgroundColor: "field.border.active",
        },
      })}
    />
  );
}

const opacityBoxStyle = css({
  "&&": {
    flex: "0 0 auto",
    width: "token(sizes.fieldValue)",
    textAlign: "right",
    marginInlineEnd: "calc(token(spacing.md) * -1)",
    paddingInlineEnd: "md",
  },
});

/**
 * The channel row, whichever format is chosen: one box per channel, a hairline
 * between each, and the opacity — which belongs to none of them — always last
 * (Figma 1066:2338 hex / 1066:2514 RGB).
 *
 * The channels differ per format, but the FRAME does not: it is the same field
 * shell the hex + opacity pair wears in the rail, so switching format changes
 * what is in the box and never the box.
 */
function ColorPickerFields() {
  const { hex, opacity, hsb, format, commitHex, commitHsb, commitOpacity, styles } =
    usePicker("ColorPicker.Fields");

  const rgb = hexToRgb(hex);

  const channels =
    format === "hex"
      ? [
          {
            key: "hex",
            label: "Hex",
            value: hex,
            maxLength: 6,
            numeric: false,
            commit: (raw: string) => commitHex(raw),
          },
        ]
      : format === "rgb"
        ? ([
            ["Red", rgb.r, (n: number) => ({ ...rgb, r: n })],
            ["Green", rgb.g, (n: number) => ({ ...rgb, g: n })],
            ["Blue", rgb.b, (n: number) => ({ ...rgb, b: n })],
          ] as const).map(([label, current, replace]) => ({
            key: label,
            label,
            value: String(current),
            maxLength: 3,
            numeric: true,
            commit: (raw: string) =>
              commitHex(rgbToHex(replace(clampChannel(Number(raw))))),
          }))
        : ([
            // Named with their unit, because the ramps above already have a
            // "Hue" and an "Opacity" and a reader meeting two of each would
            // have no way to tell the plane's coordinate from the ramp's.
            ["Hue, degrees", hsb.h, 360, (n: number) => ({ h: n })],
            ["Saturation, percent", hsb.s, 100, (n: number) => ({ s: n })],
            ["Brightness, percent", hsb.b, 100, (n: number) => ({ b: n })],
          ] as const).map(([label, current, max, replace]) => ({
            key: label,
            label,
            value: String(current),
            maxLength: 3,
            numeric: true,
            commit: (raw: string) =>
              commitHsb(replace(Math.min(Number(raw), max))),
          }));

  return (
    <Field size="sm" className={styles.fields}>
      <Field.Frame>
        {channels.map((c, index) => (
          <Fragment key={c.key}>
            {index > 0 && <ChannelSeparator />}
            <Channel
              label={c.label}
              value={c.value}
              maxLength={c.maxLength}
              numeric={c.numeric}
              onCommit={c.commit}
              // The first box is the one the field's label would point at —
              // a label may name one control, and that is this.
              claimsField={index === 0}
            />
          </Fragment>
        ))}
        <ChannelSeparator />
        <Channel
          label="Opacity, percent"
          value={String(opacity)}
          maxLength={3}
          onCommit={(raw) => commitOpacity(clampOpacity(Number(raw)))}
          className={opacityBoxStyle}
        />
      </Field.Frame>
    </Field>
  );
}

/**
 * Compound colour picker. `ColorPicker` is the control (the colour, the point
 * in the solid, the chosen format) and draws the panel; the parts inside it are
 * composable — pass children to rearrange or drop one, pass none for the drawn
 * arrangement (Figma 1066:2338).
 *
 * @example
 * <ColorPicker value={color} onValueChange={setColor} onClose={close} />
 */
export const ColorPicker = Object.assign(ColorPickerRoot, {
  Header: ColorPickerHeader,
  Body: ColorPickerBody,
  Map: ColorPickerMap,
  HueSlider: ColorPickerHue,
  AlphaSlider: ColorPickerAlpha,
  Footer: ColorPickerFooter,
  Format: ColorPickerFormat,
  Fields: ColorPickerFields,
});
