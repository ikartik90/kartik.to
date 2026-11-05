"use client";

import { css } from "../../../../styled-system/css";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input/field";
import { SegmentedControl } from "@/components/ui/input/segmented-control";
import { Slider } from "@/components/ui/input/slider";
import { Switch } from "@/components/ui/input/switch";
import { Tooltip } from "@/components/ui/tooltip";
import CheckIcon from "@/assets/icons/check.svg";
import SliderIcon from "@/assets/icons/slider.svg";
import {
  SCRIM_RANGE,
  SIDE_SHEET_MOTION,
  WAY_RANGE,
  mergeMotion,
  useSideSheetMotion,
  type Range,
  type SideSheetMotion,
  type Way,
} from "./side-sheet-motion";
import { CurveEditor } from "./curve-editor";
import { ValuesActions } from "./values-actions";

// Kartik's controls for how side sheets come and go, in the About sheet in development. Tune, open a sheet in the
// app to see it, then copy the values to make them the defaults.

// Its parts keep their height in the card, which would otherwise squeeze them to fit.
const editorStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "xl",
  "& > *, & > section > *": { flexShrink: 0 },
});

const headStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "md",
});

const titleStyle = css({ textStyle: "subheading", color: "text.title" });

const actionsStyle = css({ display: "flex", alignItems: "center", gap: "xs" });

const groupStyle = css({ display: "flex", flexDirection: "column", gap: "md" });

const groupTitleStyle = css({ textStyle: "caption", color: "text.body" });

// What the offsets' sliders reach: px for a nudge, % of the sheet for a slide from off its edge.
const OFFSET: Record<SideSheetMotion["unit"], Range> = {
  px: { min: -400, max: 400, step: 1 },
  "%": { min: -100, max: 100, step: 1 },
};

/** The About sheet's switch between the project story and these controls, in development only. */
export function TuneMotionToggle({ tuning, onTuning }: { tuning: boolean; onTuning: (tuning: boolean) => void }) {
  if (process.env.NODE_ENV !== "development") return null;
  const label = tuning ? "Done tuning" : "Tune side sheet motion";
  return (
    <Button variant="icon" aria-label={label} aria-pressed={tuning} onClick={() => onTuning(!tuning)}>
      {tuning ? <CheckIcon aria-hidden /> : <SliderIcon aria-hidden />}
      <Button.Tooltip>
        <Tooltip.Text>{label}</Tooltip.Text>
      </Button.Tooltip>
    </Button>
  );
}

function NumberControl({
  label,
  range,
  value,
  onChange,
}: {
  label: string;
  range: Range;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <Field size="sm">
      <Field.Label>{label}</Field.Label>
      <Slider min={range.min} max={range.max} step={range.step} value={value} onValueChange={onChange} />
    </Field>
  );
}

export function MotionEditor() {
  const [motion, setMotion] = useSideSheetMotion();
  const offset = OFFSET[motion.unit];
  const set = (change: Partial<SideSheetMotion>) => setMotion({ ...motion, ...change });
  const way = (which: "enter" | "exit", change: Partial<Way & { mirror: boolean }>) =>
    set({ [which]: { ...motion[which], ...change } });

  const place = (which: "enter" | "exit") => (
    <>
      <NumberControl
        label={`X (${motion.unit})`}
        range={offset}
        value={motion[which].x}
        onChange={(x) => way(which, { x })}
      />
      <NumberControl
        label={`Y (${motion.unit})`}
        range={offset}
        value={motion[which].y}
        onChange={(y) => way(which, { y })}
      />
      <NumberControl
        label="Opacity"
        range={WAY_RANGE.opacity}
        value={motion[which].opacity}
        onChange={(opacity) => way(which, { opacity })}
      />
      <NumberControl
        label="Scale"
        range={WAY_RANGE.scale}
        value={motion[which].scale}
        onChange={(scale) => way(which, { scale })}
      />
    </>
  );
  const timing = (which: "enter" | "exit") => (
    <>
      <NumberControl
        label="Duration (ms)"
        range={WAY_RANGE.duration}
        value={motion[which].duration}
        onChange={(duration) => way(which, { duration })}
      />
      <NumberControl
        label="Delay (ms)"
        range={WAY_RANGE.delay}
        value={motion[which].delay}
        onChange={(delay) => way(which, { delay })}
      />
      <Field size="sm">
        <Field.Label>Easing</Field.Label>
        <CurveEditor curve={motion[which].easing} onCurveChange={(easing) => way(which, { easing })} />
      </Field>
    </>
  );

  return (
    <div className={editorStyle}>
      <div className={headStyle}>
        <h2 className={titleStyle}>Side sheet motion</h2>
        <div className={actionsStyle}>
          <ValuesActions
            values={motion}
            onPaste={(pasted) => {
              const next = mergeMotion(motion, pasted);
              if (next) setMotion(next);
              return !!next;
            }}
            onReset={() => setMotion(SIDE_SHEET_MOTION)}
          />
        </div>
      </div>

      <section className={groupStyle} aria-label="Offsets">
        <Field size="sm">
          <Field.Label>Offsets in</Field.Label>
          {/* A block of its own: as a column's flex item, its toolbar's zero basis collapses it. */}
          <div>
            <SegmentedControl
              options={[
                { value: "px", label: "px" },
                { value: "%", label: "% of the sheet" },
              ]}
              value={motion.unit}
              onValueChange={(unit) => set({ unit: unit as SideSheetMotion["unit"] })}
            />
          </div>
        </Field>
        <Field size="sm">
          <Field.Label>Scales from</Field.Label>
          <div>
            <SegmentedControl
              options={[
                { value: "center", label: "Centre" },
                { value: "end", label: "Right edge" },
              ]}
              value={motion.origin}
              onValueChange={(origin) => set({ origin: origin as SideSheetMotion["origin"] })}
            />
          </div>
        </Field>
      </section>

      <section className={groupStyle} aria-label="Way in">
        <h3 className={groupTitleStyle}>Way in: where it starts</h3>
        {place("enter")}
        {timing("enter")}
      </section>

      <section className={groupStyle} aria-label="Way out">
        <h3 className={groupTitleStyle}>Way out: where it ends</h3>
        <Field size="sm">
          <Switch checked={motion.exit.mirror} onCheckedChange={(mirror) => way("exit", { mirror })} />
          <Field.Label>Leave the way it came</Field.Label>
        </Field>
        {!motion.exit.mirror && place("exit")}
        {timing("exit")}
      </section>

      <section className={groupStyle} aria-label="Scrim">
        <h3 className={groupTitleStyle}>Scrim, behind a shift or template</h3>
        <NumberControl
          label="Fade in (ms)"
          range={SCRIM_RANGE.enter}
          value={motion.scrim.enter}
          onChange={(enter) => set({ scrim: { ...motion.scrim, enter } })}
        />
        <NumberControl
          label="Fade out (ms)"
          range={SCRIM_RANGE.exit}
          value={motion.scrim.exit}
          onChange={(exit) => set({ scrim: { ...motion.scrim, exit } })}
        />
        <NumberControl
          label="Delay (ms)"
          range={SCRIM_RANGE.delay}
          value={motion.scrim.delay}
          onChange={(delay) => set({ scrim: { ...motion.scrim, delay } })}
        />
      </section>
    </div>
  );
}
