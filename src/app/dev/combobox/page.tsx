"use client";

import { useState } from "react";
import { css } from "../../../../styled-system/css";
import { Combobox } from "@/components/ui/input/combobox";
import { Field } from "@/components/ui/input/field";

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
    </main>
  );
}
