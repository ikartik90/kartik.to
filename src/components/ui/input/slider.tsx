"use client";

import {
  createContext,
  forwardRef,
  useContext,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { cx } from "../../../../styled-system/css";
import { sliderField } from "../../../../styled-system/recipes";
import {
  formatSliderValue,
  ratioOfValue,
  snapToStep,
  valueAtRatio,
  type SliderScale,
} from "@/utils/slider-value";
import { Field, useField } from "./field";
import { WireframeText } from "../wireframe";

// ---------------------------------------------------------------------------
// Slider — the third control archetype of the field family, composed INTO a
// <Field> exactly like Switch and DatePicker (label and hint are the consumer's
// Field.Label / Field.Hint siblings, not props):
//
//   <Field size="sm">
//     <Field.Label>Opacity</Field.Label>
//     <Slider min={0} max={100} defaultValue={100} />
//     <Field.Hint>0–100</Field.Hint>
//   </Field>
//
// It brings no surface of its own: it renders the shared `field` frame and
// draws a ruler, a separator and a numeric readout inside it, so the fill,
// border, radius and the whole focus accent are the same ones the text input
// wears. The track carries `data-control`, which is all the field recipe needs
// to flip the frame — and with it the thumb and readout, both painted in
// `currentColor` — to the brand accent while the slider holds focus.
//
// Pass children to re-compose those parts (drop the readout, reorder, insert
// your own); pass none and you get the drawn arrangement.
// ---------------------------------------------------------------------------

type SliderStyles = ReturnType<typeof sliderField>;

type SliderContextValue = {
  scale: SliderScale;
  value: number;
  /** 0–1 position of the current value, shared by the thumb and the readout. */
  ratio: number;
  ticks: number;
  disabled: boolean;
  commit: (next: number) => void;
  styles: SliderStyles;
};

const SliderContext = createContext<SliderContextValue | null>(null);

function useSlider(component: string): SliderContextValue {
  const ctx = useContext(SliderContext);
  if (!ctx) throw new Error(`${component} must be used within <Slider>.`);
  return ctx;
}

export interface SliderProps {
  /** Controlled value. */
  value?: number;
  /** Initial value when uncontrolled. Defaults to `min`. */
  defaultValue?: number;
  /** Fired with the snapped value on every change (drag, key, or click). */
  onValueChange?: (value: number) => void;
  min?: number;
  max?: number;
  /** Grid the value snaps to, anchored at `min`. */
  step?: number;
  /**
   * How many evenly spaced marks the ruler shows — presentation only, unrelated
   * to `step` (a 0–100 slider stepping by 1 is still drawn with 11 marks).
   */
  ticks?: number;
  disabled?: boolean;
  /** Applied to the field frame. */
  className?: string;
  /** Defaults to `<Slider.Track /><Slider.Separator /><Slider.Output />`. */
  children?: ReactNode;
}

function SliderRoot({
  value: valueProp,
  defaultValue,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  ticks = 11,
  disabled = false,
  className,
  children,
}: SliderProps) {
  const { size } = useField("Slider");
  const scale: SliderScale = { min, max, step };

  const isControlled = valueProp !== undefined;
  const [internal, setInternal] = useState(() =>
    snapToStep(defaultValue ?? min, scale),
  );
  // Snapping the incoming value too means a controlled consumer that echoes an
  // unsnapped number back cannot park the thumb between two stops.
  const value = snapToStep(isControlled ? valueProp : internal, scale);

  const ctx: SliderContextValue = {
    scale,
    value,
    ratio: ratioOfValue(value, scale),
    ticks,
    disabled,
    commit: (next) => {
      const snapped = snapToStep(next, scale);
      if (snapped === value) return;
      if (!isControlled) setInternal(snapped);
      onValueChange?.(snapped);
    },
    styles: sliderField({ size }),
  };

  return (
    <SliderContext.Provider value={ctx}>
      <Field.Frame className={className}>
        {children ?? (
          <>
            <SliderTrack />
            <SliderSeparator />
            <SliderOutput />
          </>
        )}
      </Field.Frame>
    </SliderContext.Provider>
  );
}

export type SliderTrackProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "children" | "role" | "tabIndex"
>;

/**
 * The ruler and the thumb — and the field's labelable control: it carries the
 * field's id, `role="slider"` with the live value, and the `data-control` hook
 * the frame keys its focus state off. Dragging, clicking and the arrow keys all
 * land here, which is why the element spans the frame's full height rather than
 * the 4px of the visible rule.
 */
const SliderTrack = forwardRef<HTMLDivElement, SliderTrackProps>(
  function SliderTrack(
    { className, onPointerDown, onPointerMove, onKeyDown, ...rest },
    forwardedRef,
  ) {
    const { controlId, labelId, hasLabel, hintId, hasHint, registerControl } =
      useField("Slider.Track");
    const { scale, value, ratio, ticks, disabled, commit, styles } =
      useSlider("Slider.Track");

    // A continuous slider still needs a keyboard increment; 100 stops across
    // the range is the same granularity a native range input assumes.
    const keyStep = scale.step > 0 ? scale.step : (scale.max - scale.min) / 100;

    const valueAtPointer = (e: PointerEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      if (rect.width === 0) return value;
      return valueAtRatio((e.clientX - rect.left) / rect.width, scale);
    };

    return (
      <div
        ref={(node) => {
          registerControl(node);
          if (typeof forwardedRef === "function") forwardedRef(node);
          else if (forwardedRef) forwardedRef.current = node;
        }}
        id={controlId}
        data-control
        role="slider"
        aria-orientation="horizontal"
        aria-valuemin={scale.min}
        aria-valuemax={scale.max}
        aria-valuenow={value}
        aria-valuetext={formatSliderValue(value, scale.step)}
        // A <div> is not a labelable element, so `Field.Label`'s htmlFor cannot
        // reach it — the field exposes its label id for exactly this case (the
        // Calendar group does the same).
        aria-labelledby={hasLabel ? labelId : undefined}
        aria-describedby={hasHint ? hintId : undefined}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : 0}
        className={cx(styles.track, className)}
        onPointerDown={(e) => {
          onPointerDown?.(e);
          if (e.defaultPrevented || disabled || e.button !== 0) return;
          // Capture on the track, so a drag that leaves the frame (or the
          // window) keeps steering the thumb and still ends cleanly.
          e.currentTarget.setPointerCapture(e.pointerId);
          e.currentTarget.focus();
          commit(valueAtPointer(e));
        }}
        onPointerMove={(e) => {
          onPointerMove?.(e);
          if (e.defaultPrevented || disabled) return;
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
          commit(valueAtPointer(e));
        }}
        onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
          onKeyDown?.(e);
          if (e.defaultPrevented || disabled) return;
          const next = KEY_DELTA[e.key];
          if (next === undefined) return;
          // Own the key: arrows and Page/Home/End would otherwise scroll the
          // page out from under the field.
          e.preventDefault();
          commit(
            next === "min"
              ? scale.min
              : next === "max"
                ? scale.max
                : value + next * keyStep,
          );
        }}
        {...rest}
      >
        {Array.from({ length: Math.max(ticks, 0) }, (_, i) => (
          <span
            key={i}
            aria-hidden
            className={styles.tick}
            style={{ left: `${ticks > 1 ? (i / (ticks - 1)) * 100 : 0}%` }}
          />
        ))}
        <span
          aria-hidden
          data-slider-thumb
          className={styles.thumb}
          style={{ left: `${ratio * 100}%` }}
        />
      </div>
    );
  },
);

/** How far each key moves the value, in steps. `min`/`max` jump to an end. */
const KEY_DELTA: Record<string, number | "min" | "max" | undefined> = {
  ArrowRight: 1,
  ArrowUp: 1,
  ArrowLeft: -1,
  ArrowDown: -1,
  PageUp: 10,
  PageDown: -10,
  Home: "min",
  End: "max",
};

export type SliderSeparatorProps = Omit<
  HTMLAttributes<HTMLSpanElement>,
  "children"
>;

/** The hairline rule between the ruler and the readout. */
function SliderSeparator({ className, ...rest }: SliderSeparatorProps) {
  const { styles } = useSlider("Slider.Separator");
  return (
    <span aria-hidden className={cx(styles.separator, className)} {...rest} />
  );
}

export type SliderOutputProps = Omit<HTMLAttributes<HTMLSpanElement>, "children">;

/**
 * The numeric readout. Hidden from assistive tech on purpose: it is a visual
 * echo of the track's own `aria-valuetext`, and announcing it twice is noise.
 */
function SliderOutput({ className, ...rest }: SliderOutputProps) {
  const { scale, value, styles } = useSlider("Slider.Output");
  return (
    <span aria-hidden className={cx(styles.output, className)} {...rest}>
      <WireframeText>{formatSliderValue(value, scale.step)}</WireframeText>
    </span>
  );
}

/**
 * Compound slider. `Slider` is the control (state, keyboard, drag) and renders
 * the shared field frame; the parts inside it are composable — pass children to
 * rearrange or drop one, pass none for the drawn arrangement (Figma 842:7179).
 *
 * @example
 * <Field size="sm">
 *   <Field.Label>Break duration</Field.Label>
 *   <Slider max={60} step={5} defaultValue={30} />
 * </Field>
 */
export const Slider = Object.assign(SliderRoot, {
  Track: SliderTrack,
  Separator: SliderSeparator,
  Output: SliderOutput,
});
