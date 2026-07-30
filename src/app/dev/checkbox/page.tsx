"use client";

import { css } from "../../../../styled-system/css";
import { Field } from "@/components/ui/input/field";
import { Checkbox } from "@/components/ui/input/checkbox";
import { Wireframe } from "@/components/ui/wireframe";

const captionStyle = css({ textStyle: "caption", color: "text.default/50" });

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

        {/* Wireframe: the 16px box stays a box — only the label and hint become
            bars (Figma 745:4411). A checkbox with a bar for a label is still
            recognisably a checkbox, which is the whole point of scoping the
            treatment to text rather than blanketing the subtree. */}
        <span className={captionStyle}>placeholder — inert, dimmed</span>
        <Wireframe>
          <Field>
            <Checkbox defaultChecked />
            <Field.Label>Repeat this shift weekly</Field.Label>
            <Field.Hint>Stay signed in on this device</Field.Hint>
          </Field>
        </Wireframe>

        {/* Interactive: the box still toggles, the text still reads as bars. */}
        <span className={captionStyle}>interactive — still togglable</span>
        <Wireframe interactive>
          <Field>
            <Checkbox />
            <Field.Label>Repeat this shift weekly</Field.Label>
          </Field>
        </Wireframe>

        <span className={captionStyle}>loading — shimmering</span>
        <Wireframe mode="loading">
          <Field>
            <Checkbox />
            <Field.Label>Repeat this shift weekly</Field.Label>
            <Field.Hint>Stay signed in on this device</Field.Hint>
          </Field>
        </Wireframe>
      </div>
    </main>
  );
}
