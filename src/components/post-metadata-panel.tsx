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

const COMMIT_DELAY_MS = 400;

/** Past this, categories render as an inline list: a Combobox cannot open inside this rail. */
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
      {/* Keyed per post: the sections and the slug box read their values once, at mount. */}
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

/** Keeps its own draft, committed after a typing pause once the address is found free. */
function SlugControl({
  slug,
  draftId,
  mintedFrom,
  onCommit,
}: {
  slug: string | null;
  draftId: string | null;
  /** The title a draft without an address mints one from. */
  mintedFrom: string;
  onCommit: (slug: string) => void;
}) {
  const [draft, setDraft] = useState(slug ?? "");
  const [invalid, setInvalid] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tags each check so a stale answer never lands on a newer address.
  const typed = useRef(0);

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
