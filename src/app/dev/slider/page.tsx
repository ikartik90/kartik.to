"use client";

import { useState } from "react";
import { css } from "../../../../styled-system/css";
import { Field } from "@/components/ui/input/field";
import { Slider } from "@/components/ui/input/slider";
import { Wireframe } from "@/components/ui/wireframe";
import { Button } from "@/components/ui/button";
import LightIcon from "@/assets/icons/light.svg";

const columnStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "3xl",
  width: "200px",
});

const captionStyle = css({ textStyle: "caption", color: "text.default/50" });

/** Local-only preview route for eyeballing the Slider against Figma 842:7179. */
export default function SliderPreviewPage() {
  const [volume, setVolume] = useState(60);
  const [pending, setPending] = useState(true);

  return (
    <main
      className={css({
        minHeight: "100dvh",
        backgroundColor: "bg.canvas",
        display: "flex",
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "center",
        gap: "5xl",
        padding: "5xl",
        flexWrap: "wrap",
      })}
    >
      {/* The drawn case: a 200px field at size sm, 11 ticks, value at max.
          Tab into it for the Focus variant — the frame, ruler, thumb and
          readout all shift to the accent off the field recipe alone. */}
      <div className={columnStyle}>
        <span className={captionStyle}>drawn — 200px, sm, value 100</span>
        <Field size="sm">
          <Slider defaultValue={100} />
        </Field>
        <Field size="sm">
          <Slider defaultValue={40} />
        </Field>
      </div>

      <div className={columnStyle}>
        <span className={captionStyle}>with label + hint</span>
        <Field size="sm">
          <Field.Label>Opacity</Field.Label>
          <Slider defaultValue={75} />
          <Field.Hint>Arrow keys step by 1</Field.Hint>
        </Field>
        <Field size="sm">
          <Field.Label>Break duration</Field.Label>
          <Slider max={60} step={5} ticks={13} defaultValue={30} />
          <Field.Hint>Minutes, in fives</Field.Hint>
        </Field>
      </div>

      {/* A leading icon is a plain <Icon aria-hidden /> child, exactly as in a
          text input — the `frame` recipe sizes and tints every direct svg it
          holds. Passing children means stating the whole arrangement, so the
          three parts come along with it. */}
      <div className={columnStyle}>
        <span className={captionStyle}>leading icon</span>
        <Field size="sm">
          <Slider defaultValue={60}>
            <LightIcon aria-hidden />
            <Slider.Track />
            <Slider.Separator />
            <Slider.Output />
          </Slider>
        </Field>
      </div>

      <div className={columnStyle}>
        <span className={captionStyle}>size — sm / md / lg</span>
        {(["sm", "md", "lg"] as const).map((size) => (
          <Field key={size} size={size}>
            <Field.Label>Label</Field.Label>
            <Slider defaultValue={70} />
            <Field.Hint>Hint text</Field.Hint>
          </Field>
        ))}
      </div>

      <div className={columnStyle}>
        <span className={captionStyle}>controlled — {volume}</span>
        <Field size="sm">
          <Field.Label>Volume</Field.Label>
          <Slider value={volume} onValueChange={setVolume} />
        </Field>
        <Button emphasis="tertiary" onClick={() => setVolume(0)}>
          Mute
        </Button>

        <span className={captionStyle}>fractional — step 0.25</span>
        <Field size="sm">
          <Slider min={0} max={1} step={0.25} ticks={5} defaultValue={0.5} />
        </Field>

        <span className={captionStyle}>disabled</span>
        <Field size="sm">
          <Slider defaultValue={30} disabled />
        </Field>
      </div>

      {/* Like the switch, the ruler is geometry rather than text, so it renders
          as itself; only the numeric readout becomes a bar. */}
      <div className={columnStyle}>
        <span className={captionStyle}>placeholder / loading</span>
        <Wireframe className={columnStyle}>
          <Field size="sm">
            <Field.Label>Opacity</Field.Label>
            <Slider defaultValue={100} />
            <Field.Hint>Hint text</Field.Hint>
          </Field>
        </Wireframe>
        <Wireframe mode="loading" enabled={pending} className={columnStyle}>
          <Field size="sm">
            <Field.Label>Opacity</Field.Label>
            <Slider defaultValue={100} />
            <Field.Hint>Hint text</Field.Hint>
          </Field>
        </Wireframe>
        <Button emphasis="tertiary" onClick={() => setPending((p) => !p)}>
          {pending ? "Finish loading" : "Reload"}
        </Button>
      </div>
    </main>
  );
}
