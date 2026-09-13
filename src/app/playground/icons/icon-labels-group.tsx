"use client";

import { useState } from "react";
import AddIcon from "@/assets/icons/add.svg";
import RemoveIcon from "@/assets/icons/remove.svg";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input/field";
import { PropertiesPanel } from "@/components/ui/properties-panel";
import { Tooltip } from "@/components/ui/tooltip";
import { MAX_ICON_ALIASES, type IconAsset } from "@/domain/icon";

// ---------------------------------------------------------------------------
// What ONE icon is called, and the other words it answers to.
//
// The two facts an icon's own file cannot carry, and the only part of this
// panel that is about a single icon rather than about the set or the view of
// it. So it is rendered only where it has one icon to be about — the page
// hands it exactly one or does not render it at all — which is the same rule
// the action chips keep: never a control that cannot mean anything.
//
// STATE. The fields are a draft, seeded from the icon and living until the
// selection moves. Nothing resets them from the outside: the page gives this
// component `key={icon.key}`, so choosing another icon is a REMOUNT and the
// draft goes with the icon it belonged to. An effect syncing props into state
// would be the same thing, one render later and with a stale frame in front
// of you.
//
// WHEN IT SAVES. On the way out of a field, never on the way through it: a
// write per keystroke is two hundred writes to spell an alias, and a word is
// not worth storing until you have stopped typing it. Removing a row saves at
// once, because there is no field left to leave.
//
// The row a press on Add opens is EMPTY and saves nothing. An alias only
// exists once it has a word in it — see `cleanIconAliases`, which drops the
// blanks on the way to the database, so an opened row that never got filled
// costs nothing but the row.
// ---------------------------------------------------------------------------

export interface IconLabelsGroupProps {
  /** The one icon being named. */
  icon: IconAsset;
  /** Store the name and the words, both at once — they are one row. */
  onSave: (key: string, title: string, aliases: string[]) => void;
}

export function IconLabelsGroup({ icon, onSave }: IconLabelsGroupProps) {
  const [title, setTitle] = useState(icon.title);
  const [aliases, setAliases] = useState<string[]>(icon.aliases);

  const save = (nextTitle: string, nextAliases: string[]) =>
    onSave(icon.key, nextTitle, nextAliases);

  const setAlias = (index: number, value: string) =>
    setAliases((current) =>
      current.map((alias, at) => (at === index ? value : alias)),
    );

  const removeAlias = (index: number) => {
    const next = aliases.filter((_, at) => at !== index);
    setAliases(next);
    // No field is being left here, so this is the press that has to save.
    save(title, next);
  };

  return (
    <PropertiesPanel.Group
      title="Aliases"
      actions={
        <Button
          variant="icon"
          aria-label="Add alias"
          // The cap is the schema's; the button stops rather than letting the
          // server refuse a press that looked like it would work.
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
      {/* The name, which is not an alias — it is what the icon is CALLED, and
          what its tooltip says. Emptying it hands the icon back to its
          filename rather than leaving it nameless. */}
      <PropertiesPanel.Control label="Icon name">
        {/* A bare `Field.Frame` rather than a `TextInput`: `Control` IS the
            field, and a second one inside it would leave the row's visible
            label pointing at its own control instead of this one. */}
        <Field.Frame>
          <Field.Control
            value={title}
            placeholder={icon.name}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => save(title, aliases)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
          />
        </Field.Frame>
      </PropertiesPanel.Control>

      {aliases.map((alias, index) => (
        <PropertiesPanel.Control
          // The row's position IS its identity: there is nothing else to key
          // an empty row by, and a value would re-key itself on every letter.
          key={index}
          // No label of its own. The section is called Aliases and these are
          // the aliases; a column of the word repeated would be furniture,
          // and the field carries the name a reader needs.
          label=""
        >
          <Field.Frame>
            <Field.Control
              aria-label={`Alias ${index + 1}`}
              value={alias}
              placeholder="Another word for it"
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
