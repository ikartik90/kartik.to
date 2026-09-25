"use client";

import { useState } from "react";
import AddIcon from "@/assets/icons/add.svg";
import RemoveIcon from "@/assets/icons/remove.svg";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input/field";
import { PropertiesPanel } from "@/components/ui/properties-panel";
import { Tooltip } from "@/components/ui/tooltip";
import {
  MAX_ICON_ALIASES,
  applyAliasEdit,
  commonIconAliases,
  type IconAsset,
} from "@/domain/icon";

export interface IconLabelEdit {
  key: string;
  title: string;
  aliases: string[];
}

export interface IconLabelsGroupProps {
  /** One icon or the whole selection; never empty. */
  icons: IconAsset[];
  onSave: (edits: IconLabelEdit[]) => void;
}

export function IconLabelsGroup({ icons, onSave }: IconLabelsGroupProps) {
  const single = icons.length === 1 ? icons[0] : null;

  // Read once: the component remounts when the selection moves, and edits are matched by position in it.
  const [base] = useState(() => commonIconAliases(icons.map((i) => i.aliases)));
  const [title, setTitle] = useState(single?.title ?? "");
  const [aliases, setAliases] = useState<string[]>(base);

  const save = (nextTitle: string, draft: string[]) =>
    onSave(
      icons.map((icon) => ({
        key: icon.key,
        title: single ? nextTitle : icon.title,
        aliases: applyAliasEdit(icon.aliases, base, draft),
      })),
    );

  const setAlias = (index: number, value: string) =>
    setAliases((current) =>
      current.map((alias, at) => (at === index ? value : alias)),
    );

  const removeAlias = (index: number) => {
    const next = aliases.filter((_, at) => at !== index);
    setAliases(next);
    save(title, next);
  };

  return (
    <PropertiesPanel.Group
      title="Aliases"
      actions={
        <Button
          variant="icon"
          aria-label="Add alias"
          disabled={aliases.length >= MAX_ICON_ALIASES}
          onClick={() => setAliases((current) => [...current, ""])}
        >
          <AddIcon />
          <Button.Tooltip>
            <Tooltip.Text>Add alias</Tooltip.Text>
          </Button.Tooltip>
        </Button>
      }
    >
      {single && (
        <PropertiesPanel.Control label="Icon name">
          {/* Not `TextInput`: a second field would steal the row label's `htmlFor`. */}
          <Field.Frame>
            <Field.Control
              value={title}
              placeholder={single.name}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={() => save(title, aliases)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />
          </Field.Frame>
        </PropertiesPanel.Control>
      )}

      {aliases.map((alias, index) => (
        <PropertiesPanel.Control
          // Position is the identity: a value key would re-key on every letter.
          key={index}
          label=""
        >
          <Field.Frame>
            <Field.Control
              aria-label={`Alias ${index + 1}`}
              value={alias}
              placeholder={
                single ? "Another word for it" : "A word they all answer to"
              }
              onChange={(event) => setAlias(index, event.target.value)}
              onBlur={() => save(title, aliases)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />
          </Field.Frame>

          <Button
            variant="icon"
            aria-label={`Remove alias ${index + 1}`}
            onClick={() => removeAlias(index)}
          >
            <RemoveIcon />
            <Button.Tooltip>
              <Tooltip.Text>Remove alias</Tooltip.Text>
            </Button.Tooltip>
          </Button>
        </PropertiesPanel.Control>
      ))}
    </PropertiesPanel.Group>
  );
}
