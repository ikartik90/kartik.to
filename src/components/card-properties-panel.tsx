"use client";

import { useState, type Ref } from "react";
import { css } from "../../styled-system/css";
import {
  PropertiesPanel,
  type PropertiesPanelHandle,
} from "@/components/ui/properties-panel";
import { Button } from "@/components/ui/button";
import { OptionList } from "@/components/ui/input/option-list";
import { SegmentedControl } from "@/components/ui/input/segmented-control";
import { Switch } from "@/components/ui/input/switch";
import { Field } from "@/components/ui/input/field";
import { Typography } from "@/components/ui/typography";
import { SITE_PATHS } from "@/data/site-paths";
import { filenameFromMediaUrl } from "@/domain/media";
import type {
  LinkCardConfig,
  LinkCardTone,
  LinkTargetKind,
} from "@/domain/link-card";
import LinkIcon from "@/assets/icons/link.svg";
import MediaIcon from "@/assets/icons/media.svg";
import TitleIcon from "@/assets/icons/title.svg";
import CrossIcon from "@/assets/icons/cross-small.svg";

// ---------------------------------------------------------------------------
// CardPropertiesPanel — everything about one card of the homepage grid that
// its toolbar cannot say in icons, in the docked inspector the collection
// editor already uses for a picture (Figma 845:7223).
//
// The same panel for every card, and deliberately so: a post, a project and a
// published demo are all cards, and giving each its own inspector would be
// three surfaces to open from one button. What differs is WHICH sections are
// on it, which is decided by what the card can actually carry — the log
// control is here only for a card that has log output to show, and the three
// link-card sections only for the card they author.
//
// A live editor, not a form. Every control commits on change and the parent
// owns the value, exactly as `MediaPropertiesPanel` does, so the card behind
// the panel is always showing what the panel says. Nothing is written to the
// database on the way through: the grid is edited as a draft and the palette's
// two exits either commit it or throw it away.
//
// Most cards will grow properties of their own here. Until they do, a card
// whose sections are all absent gets a note saying so rather than a blank
// panel, which reads as one that failed to load.
// ---------------------------------------------------------------------------

/** The two states, in the drawn order — the affirmative first, as `FITS` is. */
const LOG_VISIBILITY = [
  { value: "show", label: "Show" },
  { value: "hide", label: "Hide" },
];

/**
 * The band's tone, with the reader's own theme first.
 *
 * "Auto" is a real choice rather than the absence of one, which is why it is a
 * segment and not the empty state of a two-segment control: a post's tile
 * follows the reader and a link card is allowed to as well — an illustration
 * authored for both themes wants exactly that. The other two PIN the band, for
 * a cover that is a screenshot of one appearance and does not change when the
 * page does. See the `linkCard` recipe's `tone` variant.
 */
const TONES = [
  { value: "auto", label: "Auto" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/** The three sorts of destination, in the order the rail lists them. */
const LINK_KINDS: { value: LinkTargetKind; label: string }[] = [
  { value: "internal", label: "Internal" },
  { value: "external", label: "External" },
  { value: "document", label: "Document" },
];

/** What a card's log output can be told to do, when it has any. */
export interface CardLoggerProperty {
  /** Whether the card is currently drawn with its log panel. */
  shown: boolean;
  onShownChange: (shown: boolean) => void;
}

/** Which of the two theme slots a picture is being chosen for. */
export type CardMediaSlot = "light" | "dark";

/** The link card this panel authors — see the section comments below. */
export interface CardLinkCardProperty {
  /** The card as it currently stands, drafts and all. */
  config: LinkCardConfig;
  /**
   * The WHOLE configuration, replacing what was there.
   *
   * Not a patch, and that is what makes removing a section possible: a section
   * the author closed has to arrive as an absent key, and a merge would fall
   * through to the stored value forever. See `GridDraft.props`.
   */
  onChange: (config: LinkCardConfig) => void;
  /**
   * Asks for the media library, for one of the two theme slots.
   *
   * The rail emits the INTENT and the grid owns the dialog. It has to: this
   * panel is a portalled, fixed surface with its own outside-press dismiss, and
   * a modal opened from inside it would be a second surface fighting the first
   * for every press. Same division the collection editor makes.
   */
  onPickMedia: (slot: CardMediaSlot) => void;
  /** Asks for the document library — the same division as `onPickMedia`. */
  onPickDocument: () => void;
}

export interface CardPropertiesPanelProps {
  /**
   * The card's log output — absent when it has none.
   *
   * One optional object rather than a `supportsLogger` boolean beside a value
   * and a handler: the three are meaningless apart, and this way a card that
   * cannot log has no state to be half-specified with.
   */
  logger?: CardLoggerProperty;
  /** The card's own content — absent for every card that is not a link card. */
  linkCard?: CardLinkCardProperty;
  /** Fired once the panel has finished sliding out — see PropertiesPanel. */
  onDismiss: () => void;
  /** Handle for closing the panel from the control that opened it. */
  ref?: Ref<PropertiesPanelHandle>;
}

// Padded to the control panel's own inset, so the note sits where a first row
// of controls would — it is standing in for them.
const emptyNoteStyle = css({
  padding: "lg",
  color: "text.body",
});

/**
 * The picker row's two controls on one line: the button that opens the library,
 * and — once something is in the slot — the one that empties it.
 *
 * The name button takes the slack and truncates, so a long filename cannot push
 * the clear button off the end of a 280px rail.
 */
const pickerRowStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "2xs",
  minWidth: 0,
});

const pickerButtonStyle = css({
  flex: "1 1 auto",
  minWidth: 0,
  justifyContent: "flex-start",
  overflow: "hidden",
});

const pickerNameStyle = css({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

/** The site's own pages, listed inline — see `SiteDestination`. */
const destinationListStyle = css({
  maxHeight: "none",
  width: "token(spacing.full)",
});

export function CardPropertiesPanel({
  logger,
  linkCard,
  onDismiss,
  ref,
}: CardPropertiesPanelProps) {
  return (
    <PropertiesPanel
      ref={ref}
      ariaLabel="Card properties"
      // A modal `<dialog>` is not a press OUTSIDE this panel — it is a surface
      // standing over it, and one this panel's own controls opened. Without the
      // exemption, choosing a picture for a link card would dismiss the rail
      // you chose it from, and you would come back to a closed panel every
      // time. Matched with `closest`, so it covers everything inside the
      // dialog however deeply nested.
      ignoreSelector="dialog"
      onDismiss={onDismiss}
    >
      <PropertiesPanel.Header>Card Properties</PropertiesPanel.Header>

      {/* Always on, and headerless with it: a demo that logs HAS log output
          whether or not it is on show, so there is nothing here for a section
          header's add/remove pair to mean — `enabled` is held true and the
          header left off, the way the media panel's layout section is (Figma
          885:1963). Showing and hiding it is a VALUE, and a value belongs in a
          labelled row rather than in a section that appears and disappears. */}
      {logger && (
        <PropertiesPanel.Section enabled>
          <PropertiesPanel.ControlPanel ariaLabel="Log output">
            <PropertiesPanel.Control label="Log Output">
              <SegmentedControl
                options={LOG_VISIBILITY}
                value={logger.shown ? "show" : "hide"}
                onValueChange={(value) =>
                  logger.onShownChange(value === "show")
                }
              />
            </PropertiesPanel.Control>
          </PropertiesPanel.ControlPanel>
        </PropertiesPanel.Section>
      )}

      {linkCard && <LinkCardSections {...linkCard} />}

      {!logger && !linkCard && (
        <Typography tag="p" type="bodySmall" className={emptyNoteStyle}>
          No properties for this card yet.
        </Typography>
      )}
    </PropertiesPanel>
  );
}

/**
 * The three sections that ARE the link card: what it shows, what it says, and
 * where it goes.
 *
 * In that order because it is the order you build one in — you pick the picture
 * first and decide what to write over it second. Every one of them is a
 * `Section`, so the add/remove pair means what it means everywhere else in this
 * inspector: a closed section is a property the card does not have, and closing
 * one takes that property away rather than hiding it.
 */
function LinkCardSections({
  config,
  onChange,
  onPickMedia,
  onPickDocument,
}: CardLinkCardProperty) {
  const { media, content, link } = config;

  /** Rewrite one section, leaving the other two exactly as they were. */
  const set = (patch: Partial<LinkCardConfig>) => onChange({ ...config, ...patch });

  /** Drop one section — an absent key, which is what a closed section is. */
  const clear = (key: keyof LinkCardConfig) => {
    const next = { ...config };
    delete next[key];
    onChange(next);
  };

  return (
    <>
      <PropertiesPanel.Section
        defaultEnabled={media !== undefined}
        onEnabledChange={(enabled) =>
          enabled ? set({ media: {} }) : clear("media")
        }
      >
        <PropertiesPanel.SectionHeader icon={<MediaIcon aria-hidden />}>
          Media
        </PropertiesPanel.SectionHeader>
        <PropertiesPanel.ControlPanel>
          {/* Two slots rather than one picture and a filter, because the case
              this exists for is a SCREENSHOT: the card is a window onto
              something that has its own light and dark appearance, and no
              amount of inversion turns one into the other. One of them on its
              own is a complete card — see `LinkCardMediaSchema`. */}
          {(["light", "dark"] as const).map((slot) => (
            <PropertiesPanel.Control
              key={slot}
              label={slot === "light" ? "Light" : "Dark"}
            >
              <FilePicker
                noun={`${slot} media`}
                filename={fileLabel(media?.[slot]?.src)}
                onPick={() => onPickMedia(slot)}
                onClear={() => set({ media: { ...media, [slot]: undefined } })}
              />
            </PropertiesPanel.Control>
          ))}
        </PropertiesPanel.ControlPanel>
      </PropertiesPanel.Section>

      <PropertiesPanel.Section
        defaultEnabled={content !== undefined}
        onEnabledChange={(enabled) =>
          enabled ? set({ content: {} }) : clear("content")
        }
      >
        <PropertiesPanel.SectionHeader icon={<TitleIcon aria-hidden />}>
          Content
        </PropertiesPanel.SectionHeader>
        <PropertiesPanel.ControlPanel>
          <ContentControls
            content={content ?? {}}
            onChange={(next) => set({ content: next })}
          />
        </PropertiesPanel.ControlPanel>
      </PropertiesPanel.Section>

      <PropertiesPanel.Section
        defaultEnabled={link !== undefined}
        onEnabledChange={(enabled) =>
          // Internal is where a link starts, because that is what this card was
          // added for: the pages with no card of their own. The destination
          // itself stays unset — you choose the SORT of link first and then go
          // and find it (see `LinkCardLinkSchema`).
          enabled ? set({ link: { kind: "internal" } }) : clear("link")
        }
      >
        <PropertiesPanel.SectionHeader icon={<LinkIcon aria-hidden />}>
          Link
        </PropertiesPanel.SectionHeader>
        <PropertiesPanel.ControlPanel>
          <LinkControls
            link={link ?? { kind: "internal" }}
            onChange={(next) => set({ link: next })}
            onPickDocument={onPickDocument}
          />
        </PropertiesPanel.ControlPanel>
      </PropertiesPanel.Section>
    </>
  );
}

/** The words on the card, and the band they stand on. */
function ContentControls({
  content,
  onChange,
}: {
  content: NonNullable<LinkCardConfig["content"]>;
  onChange: (content: NonNullable<LinkCardConfig["content"]>) => void;
}) {
  // Drafts, for the reason the media panel's caption keeps one: what is STORED
  // is not what is typed. The words are trimmed on the way out and an empty one
  // is dropped entirely, so a field derived from the stored value would swallow
  // the space between two words and refuse to hold a title you were halfway
  // through clearing.
  const [titleDraft, setTitleDraft] = useState(content.title ?? "");
  const [metaDraft, setMetaDraft] = useState(content.meta ?? "");

  const write = (patch: Partial<typeof content>) => {
    const next = { ...content, ...patch };
    // An emptied field is an ABSENT field, not an empty string: absent is what
    // `LinkCard` reads to decide there is no caption to draw at all.
    for (const key of ["title", "meta"] as const) {
      if (!next[key]) delete next[key];
    }
    onChange(next);
  };

  return (
    <>
      {/* Above the title in the panel because it is above the title on the
          card — a rail whose rows ran the other way round from the tile behind
          it would be describing a different card. */}
      <PropertiesPanel.Control label="Meta">
        {/* A bare `Field.Frame` and not a `TextInput`, which is the whole
            reason the compound primitives exist: `Control` IS the field, and a
            TextInput would open a second one inside it — its own label id, its
            own control id — leaving the row's visible label pointing at
            nothing. Every other control in this inspector composes the same
            way. */}
        <Field.Frame>
          <Field.Control
            value={metaDraft}
            placeholder="Playground"
            onChange={(event) => {
              setMetaDraft(event.target.value);
              write({ meta: event.target.value.trim() || undefined });
            }}
          />
        </Field.Frame>
      </PropertiesPanel.Control>

      <PropertiesPanel.Control label="Title">
        <Field.Frame>
          <Field.Control
            value={titleDraft}
            placeholder="Shader Playground"
            onChange={(event) => {
              setTitleDraft(event.target.value);
              write({ title: event.target.value.trim() || undefined });
            }}
          />
        </Field.Frame>
      </PropertiesPanel.Control>

      {/* The frosting and the wash under the words. A value rather than a
          section of its own, because a card can legitimately want words with no
          scrim — over a picture that is already flat where the caption sits —
          and "no scrim" and "no words" are different cards. */}
      <PropertiesPanel.Control label="Scrim">
        <Switch
          size="sm"
          checked={content.scrim ?? false}
          onCheckedChange={(scrim) =>
            write({ scrim: scrim ? true : undefined })
          }
        />
      </PropertiesPanel.Control>

      {/* Applies whether or not the scrim is drawn: it pins the caption's INK
          as well as the wash's colour, and the words are the half that has to
          stay legible over a picture with a fixed appearance. */}
      <PropertiesPanel.Control label="Mode">
        <SegmentedControl
          options={TONES}
          value={content.tone ?? "auto"}
          onValueChange={(value) =>
            write({
              tone: value === "auto" ? undefined : (value as LinkCardTone),
            })
          }
        />
      </PropertiesPanel.Control>
    </>
  );
}

/** Where the card goes, and how it opens. */
function LinkControls({
  link,
  onChange,
  onPickDocument,
}: {
  link: NonNullable<LinkCardConfig["link"]>;
  onChange: (link: NonNullable<LinkCardConfig["link"]>) => void;
  onPickDocument: () => void;
}) {
  const [urlDraft, setUrlDraft] = useState(
    link.kind === "external" ? link.href ?? "" : "",
  );

  return (
    <>
      <PropertiesPanel.Control label="Type">
        <SegmentedControl
          options={LINK_KINDS}
          value={link.kind}
          onValueChange={(value) => {
            setUrlDraft("");
            // The destination goes with the kind. A URL is not a path, and
            // carrying one across would leave the card pointing somewhere the
            // control now on screen cannot even display. `newTab` survives: it
            // is a fact about the CARD, not about the destination.
            onChange({ kind: value as LinkTargetKind, newTab: link.newTab });
          }}
        />
      </PropertiesPanel.Control>

      {link.kind === "internal" && (
        <SiteDestination
          href={link.href}
          onChange={(href) => onChange({ ...link, kind: "internal", href })}
        />
      )}

      {link.kind === "external" && (
        <PropertiesPanel.Control label="URL">
          <Field.Frame>
            <Field.Control
              type="url"
              inputMode="url"
              value={urlDraft}
              placeholder="https://example.com"
              onChange={(event) => {
                setUrlDraft(event.target.value);
                onChange({
                  ...link,
                  kind: "external",
                  href: event.target.value.trim() || undefined,
                });
              }}
            />
          </Field.Frame>
        </PropertiesPanel.Control>
      )}

      {link.kind === "document" && (
        <PropertiesPanel.Control label="File">
          <FilePicker
            noun="document"
            filename={fileLabel(link.href)}
            onPick={onPickDocument}
            onClear={() =>
              onChange({ ...link, kind: "document", href: undefined })
            }
          />
        </PropertiesPanel.Control>
      )}

      <PropertiesPanel.Control label="New Tab">
        <Switch
          size="sm"
          checked={link.newTab ?? false}
          onCheckedChange={(newTab) =>
            onChange({ ...link, newTab: newTab ? true : undefined })
          }
        />
      </PropertiesPanel.Control>
    </>
  );
}

/**
 * The site's own pages, listed INLINE rather than behind a select.
 *
 * A Combobox is the control this would otherwise be, and it cannot go here: its
 * popover is portalled to escape the rail's `overflow: auto`, and CSS anchor
 * positioning refuses an anchor whose containing-block chain does not reach the
 * portal's — which a `position: fixed` rail's does not. Left un-portalled it is
 * cropped at the rail's edge instead. Both failure modes are documented on
 * `ComboboxProps.portal`; between them there is no configuration that works
 * inside this panel.
 *
 * An inline list is the honest alternative and costs nothing here, because the
 * list is SHORT by construction: `SITE_PATHS` holds the pages that have no card
 * of their own, and every article and project is excluded precisely because it
 * already has one.
 */
function SiteDestination({
  href,
  onChange,
}: {
  href: string | undefined;
  onChange: (href: string) => void;
}) {
  return (
    <PropertiesPanel.Control label="Page">
      <OptionList
        value={href ?? null}
        onValueChange={onChange}
        tone="plain"
        className={destinationListStyle}
      >
        <OptionList.Listbox aria-label="Page">
          {SITE_PATHS.map((page) => (
            <OptionList.Option key={page.path} value={page.path}>
              {page.label}
            </OptionList.Option>
          ))}
        </OptionList.Listbox>
      </OptionList>
    </PropertiesPanel.Control>
  );
}

/**
 * One slot holding a file from the library: press it to choose, press the cross
 * to empty it.
 *
 * TWO buttons and not one, because the two acts are genuinely different and the
 * card behind the rail shows it: replacing a picture leaves a card with a
 * picture, and clearing one leaves a card without. A single control that cycled
 * between them would make emptying a slot a thing you discover.
 *
 * The label says WHICH slot ("Add dark media", "Change document") rather than
 * relying on the row's label to name it, because a button is not labelable by a
 * `<label>` — the field's own text names nothing here, so the only accessible
 * name is the one written on.
 */
function FilePicker({
  noun,
  filename,
  onPick,
  onClear,
}: {
  /** Names this slot in the controls' labels — "light media", "document". */
  noun: string;
  /** What is in the slot, or `undefined` for an empty one. */
  filename: string | undefined;
  onPick: () => void;
  onClear: () => void;
}) {
  return (
    <div className={pickerRowStyle}>
      <Button
        type="button"
        size="sm"
        emphasis="tertiary"
        aria-label={`${filename ? "Change" : "Add"} ${noun}`}
        className={pickerButtonStyle}
        onClick={onPick}
      >
        <Button.Text className={pickerNameStyle}>
          {filename ?? `Add ${noun}`}
        </Button.Text>
      </Button>
      {filename && (
        <Button
          type="button"
          size="sm"
          variant="icon"
          emphasis="tertiary"
          aria-label={`Remove ${noun}`}
          onClick={onClear}
        >
          <CrossIcon aria-hidden />
        </Button>
      )}
    </div>
  );
}

/**
 * What to call the file in a slot — the name it was uploaded under, never the
 * URL it is stored as.
 *
 * `undefined` in, `undefined` out, so "the slot is empty" travels as one value
 * through the picker rather than being asked twice.
 */
function fileLabel(src: string | undefined): string | undefined {
  return src ? filenameFromMediaUrl(src) : undefined;
}
