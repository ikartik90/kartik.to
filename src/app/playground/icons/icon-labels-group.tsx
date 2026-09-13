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

// ---------------------------------------------------------------------------
// What an icon is called, and the other words it answers to.
//
// The two facts an icon's own file cannot carry, and the only part of this
// panel that is about the icons themselves rather than about the set or the
// view of it.
//
// A NAME is one icon's, so that field appears only when one is selected — two
// icons cannot share a name. ALIASES are not: a tag names a family, and
// naming a family one icon at a time is how eleven marks end up under `arrow`
// and a twelfth under `arrows`. So the fields go on working over a selection,
// showing the words they ALL answer to (`commonIconAliases`) and writing every
// edit to every one of them.
//
// What is not shown cannot be disturbed. An icon's own words — the ones the
// rest of the selection does not have — are never on screen and never
// touched: adding a tag to twelve icons must not strip the eleven words only
// one of them had. `applyAliasEdit` is that rule, and it is the domain's.
//
// STATE. The fields are a draft, seeded from the selection and living until
// the selection moves. Nothing resets them from the outside: the page gives
// this component a `key` made of the keys it is about, so choosing other icons
// is a REMOUNT and the draft goes with the icons it belonged to. An effect
// syncing props into state would be the same thing, one render later and with
// a stale frame in front of you.
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

export interface IconLabelEdit {
  key: string;
  title: string;
  aliases: string[];
}

export interface IconLabelsGroupProps {
  /** The icons being named — one, or the whole selection. Never empty. */
  icons: IconAsset[];
  /**
   * Store what changed, for every icon it changed on. One call rather than
   * one per icon, so the set is re-read once at the end rather than after
   * each of twelve writes.
   */
  onSave: (edits: IconLabelEdit[]) => void;
}

export function IconLabelsGroup({ icons, onSave }: IconLabelsGroupProps) {
  const single = icons.length === 1 ? icons[0] : null;

  // What was on screen when the editing began, and what it says now. `base` is
  // read once at mount — the component is remounted when the selection moves —
  // so a row's POSITION in it stays the anchor an edit is matched against.
  const [base] = useState(() => commonIconAliases(icons.map((i) => i.aliases)));
  const [title, setTitle] = useState(single?.title ?? "");
  const [aliases, setAliases] = useState<string[]>(base);

  const save = (nextTitle: string, draft: string[]) =>
    onSave(
      icons.map((icon) => ({
        key: icon.key,
        // A name is only ever edited one icon at a time; the rest keep theirs.
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
          what its tooltip says. One icon's, so it is here only when one is
          selected; emptying it hands that icon back to its filename rather
          than leaving it nameless. */}
      {single && (
        <PropertiesPanel.Control label="Icon name">
          {/* A bare `Field.Frame` rather than a `TextInput`: `Control` IS the
              field, and a second one inside it would leave the row's visible
              label pointing at its own control instead of this one. */}
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
