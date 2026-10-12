"use client";

import { useState, type Ref } from "react";
import { css } from "../../styled-system/css";
import {
  PropertiesPanel,
  type PropertiesPanelHandle,
} from "@/components/ui/properties-panel";
import { OptionList } from "@/components/ui/input/option-list";
import { SegmentedControl } from "@/components/ui/input/segmented-control";
import { Switch } from "@/components/ui/input/switch";
import { Field } from "@/components/ui/input/field";
import { ImageInput } from "@/components/ui/input/image-input";
import { Typography } from "@/components/ui/typography";
import { SHADER_SPECS } from "@/data/shader-specs";
import { SITE_PATHS, shaderPresetPath } from "@/data/site-paths";
import type {
  LinkCardConfig,
  LinkCardMedia,
  LinkCardTone,
  LinkTargetKind,
} from "@/domain/link-card";
import type { MediaNode } from "@/domain/nodes";
import { postCardMedia, type PostCardConfig } from "@/domain/post";
import type { ShownShaderPreset } from "@/domain/shader-preset";
import LinkIcon from "@/assets/icons/link.svg";
import MediaIcon from "@/assets/icons/media.svg";
import TitleIcon from "@/assets/icons/title.svg";

const LOG_VISIBILITY = [
  { value: "show", label: "Show" },
  { value: "hide", label: "Hide" },
];

/** "Auto" follows the reader's theme; the other two pin the band. */
const TONES = [
  { value: "auto", label: "Auto" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const LINK_KINDS: { value: LinkTargetKind; label: string }[] = [
  { value: "internal", label: "Internal" },
  { value: "external", label: "External" },
  { value: "document", label: "Document" },
];

const COVER_SOURCES = [
  { value: "files", label: "Files" },
  { value: "shader", label: "Shader" },
];

interface Choice {
  value: string;
  label: string;
}

const presetChoice = (preset: ShownShaderPreset, value: string): Choice => ({
  value,
  label: `${SHADER_SPECS[preset.shaderId].label} · ${preset.name}`,
});

export interface CardLoggerProperty {
  shown: boolean;
  onShownChange: (shown: boolean) => void;
}

export type CardMediaSlot = "light" | "dark";

export interface CardLinkCardProperty {
  config: LinkCardConfig;
  /** The whole configuration, not a patch: a closed section must arrive as an absent key. */
  onChange: (config: LinkCardConfig) => void;
  /** The grid owns the dialog: a modal opened inside this portalled panel would fight it for presses. */
  onPickMedia: (slot: CardMediaSlot) => void;
  onPickDocument: () => void;
  /** Published presets, offered as the cover and as destinations. */
  shaderPresets?: ShownShaderPreset[];
}

export interface CardPostCardProperty {
  config: PostCardConfig;
  /** The document's picture, which the Media section starts from when opened. */
  cover: MediaNode | null;
  /** The post's own meta line; when set, no Meta row is offered, since the post's line wins on the card. */
  meta: string | null;
  /** The whole configuration, not a patch. */
  onChange: (config: PostCardConfig) => void;
  onPickMedia: (slot: CardMediaSlot) => void;
}

export interface CardPropertiesPanelProps {
  logger?: CardLoggerProperty;
  linkCard?: CardLinkCardProperty;
  postCard?: CardPostCardProperty;
  /** Fired once the panel has finished sliding out. */
  onDismiss: () => void;
  ref?: Ref<PropertiesPanelHandle>;
}

const emptyNoteStyle = css({
  padding: "lg",
  color: "text.body",
});

function slotFile(node: MediaNode | undefined) {
  if (!node) return {};
  return {
    src: node.src,
    kind: node.kind,
    ...(node.kind === "video" && node.poster ? { poster: node.poster } : {}),
  };
}

const inlineListStyle = css({
  maxHeight: "none",
  width: "token(spacing.full)",
});

export function CardPropertiesPanel({
  logger,
  linkCard,
  postCard,
  onDismiss,
  ref,
}: CardPropertiesPanelProps) {
  return (
    <PropertiesPanel
      ref={ref}
      ariaLabel="Card properties"
      // A modal the panel opened is not an outside press, or picking a picture would close the rail.
      ignoreSelector="dialog"
      onDismiss={onDismiss}
    >
      <PropertiesPanel.Header>Card Properties</PropertiesPanel.Header>

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

      {postCard && <PostCardSections {...postCard} />}

      {!logger && !linkCard && !postCard && (
        <Typography tag="p" type="bodySmall" className={emptyNoteStyle}>
          No properties for this card yet.
        </Typography>
      )}
    </PropertiesPanel>
  );
}

function LinkCardSections({
  config,
  onChange,
  onPickMedia,
  onPickDocument,
  shaderPresets = [],
}: CardLinkCardProperty) {
  const { media, content, link } = config;

  const set = (patch: Partial<LinkCardConfig>) => onChange({ ...config, ...patch });

  const clear = (key: keyof LinkCardConfig) => {
    const next = { ...config };
    delete next[key];
    onChange(next);
  };

  const setShader = (shader: string | undefined) => {
    const next = { ...media, shader };
    if (!shader) delete next.shader;
    set({ media: next });
  };

  return (
    <>
      <MediaSection
        media={media}
        onEnabledChange={(enabled) =>
          enabled ? set({ media: {} }) : clear("media")
        }
        onPickMedia={onPickMedia}
        shader={
          shaderPresets.length > 0
            ? {
                choices: shaderPresets.map((preset) =>
                  presetChoice(preset, preset.id),
                ),
                value: media?.shader,
                onChange: setShader,
              }
            : undefined
        }
      />

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
            pictured={Boolean(media?.light || media?.dark || media?.shader)}
            onChange={(next) => set({ content: next })}
          />
        </PropertiesPanel.ControlPanel>
      </PropertiesPanel.Section>

      <PropertiesPanel.Section
        defaultEnabled={link !== undefined}
        onEnabledChange={(enabled) =>
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
            pages={[
              ...SITE_PATHS.map((page) => ({ value: page.path, label: page.label })),
              ...shaderPresets.map((preset) =>
                presetChoice(preset, shaderPresetPath(preset.id)),
              ),
            ]}
          />
        </PropertiesPanel.ControlPanel>
      </PropertiesPanel.Section>
    </>
  );
}

function ContentControls({
  content,
  pictured,
  onChange,
}: {
  content: NonNullable<LinkCardConfig["content"]>;
  pictured: boolean;
  onChange: (content: NonNullable<LinkCardConfig["content"]>) => void;
}) {
  const write = (patch: Partial<typeof content>) => {
    const next = { ...content, ...patch };
    // Emptied fields are removed: `LinkCard` reads an absent key as no caption.
    for (const key of ["title", "meta"] as const) {
      if (!next[key]) delete next[key];
    }
    onChange(next);
  };

  return (
    <>
      <TextControl
        label="Meta"
        placeholder="Playground"
        value={content.meta}
        onChange={(meta) => write({ meta })}
      />

      <TextControl
        label="Title"
        placeholder="Shader Playground"
        value={content.title}
        onChange={(title) => write({ title })}
      />

      <GroundControls value={content} pictured={pictured} onChange={write} />
    </>
  );
}

/** Keeps a draft, since the stored value is trimmed; an emptied field reports `undefined`, never "". */
function TextControl({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}) {
  const [draft, setDraft] = useState(value ?? "");

  return (
    <PropertiesPanel.Control label={label}>
      {/* A bare `Field.Frame`, not `TextInput`, which would nest a second field and orphan the row's label. */}
      <Field.Frame>
        <Field.Control
          value={draft}
          placeholder={placeholder}
          onChange={(event) => {
            setDraft(event.target.value);
            onChange(event.target.value.trim() || undefined);
          }}
        />
      </Field.Frame>
    </PropertiesPanel.Control>
  );
}

interface Ground {
  scrim?: boolean;
  tone?: LinkCardTone;
}

/** Shows what the card draws, not what is stored; a press always writes true or false, never absent. */
function GroundControls({
  value,
  pictured,
  onChange,
}: {
  value: Ground;
  pictured: boolean;
  onChange: (patch: Ground) => void;
}) {
  return (
    <>
      <PropertiesPanel.Control label="Scrim">
        <Switch
          size="sm"
          checked={value.scrim ?? pictured}
          onCheckedChange={(scrim) => onChange({ scrim })}
        />
      </PropertiesPanel.Control>

      <PropertiesPanel.Control label="Mode">
        <SegmentedControl
          options={TONES}
          value={value.tone ?? "auto"}
          onValueChange={(tone) =>
            onChange({
              tone: tone === "auto" ? undefined : (tone as LinkCardTone),
            })
          }
        />
      </PropertiesPanel.Control>
    </>
  );
}

interface ShaderCoverControl {
  choices: Choice[];
  /** The preset playing; absent plays the pictures. */
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}

function MediaSection({
  media,
  onEnabledChange,
  onPickMedia,
  shader,
}: {
  media: LinkCardMedia | undefined;
  /** Closing the section is also what removes a picture; the slots only swap files. */
  onEnabledChange: (enabled: boolean) => void;
  onPickMedia: (slot: CardMediaSlot) => void;
  /** Absent offers the pictures alone. */
  shader?: ShaderCoverControl;
}) {
  return (
    <PropertiesPanel.Section
      defaultEnabled={media !== undefined}
      onEnabledChange={onEnabledChange}
    >
      <PropertiesPanel.SectionHeader icon={<MediaIcon aria-hidden />}>
        Media
      </PropertiesPanel.SectionHeader>
      <PropertiesPanel.ControlPanel>
        <MediaControls media={media} onPickMedia={onPickMedia} shader={shader} />
      </PropertiesPanel.ControlPanel>
    </PropertiesPanel.Section>
  );
}

/** Mounted with the open section, so a reopened one starts back on the files. */
function MediaControls({
  media,
  onPickMedia,
  shader,
}: {
  media: LinkCardMedia | undefined;
  onPickMedia: (slot: CardMediaSlot) => void;
  shader?: ShaderCoverControl;
}) {
  // Local: "Shader" with no preset picked yet stores nothing.
  const [source, setSource] = useState(shader?.value ? "shader" : "files");

  return (
    <>
      {shader && (
        <PropertiesPanel.Control label="Source">
          <SegmentedControl
            options={COVER_SOURCES}
            value={source}
            onValueChange={(next) => {
              setSource(next);
              if (next === "files" && shader.value) shader.onChange(undefined);
            }}
          />
        </PropertiesPanel.Control>
      )}

      {shader && source === "shader" ? (
        <InlineChoices
          label="Preset"
          choices={shader.choices}
          value={shader.value}
          onChange={shader.onChange}
        />
      ) : (
        (["light", "dark"] as const).map((slot) => (
          <PropertiesPanel.Control
            key={slot}
            label={slot === "light" ? "Light" : "Dark"}
          >
            <ImageInput
              noun={`${slot} media`}
              {...slotFile(media?.[slot])}
              onPick={() => onPickMedia(slot)}
            />
          </PropertiesPanel.Control>
        ))
      )}
    </>
  );
}

function PostCardSections({
  config,
  cover,
  meta,
  onChange,
  onPickMedia,
}: CardPostCardProperty) {
  const set = (patch: Partial<PostCardConfig>) =>
    onChange({ ...config, ...patch });

  const write = (patch: Partial<PostCardConfig>) => {
    const next = { ...config, ...patch };
    if (!next.meta) delete next.meta;
    onChange(next);
  };

  const shown = postCardMedia(config, cover);

  return (
    <>
      <MediaSection
        media={config.media}
        onEnabledChange={(enabled) => {
          if (enabled) {
            set({ media: cover ? { light: cover } : {} });
            return;
          }
          const next = { ...config };
          delete next.media;
          onChange(next);
        }}
        onPickMedia={onPickMedia}
      />

      <PropertiesPanel.Section enabled>
        <PropertiesPanel.ControlPanel ariaLabel="Content">
          {meta === null && (
            <TextControl
              label="Meta"
              placeholder="Case Study"
              value={config.meta}
              onChange={(next) => write({ meta: next })}
            />
          )}

          <GroundControls
            value={config}
            pictured={Boolean(shown.light || shown.dark)}
            onChange={set}
          />
        </PropertiesPanel.ControlPanel>
      </PropertiesPanel.Section>
    </>
  );
}

function LinkControls({
  link,
  onChange,
  onPickDocument,
  pages,
}: {
  link: NonNullable<LinkCardConfig["link"]>;
  onChange: (link: NonNullable<LinkCardConfig["link"]>) => void;
  onPickDocument: () => void;
  /** The internal destinations, by path. */
  pages: Choice[];
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
            // The destination resets with the kind; `newTab` belongs to the card and survives.
            onChange({ kind: value as LinkTargetKind, newTab: link.newTab });
          }}
        />
      </PropertiesPanel.Control>

      {link.kind === "internal" && (
        <InlineChoices
          label="Page"
          choices={pages}
          value={link.href}
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
          <ImageInput
            noun="document"
            kind="document"
            src={link.href}
            onPick={onPickDocument}
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

/** Listed inline: a Combobox cannot work inside this fixed rail (see `ComboboxProps.portal`). */
function InlineChoices({
  label,
  choices,
  value,
  onChange,
}: {
  label: string;
  choices: Choice[];
  value: string | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <PropertiesPanel.Control label={label}>
      <OptionList
        value={value ?? null}
        onValueChange={onChange}
        tone="plain"
        className={inlineListStyle}
      >
        <OptionList.Listbox aria-label={label}>
          {choices.map((choice) => (
            <OptionList.Option key={choice.value} value={choice.value}>
              {choice.label}
            </OptionList.Option>
          ))}
        </OptionList.Listbox>
      </OptionList>
    </PropertiesPanel.Control>
  );
}
