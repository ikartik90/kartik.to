"use client";

import { css } from "../../../../styled-system/css";
import { Field } from "@/components/ui/input/field";
import { Switch } from "@/components/ui/input/switch";
import { Wireframe } from "@/components/ui/wireframe";

const captionStyle = css({ textStyle: "caption", color: "text.default/50" });

/** Local-only preview route for eyeballing the Switch sizes/states. */
export default function SwitchPreviewPage() {
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
        <Field size="lg">
          <Switch />
          <Field.Label>Large label</Field.Label>
          <Field.Hint>bodyLarge label · bodySmall hint</Field.Hint>
        </Field>
        <Field size="lg">
          <Switch defaultChecked />
          <Field.Label>Large label</Field.Label>
          <Field.Hint>bodyLarge label · bodySmall hint</Field.Hint>
        </Field>
        <Field size="sm">
          <Switch />
          <Field.Label>Small label</Field.Label>
          <Field.Hint>caption label · caption hint</Field.Hint>
        </Field>
        <Field size="sm">
          <Field.Frame>
            <Switch defaultChecked />
            <Field.Label>Small label</Field.Label>
            <Field.Hint>caption label · caption hint</Field.Hint>
          </Field.Frame>
        </Field>

        {/* Per-part overrides: the field size sets a coordinated default, each
            part deviates deliberately (token-bounded). */}
        <Field>
          <Switch size="sm" defaultChecked />
          <Field.Label type="caption">lg field, caption label</Field.Label>
          <Field.Hint type="caption">hint overridden to caption too</Field.Hint>
        </Field>
        <Field size="sm">
          <Switch size="lg" defaultChecked />
          <Field.Label type="subheading">sm label, lg switch override</Field.Label>
          <Field.Hint>caption hint, large track</Field.Hint>
        </Field>

        {/* Wireframe: the track and thumb are geometry, not text, so they render
            as themselves — including the on-state accent. The bars track the
            field size, because they take the line box of the label and hint the
            `field` recipe sized. */}
        <span className={captionStyle}>placeholder — lg then sm</span>
        <Wireframe
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: "3xl",
            alignItems: "start",
          })}
        >
          <Field size="lg">
            <Switch defaultChecked />
            <Field.Label>Large label</Field.Label>
            <Field.Hint>bodyLarge label · bodySmall hint</Field.Hint>
          </Field>
          <Field size="sm">
            <Switch />
            <Field.Label>Small label</Field.Label>
            <Field.Hint>caption label · caption hint</Field.Hint>
          </Field>
        </Wireframe>

        <span className={captionStyle}>interactive — still flips</span>
        <Wireframe interactive>
          <Field size="lg">
            <Switch />
            <Field.Label>Large label</Field.Label>
            <Field.Hint>bodyLarge label · bodySmall hint</Field.Hint>
          </Field>
        </Wireframe>

        <span className={captionStyle}>loading — shimmering</span>
        <Wireframe mode="loading">
          <Field size="lg">
            <Switch defaultChecked />
            <Field.Label>Large label</Field.Label>
            <Field.Hint>bodyLarge label · bodySmall hint</Field.Hint>
          </Field>
        </Wireframe>
      </div>
    </main>
  );
}
