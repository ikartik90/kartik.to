"use client";

import { useState } from "react";
import { css } from "../../../../styled-system/css";
import { OptionList } from "@/components/ui/input/option-list";
import { Field } from "@/components/ui/input/field";
import { Wireframe } from "@/components/ui/wireframe";
import EditIcon from "@/assets/icons/edit.svg";
import CopyIcon from "@/assets/icons/copy.svg";
import PublishIcon from "@/assets/icons/publish.svg";
import TrashIcon from "@/assets/icons/trash.svg";

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

const ACTIONS = [
  { value: "edit", label: "Edit", Icon: EditIcon },
  { value: "duplicate", label: "Duplicate", Icon: CopyIcon },
  { value: "publish", label: "Publish", Icon: PublishIcon },
  { value: "delete", label: "Delete", Icon: TrashIcon },
];

/** Local-only preview route for the stand-alone (always-open) OptionList. */
export default function OptionListPreviewPage() {
  const [fruit, setFruit] = useState<string | null>("grapes");
  const [action, setAction] = useState<string | null>("publish");

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
      {/* Options are authored as children — one <OptionList.Option> per item.
          The label text is the child, so search + selection just work. */}
      <Field>
        <Field.Label>Fruit</Field.Label>
        <OptionList value={fruit} onValueChange={setFruit}>
          <Field.Search placeholder="Search…" />
          <OptionList.Listbox>
            {FRUITS.map((f) => (
              <OptionList.Option key={f.value} value={f.value}>
                {f.label}
              </OptionList.Option>
            ))}
          </OptionList.Listbox>
        </OptionList>
        <Field.Hint>Type to filter, click to pick</Field.Hint>
      </Field>

      {/* Rich children: a leading icon beside the label. `label` gives search +
          the trigger the plain text, children own the visual. */}
      <Field>
        <Field.Label>Action</Field.Label>
        <OptionList value={action} onValueChange={setAction}>
          <OptionList.Listbox>
            {ACTIONS.map(({ value, label, Icon }) => (
              <OptionList.Option key={value} value={value} label={label}>
                <Icon />
                {label}
              </OptionList.Option>
            ))}
          </OptionList.Listbox>
        </OptionList>
        <Field.Hint>Composed icon + label</Field.Hint>
      </Field>

      {/* Wireframe on rich children — the case that rules out blanket
          descendant styling. Each row's LABEL becomes a bar while its leading
          icon renders as itself, because `WireframeContent` bars only the text
          runs among an option's children. Wrapping the row wholesale would have
          swallowed the glyph. */}
      <div
        className={css({ display: "flex", flexDirection: "column", gap: "lg" })}
      >
        <span className={css({ textStyle: "caption", color: "text.default/50" })}>
          placeholder — icons survive, labels bar
        </span>
        <Wireframe>
          <Field>
            <Field.Label>Action</Field.Label>
            <OptionList defaultValue="publish">
              <OptionList.Listbox>
                {ACTIONS.map(({ value, label, Icon }) => (
                  <OptionList.Option key={value} value={value} label={label}>
                    <Icon />
                    {label}
                  </OptionList.Option>
                ))}
              </OptionList.Listbox>
            </OptionList>
            <Field.Hint>Composed icon + label</Field.Hint>
          </Field>
        </Wireframe>
      </div>

      <div
        className={css({ display: "flex", flexDirection: "column", gap: "lg" })}
      >
        <span className={css({ textStyle: "caption", color: "text.default/50" })}>
          loading — a list whose rows are not known yet
        </span>
        <Wireframe mode="loading">
          <Field>
            <Field.Label>Fruit</Field.Label>
            <OptionList>
              <OptionList.Listbox>
                {FRUITS.slice(0, 5).map((f) => (
                  <OptionList.Option key={f.value} value={f.value}>
                    {f.label}
                  </OptionList.Option>
                ))}
              </OptionList.Listbox>
            </OptionList>
            <Field.Hint>Type to filter, click to pick</Field.Hint>
          </Field>
        </Wireframe>
      </div>
    </main>
  );
}
