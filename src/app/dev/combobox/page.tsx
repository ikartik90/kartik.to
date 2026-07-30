"use client";

import { useState } from "react";
import { css } from "../../../../styled-system/css";
import { Combobox } from "@/components/ui/input/combobox";
import { Field } from "@/components/ui/input/field";
import { Wireframe } from "@/components/ui/wireframe";

const captionStyle = css({ textStyle: "caption", color: "text.default/50" });
const columnStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "lg",
  width: "180px",
});

const FRUITS = [
  { value: "apple", label: "Apple" },
  { value: "avocado", label: "Avocado" },
  { value: "banana", label: "Banana" },
  { value: "grapes", label: "Grapes" },
  { value: "jackfruit", label: "Jackfruit" },
  { value: "lychee", label: "Lychee" },
  { value: "mango", label: "Mango" },
  { value: "passion-fruit", label: "Passion Fruit" },
  { value: "pomegranate", label: "Pomegranate" },
];

/** Local-only preview route for the assembled Combobox (trigger + popover). */
export default function ComboboxPreviewPage() {
  const [fruit, setFruit] = useState<string | null>("grapes");

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
      {/* Options are authored as Combobox.Option children — the same children
          feed the closed trigger's label and the open popover's list. */}
      <Field className={css({ width: "180px" })}>
        <Field.Label>Fruit</Field.Label>
        <Combobox value={fruit} onValueChange={setFruit}>
          {FRUITS.map((f) => (
            <Combobox.Option key={f.value} value={f.value}>
              {f.label}
            </Combobox.Option>
          ))}
        </Combobox>
        <Field.Hint>Click to open the list</Field.Hint>
      </Field>

      {/* Empty → placeholder. */}
      <Field className={css({ width: "180px" })}>
        <Field.Label>Second fruit</Field.Label>
        <Combobox placeholder="Select a fruit">
          {FRUITS.map((f) => (
            <Combobox.Option key={f.value} value={f.value}>
              {f.label}
            </Combobox.Option>
          ))}
        </Combobox>
        <Field.Hint>No selection yet</Field.Hint>
      </Field>

      {/* Wireframe: the trigger keeps its frame and chevron, the selected
          label becomes a bar of that label's width. */}
      <div className={columnStyle}>
        <span className={captionStyle}>placeholder — inert</span>
        <Wireframe>
          <Field>
            <Field.Label>Fruit</Field.Label>
            <Combobox defaultValue="pomegranate">
              {FRUITS.map((f) => (
                <Combobox.Option key={f.value} value={f.value}>
                  {f.label}
                </Combobox.Option>
              ))}
            </Combobox>
            <Field.Hint>Click to open the list</Field.Hint>
          </Field>
        </Wireframe>
      </div>

      {/* Interactive: the popover still opens — and because React context
          crosses the portal, every option inside it wireframes too. */}
      <div className={columnStyle}>
        <span className={captionStyle}>interactive — opens, options bar too</span>
        <Wireframe interactive>
          <Field>
            <Field.Label>Fruit</Field.Label>
            <Combobox defaultValue="grapes">
              {FRUITS.map((f) => (
                <Combobox.Option key={f.value} value={f.value}>
                  {f.label}
                </Combobox.Option>
              ))}
            </Combobox>
            <Field.Hint>Click to open the list</Field.Hint>
          </Field>
        </Wireframe>
      </div>

      <div className={columnStyle}>
        <span className={captionStyle}>loading — shimmering</span>
        <Wireframe mode="loading">
          <Field>
            <Field.Label>Fruit</Field.Label>
            <Combobox placeholder="Select a fruit">
              {FRUITS.map((f) => (
                <Combobox.Option key={f.value} value={f.value}>
                  {f.label}
                </Combobox.Option>
              ))}
            </Combobox>
            <Field.Hint>No selection yet</Field.Hint>
          </Field>
        </Wireframe>
      </div>
    </main>
  );
}
