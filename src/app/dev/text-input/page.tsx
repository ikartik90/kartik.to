"use client";

import { useState } from "react";
import { css } from "../../../../styled-system/css";
import { TextInput } from "@/components/ui/input/text-input";
import { Wireframe } from "@/components/ui/wireframe";
import { Button } from "@/components/ui/button";
import CalendarIcon from "@/assets/icons/calendar.svg";

const columnStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "3xl",
  width: "240px",
});

const captionStyle = css({ textStyle: "caption", color: "text.default/50" });

/** Local-only preview route for eyeballing the TextInput default/active states. */
export default function TextInputPreviewPage() {
  // The loading scope is a toggle, not a second tree — flip it and the bars
  // become the real values in place, with no layout shift.
  const [pending, setPending] = useState(true);

  return (
    <main
      className={css({
        minHeight: "100dvh",
        backgroundColor: "bg.canvas",
        display: "flex",
        // globals.css sets `main { flex-direction: column }`; state the row
        // explicitly so the declared flexWrap below is not a no-op.
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "center",
        gap: "5xl",
        padding: "5xl",
        flexWrap: "wrap",
      })}
    >
      <div className={columnStyle}>
        <span className={captionStyle}>live</span>
        <TextInput
          label="Label"
          hint="Hint text"
          iconBefore={<CalendarIcon />}
          defaultValue="11/12/2026"
        />
        <TextInput
          label="Label"
          hint="Hint text"
          iconBefore={<CalendarIcon />}
          defaultValue="11/12/2026"
        />
      </div>

      {/* The Figma case (745:4383): the field keeps its frame, border and
          leading icon; only the label / value / hint become bars, each sitting
          in the line box of the text it replaced. */}
      {/* The opacity ladder — four deliberate depths, independent of mode and of
          interactivity. 25 is the Figma's recessed demo block; 50 is the default. */}
      <div className={columnStyle}>
        <span className={captionStyle}>opacity — 25 / 50 / 75 / 100</span>
        {([25, 50, 75, 100] as const).map((level) => (
          <Wireframe key={level} opacity={level}>
            <TextInput
              label="Shift role"
              placeholder="Select a role"
              iconBefore={<CalendarIcon />}
            />
          </Wireframe>
        ))}
      </div>

      <div className={columnStyle}>
        <span className={captionStyle}>
          placeholder — inert, decorative, default 50%
        </span>
        <Wireframe className={columnStyle}>
          <TextInput
            label="Label"
            hint="Hint text"
            iconBefore={<CalendarIcon />}
            defaultValue="11/12/2026"
          />
          <TextInput label="Shift role" placeholder="Select a role" />
        </Wireframe>
      </div>

      <div className={columnStyle}>
        <span className={captionStyle}>
          loading — full strength, shimmering, aria-busy
        </span>
        <Wireframe mode="loading" enabled={pending} className={columnStyle}>
          <TextInput
            label="Label"
            hint="Hint text"
            iconBefore={<CalendarIcon />}
            defaultValue="11/12/2026"
          />
          <TextInput label="Shift role" placeholder="Select a role" />
        </Wireframe>
        <Button emphasis="tertiary" onClick={() => setPending((p) => !p)}>
          {pending ? "Finish loading" : "Reload"}
        </Button>
      </div>
    </main>
  );
}
