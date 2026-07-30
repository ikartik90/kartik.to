"use client";

import { css } from "../../../../styled-system/css";
import { Field } from "@/components/ui/input/field";
import { Checkbox } from "@/components/ui/input/checkbox";

/** Local-only preview route for eyeballing the Checkbox states. */
export default function CheckboxPreviewPage() {
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
          alignItems: "start",
        })}
      >
        <Field>
          <Checkbox />
          <Field.Label>Remember me</Field.Label>
        </Field>
        <Field>
          <Checkbox defaultChecked />
          <Field.Label>Remember me</Field.Label>
          <Field.Hint>Stay signed in on this device</Field.Hint>
        </Field>

        {/* No `size` on the control — the field size scales only the label and
            hint around a fixed 20px box. */}
        <Field size="sm">
          <Checkbox />
          <Field.Label>Small label</Field.Label>
          <Field.Hint>caption label · caption hint</Field.Hint>
        </Field>
        <Field size="lg">
          <Checkbox defaultChecked />
          <Field.Label>Large label</Field.Label>
          <Field.Hint>bodyLarge label · bodySmall hint</Field.Hint>
        </Field>

        <Field>
          <Checkbox disabled />
          <Field.Label>Disabled</Field.Label>
        </Field>
      </div>
    </main>
  );
}
