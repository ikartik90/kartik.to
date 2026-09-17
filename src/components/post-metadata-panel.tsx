"use client";

import { useEffect, useRef, useState, type Ref } from "react";
import { css } from "../../styled-system/css";
import {
  PropertiesPanel,
  type PropertiesPanelHandle,
} from "@/components/ui/properties-panel";
import { Field } from "@/components/ui/input/field";
import { OptionList } from "@/components/ui/input/option-list";
import { SegmentedControl } from "@/components/ui/input/segmented-control";
import { isPostSlugAvailable } from "@/app/actions/post";
import { LISTED_CATEGORIES, POST_CATEGORIES } from "@/data/post-categories";
import {
  POST_DESCRIPTION_MAX_LENGTH,
  PostSlugSchema,
  type PostCategory,
} from "@/domain/post";
import { useEditorStore } from "@/store/editor";
import { postSummary } from "@/utils/post-summary";
import { generateSlug } from "@/utils/slug";
import SearchIcon from "@/assets/icons/search.svg";

// ---------------------------------------------------------------------------
// The open post's metadata, in the docked inspector every other editor uses:
// the category it is filed under, its address, and what it says about itself
// to search engines.
//
// A VIEW of the editor store, not a form. Every change goes into the same
// buffer as the words, so ⌘S and Publish write it with them and Discard throws
// it away with them — the panel has no apply step and no copy of its own,
// except for the one field where every intermediate state is invalid.
//
// That field is the slug. An address is typed a character at a time, and most
// of the way there it is either malformed or someone else's, so the box holds
// what is being typed and offers it to the store only once the typing has
// paused and the address has been found free. One that is not is kept out of
// the buffer and marked invalid for assistive technology, with no message
// beside the box — the post keeps the address it had.
//
// A page (the homepage, About) has no address to change — it is read at a
// route of its own rather than at a prefix and a slug — so it is offered its
// description and nothing else.
// ---------------------------------------------------------------------------

/**
 * How long a pause counts as "done typing" — the testimonial rail's 400ms, and
 * for the same two jobs: when the address is judged, and when it is taken.
 */
const COMMIT_DELAY_MS = 400;

/**
 * How many categories a segmented control can hold before it stops reading as
 * one. Past it the choice is drawn as the inline list the card panel uses for
 * its destinations — a Combobox cannot open inside this rail (see
 * `SiteDestination` in `card-properties-panel.tsx`).
 */
const MAX_SEGMENTS = 3;

const categoryListStyle = css({
  maxHeight: "none",
  width: "token(spacing.full)",
});

const CATEGORY_OPTIONS = LISTED_CATEGORIES.map((category) => ({
  value: category,
  label: POST_CATEGORIES[category].label,
}));

export interface PostMetadataPanelProps {
  onDismiss: () => void;
  ref?: Ref<PropertiesPanelHandle>;
}

export function PostMetadataPanel({ onDismiss, ref }: PostMetadataPanelProps) {
  const draftId = useEditorStore((state) => state.draftId);
  return (
    <PropertiesPanel ref={ref} ariaLabel="Metadata" onDismiss={onDismiss}>
      <PropertiesPanel.Header>Metadata</PropertiesPanel.Header>
      {/* Remounted per post. What the sections open on and what the slug box
          holds are read once, at mount, so they are read again whenever the
          buffer becomes a different post — the editor reading one in, or a
          new draft's first save giving it an id and a minted address — and
          never carried from one post to the next. */}
      <MetadataContents key={draftId ?? "new"} />
    </PropertiesPanel>
  );
}

function MetadataContents() {
  const category = useEditorStore((state) => state.category);
  const slug = useEditorStore((state) => state.slug);
  const draftId = useEditorStore((state) => state.draftId);
  const title = useEditorStore((state) => state.title);
  const description = useEditorStore((state) => state.description);
  const document = useEditorStore((state) => state.document);
  const setCategory = useEditorStore((state) => state.setCategory);
  const setSlug = useEditorStore((state) => state.setSlug);
  const setDescription = useEditorStore((state) => state.setDescription);

  const movable = POST_CATEGORIES[category].listed;

  return (
    <>
      {/* Always on and headerless: every post HAS a category and an address,
          so there is nothing to add or remove — the panel's idiom for a group
          of properties a thing simply has. */}
      {movable && (
        <PropertiesPanel.Section enabled>
          <PropertiesPanel.ControlPanel ariaLabel="Address">
            <PropertiesPanel.Control label="Category">
              <CategoryControl value={category} onChange={setCategory} />
            </PropertiesPanel.Control>
            <SlugControl
              slug={slug}
              draftId={draftId}
              mintedFrom={title}
              onCommit={setSlug}
            />
          </PropertiesPanel.ControlPanel>
        </PropertiesPanel.Section>
      )}

      {/* A section, because a written description is an OVERRIDE: absent is
          the ordinary state, where the page is described by its own opening.
          Removing the section is how the override is taken away, so there is
          no separate "clear". Opening it changes nothing until something is
          typed — the placeholder is the line the page says now. */}
      <PropertiesPanel.Section
        defaultEnabled={description !== null}
        onEnabledChange={(enabled) => {
          if (!enabled && description !== null) setDescription(null);
        }}
      >
        <PropertiesPanel.SectionHeader icon={<SearchIcon aria-hidden />}>
          Description
        </PropertiesPanel.SectionHeader>
        <PropertiesPanel.ControlPanel>
          <PropertiesPanel.Text
            ariaLabel="Description"
            value={description ?? ""}
            placeholder={
              postSummary(document) ?? "What search results say about it…"
            }
            maxLength={POST_DESCRIPTION_MAX_LENGTH}
            rows={4}
            onValueChange={setDescription}
          />
        </PropertiesPanel.ControlPanel>
      </PropertiesPanel.Section>
    </>
  );
}

/**
 * Which category the post is filed under — a segmented control while the
 * categories fit one, an inline list once they do not.
 */
function CategoryControl({
  value,
  onChange,
}: {
  value: PostCategory;
  onChange: (category: PostCategory) => void;
}) {
  const choose = (next: string) => {
    if (next !== value) onChange(next as PostCategory);
  };

  if (CATEGORY_OPTIONS.length <= MAX_SEGMENTS) {
    return (
      <SegmentedControl
        options={CATEGORY_OPTIONS}
        value={value}
        onValueChange={choose}
      />
    );
  }

  return (
    <OptionList
      value={value}
      onValueChange={choose}
      tone="plain"
      className={categoryListStyle}
    >
      <OptionList.Listbox aria-label="Category">
        {CATEGORY_OPTIONS.map((option) => (
          <OptionList.Option key={option.value} value={option.value}>
            {option.label}
          </OptionList.Option>
        ))}
      </OptionList.Listbox>
    </OptionList>
  );
}

/**
 * The post's address. See the note at the top for why this one field keeps a
 * draft of its own.
 */
function SlugControl({
  slug,
  draftId,
  mintedFrom,
  onCommit,
}: {
  /** The address in the buffer — null for a draft that has none yet. */
  slug: string | null;
  draftId: string | null;
  /** The title a draft with no address will have one minted from. */
  mintedFrom: string;
  onCommit: (slug: string) => void;
}) {
  const [draft, setDraft] = useState(slug ?? "");
  const [invalid, setInvalid] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Which keystroke an answer belongs to. The availability check is a round
  // trip, and an answer for an address that has since been typed over must not
  // land on top of the address that replaced it.
  const typed = useRef(0);

  // A pause still running when the panel closes would otherwise commit an
  // address to a buffer nobody is looking at.
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
      typed.current += 1;
    },
    [],
  );

  const type = (value: string) => {
    setDraft(value);
    if (timer.current !== null) clearTimeout(timer.current);
    const turn = ++typed.current;

    timer.current = setTimeout(async () => {
      timer.current = null;

      // A draft that has never been saved may leave its address to the title.
      if (value.trim() === "" && slug === null) {
        setInvalid(false);
        return;
      }

      const parsed = PostSlugSchema.safeParse(value);
      if (!parsed.success) {
        setInvalid(true);
        return;
      }
      if (parsed.data === slug) {
        setInvalid(false);
        return;
      }

      const free = await isPostSlugAvailable(parsed.data, draftId);
      if (turn !== typed.current) return;
      setInvalid(!free);
      if (free) onCommit(parsed.data);
    }, COMMIT_DELAY_MS);
  };

  return (
    <PropertiesPanel.Control label="Slug">
      <Field.Frame>
        <Field.Control
          value={draft}
          placeholder={mintedFrom.trim() ? generateSlug(mintedFrom) : undefined}
          spellCheck={false}
          autoCapitalize="none"
          autoComplete="off"
          aria-invalid={invalid || undefined}
          onChange={(event) => type(event.target.value)}
        />
      </Field.Frame>
    </PropertiesPanel.Control>
  );
}
