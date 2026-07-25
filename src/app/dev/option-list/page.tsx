"use client";

import { useState } from "react";
import { css } from "../../../../styled-system/css";
import { OptionList } from "@/components/ui/input/option-list";
import { Field } from "@/components/ui/input/field";
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
          <OptionList.Options>
            {FRUITS.map((f) => (
              <OptionList.Option key={f.value} value={f.value}>
                {f.label}
              </OptionList.Option>
            ))}
          </OptionList.Options>
        </OptionList>
        <Field.Hint>Type to filter, click to pick</Field.Hint>
      </Field>

      {/* Rich children: a leading icon beside the label. `label` gives search +
          the trigger the plain text, children own the visual. */}
      <Field>
        <Field.Label>Action</Field.Label>
        <OptionList value={action} onValueChange={setAction}>
          <OptionList.Options>
            {ACTIONS.map(({ value, label, Icon }) => (
              <OptionList.Option key={value} value={value} label={label}>
                <Icon />
                {label}
              </OptionList.Option>
            ))}
          </OptionList.Options>
        </OptionList>
        <Field.Hint>Composed icon + label</Field.Hint>
      </Field>
    </main>
  );
}
