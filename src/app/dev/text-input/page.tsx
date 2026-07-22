"use client";

import { css } from "../../../../styled-system/css";
import { TextInput } from "@/components/ui/input/text-input";
import CalendarIcon from "@/assets/icons/calendar.svg";

/** Local-only preview route for eyeballing the TextInput default/active states. */
export default function TextInputPreviewPage() {
  return (
    <main
      className={css({
        minHeight: "100dvh",
        backgroundColor: "bg.canvas",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "5xl",
      })}
    >
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: "3xl",
          width: "240px",
        })}
      >
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
    </main>
  );
}
