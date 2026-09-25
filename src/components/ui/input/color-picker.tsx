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
import { beginControlDrag, endControlDrag } from "@/utils/control-drag";
import { Button } from "../button";
import { Typography } from "../typography";
import { Combobox } from "./combobox";
import { Field, useField } from "./field";
import { Slider } from "./slider";
import CloseIcon from "@/assets/icons/cross.svg";
import TrashIcon from "@/assets/icons/trash.svg";

type ColorPickerStyles = ReturnType<typeof colorPicker>;

type ColorPickerContextValue = {
  hex: string;
  opacity: number;
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
  onValueChange: (value: string) => void;
  /** Left off, no close chip is drawn. */
  onClose?: () => void;
  /** Left off, no trash chip is drawn. */
  onRemove?: () => void;
  title?: string;
  disabled?: boolean;
  /** Focuses the plane on mount, for a picker whose trigger sits outside it. */
  autoFocus?: boolean;
  className?: string;
  /** Defaults to header, plane, ramps and fields. */
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

  // HSB lives here, never re-derived from `value`: a grey has no hue, and a round trip can shift a
  // channel. `expected` recognises this picker's own echo, so only an outside change re-seeds.
  const [expected, setExpected] = useState(value);
  if (value !== expected) {
    setExpected(value);
    // A grey keeps the current hue.
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

/** Trash sits before close, so close stays last and the destructive chip is not where dismissal is. */
function ColorPickerHeader() {
  const { title, onClose, onRemove, styles } = usePicker("ColorPicker.Header");
  return (
    <header className={styles.header}>
      <Typography tag="p" type="bodySmall" className={styles.title}>
        {title}
      </Typography>
      {(onRemove || onClose) && (
        <div className={styles.actions}>
          {onRemove && (
            <Button variant="icon" aria-label="Remove colour" onClick={onRemove}>
              <TrashIcon />
            </Button>
          )}
          {onRemove && onClose && (
            <span aria-hidden className={styles.divider} />
          )}
          {onClose && (
            <Button variant="icon" aria-label="Close" onClick={onClose}>
              <CloseIcon />
            </Button>
          )}
        </div>
      )}
    </header>
  );
}

function ColorPickerBody({ children }: { children: ReactNode }) {
  const { styles } = usePicker("ColorPicker.Body");
  return <div className={styles.body}>{children}</div>;
}

const MAP_STEP = 1;
const MAP_KEY_DELTA: Record<string, { s?: number; b?: number } | undefined> = {
  ArrowRight: { s: MAP_STEP },
  ArrowLeft: { s: -MAP_STEP },
  ArrowUp: { b: MAP_STEP },
  ArrowDown: { b: -MAP_STEP },
};

const clampPercent = (value: number) => Math.min(Math.max(value, 0), 100);

/** One slider for both axes; `aria-valuetext` states both. */
function ColorPickerMap() {
  const { hsb, disabled, autoFocus, commitHsb, styles } =
    usePicker("ColorPicker.Map");
  const ref = useRef<HTMLDivElement>(null);

  // `autoFocus` only works on form controls, so it is done by hand.
  useEffect(() => {
    if (autoFocus && !disabled) ref.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const valueAtPointer = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      s: Math.round(clampPercent(((e.clientX - rect.left) / rect.width) * 100)),
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
        // Stops a mouse drag selecting text; `beginControlDrag` does the same for touch.
        e.preventDefault();
        beginControlDrag(e.pointerId);
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
      onPointerUp={(e) => endControlDrag(e.pointerId)}
      onPointerCancel={(e) => endControlDrag(e.pointerId)}
      onLostPointerCapture={(e) => endControlDrag(e.pointerId)}
      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
        if (disabled) return;
        const delta = MAP_KEY_DELTA[e.key];
        if (!delta) return;
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

function ColorPickerFormat() {
  const { format, setFormat, styles } = usePicker("ColorPicker.Format");
  return (
    <Field size="sm" className={styles.format}>
      <Field.Label className={css({ srOnly: true })}>Colour format</Field.Label>
      <Combobox
        search={false}
        // Not portalled: this panel is `position: fixed`, so a body-portalled menu has no anchor.
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

/** A channel box; its draft stops the lossy round trip rewriting what is being typed. */
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
  /** The box the field's label points at; one per field. */
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
      // An emptied box is mid-edit, not zero.
      if (raw !== "") onCommit(raw);
    },
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
            // Units tell them apart from the ramps' "Hue" and "Opacity".
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
