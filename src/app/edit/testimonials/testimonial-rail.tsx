"use client";

import { useCallback, useEffect, useRef, useState, type Ref } from "react";
import { css } from "../../../../styled-system/css";
import {
  PropertiesPanel,
  type PropertiesPanelHandle,
} from "@/components/ui/properties-panel";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input/field";
import { ImageInput } from "@/components/ui/input/image-input";
import { Link } from "@/components/ui/link";
import { Notice } from "@/components/ui/notice";
import { Tooltip } from "@/components/ui/tooltip";
import {
  LinkedInProfileUrlSchema,
  TESTIMONIAL_EXCERPT_NOT_THEIRS,
  isExcerptOfQuote,
  type Testimonial,
} from "@/domain/testimonial";
import LinkedInIcon from "@/assets/icons/linkedin.svg";
import QuoteIcon from "@/assets/icons/quote.svg";
import MediaIcon from "@/assets/icons/media.svg";
import PublishIcon from "@/assets/icons/publish.svg";
import UnpublishIcon from "@/assets/icons/unpublish.svg";

const COMMIT_DELAY_MS = 400;

const problemStyle = css({ paddingInline: "xl", paddingBlock: "md" });

const proseHintStyle = css({
  textStyle: "fineprint",
  color: "text.body/50",
  margin: "none",
});

export interface TestimonialRailProps {
  testimonial: Testimonial;
  onPickPicture: () => void;
  onClearPicture: () => void;
  onProfileChange: (linkedinUrl: string | null) => void;
  /** Null shows the whole quote. */
  onExcerptChange: (excerpt: string | null) => void;
  onNameChange: (name: string) => void;
  onTaglineChange: (tagline: string | null) => void;
  onPublishedChange: (published: boolean) => void;
  problem: string | null;
  onDismiss: () => void;
  ref?: Ref<PropertiesPanelHandle>;
}

/** The key goes on the contents, not the panel: keying the panel re-slides the rail on every selection. */
export function TestimonialRail({
  testimonial,
  problem,
  onDismiss,
  ref,
  ...row
}: TestimonialRailProps) {
  return (
    <PropertiesPanel
      ref={ref}
      ariaLabel={`Details for ${testimonial.name}'s testimonial`}
      // The portalled media-library dialog must not count as an outside press.
      ignoreSelector="dialog"
      onDismiss={onDismiss}
    >
      <RailContents
        key={testimonial.id}
        testimonial={testimonial}
        problem={problem}
        {...row}
      />
    </PropertiesPanel>
  );
}

type RailContentsProps = Omit<TestimonialRailProps, "onDismiss" | "ref">;

function RailContents({
  testimonial,
  onPickPicture,
  onClearPicture,
  onProfileChange,
  onExcerptChange,
  onNameChange,
  onTaglineChange,
  onPublishedChange,
  problem,
}: RailContentsProps) {
  const { name, quote, avatarUrl, linkedinUrl, excerpt, tagline, publishedAt } =
    testimonial;
  const published = publishedAt !== null;

  const [draft, setDraft] = useState(linkedinUrl ?? "");
  const [problemWithUrl, setProblemWithUrl] = useState<string | null>(null);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [excerptDraft, setExcerptDraft] = useState(excerpt ?? quote);
  const [problemWithExcerpt, setProblemWithExcerpt] = useState<string | null>(
    null,
  );
  const excerptTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [nameDraft, setNameDraft] = useState(name);
  const [problemWithName, setProblemWithName] = useState<string | null>(null);
  const nameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [taglineDraft, setTaglineDraft] = useState(tagline ?? "");
  const taglineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPendingCommit = useCallback(() => {
    if (commitTimer.current === null) return;
    clearTimeout(commitTimer.current);
    commitTimer.current = null;
  }, []);

  const cancelPendingExcerpt = useCallback(() => {
    if (excerptTimer.current === null) return;
    clearTimeout(excerptTimer.current);
    excerptTimer.current = null;
  }, []);

  const cancelPendingName = useCallback(() => {
    if (nameTimer.current === null) return;
    clearTimeout(nameTimer.current);
    nameTimer.current = null;
  }, []);

  const cancelPendingTagline = useCallback(() => {
    if (taglineTimer.current === null) return;
    clearTimeout(taglineTimer.current);
    taglineTimer.current = null;
  }, []);

  useEffect(() => cancelPendingCommit, [cancelPendingCommit]);
  useEffect(() => cancelPendingExcerpt, [cancelPendingExcerpt]);
  useEffect(() => cancelPendingName, [cancelPendingName]);
  useEffect(() => cancelPendingTagline, [cancelPendingTagline]);

  const typeName = (value: string) => {
    setNameDraft(value);
    cancelPendingName();
    nameTimer.current = setTimeout(() => {
      const typed = value.trim();

      if (typed === "") {
        setProblemWithName("A testimonial needs a name on it.");
        return;
      }

      setProblemWithName(null);
      if (typed !== name) onNameChange(typed);
    }, COMMIT_DELAY_MS);
  };

  const typeTagline = (value: string) => {
    setTaglineDraft(value);
    cancelPendingTagline();
    taglineTimer.current = setTimeout(() => {
      const typed = value.trim();
      const next = typed === "" ? null : typed;
      if (next !== tagline) onTaglineChange(next);
    }, COMMIT_DELAY_MS);
  };

  const typeExcerpt = (value: string) => {
    setExcerptDraft(value);
    cancelPendingExcerpt();
    excerptTimer.current = setTimeout(() => {
      const typed = value.trim();

      if (typed === "") {
        setProblemWithExcerpt(null);
        if (excerpt !== null) onExcerptChange(null);
        return;
      }

      if (!isExcerptOfQuote(quote, typed)) {
        setProblemWithExcerpt(TESTIMONIAL_EXCERPT_NOT_THEIRS);
        return;
      }

      setProblemWithExcerpt(null);
      const next = typed === quote.trim() ? null : typed;
      if (next !== excerpt) onExcerptChange(next);
    }, COMMIT_DELAY_MS);
  };

  const typeUrl = (value: string) => {
    setDraft(value);
    cancelPendingCommit();
    commitTimer.current = setTimeout(() => {
      const typed = value.trim();

      if (typed === "") {
        setProblemWithUrl(null);
        if (linkedinUrl !== null) onProfileChange(null);
        return;
      }

      const parsed = LinkedInProfileUrlSchema.safeParse(typed);
      if (!parsed.success) {
        setProblemWithUrl(parsed.error.issues[0].message);
        return;
      }

      setProblemWithUrl(null);
      if (parsed.data !== linkedinUrl) onProfileChange(parsed.data);
    }, COMMIT_DELAY_MS);
  };

  return (
    <>
      <PropertiesPanel.Header
        actions={
          <Button
            variant="icon"
            aria-label={published ? "Unpublish" : "Publish"}
            onClick={() => onPublishedChange(!published)}
          >
            {published ? <UnpublishIcon /> : <PublishIcon />}
            <Button.Tooltip>
              <Tooltip.Text>{published ? "Unpublish" : "Publish"}</Tooltip.Text>
            </Button.Tooltip>
          </Button>
        }
      >
        {name}
      </PropertiesPanel.Header>

      {problem && (
        <div className={problemStyle}>
          <Notice role="alert">
            <Notice.Label>{problem}</Notice.Label>
          </Notice>
        </div>
      )}

      <PropertiesPanel.Section enabled>
        <PropertiesPanel.ControlPanel ariaLabel="Attribution">
          <PropertiesPanel.Control label="Name">
            <Field.Frame>
              <Field.Control
                value={nameDraft}
                onChange={(event) => typeName(event.target.value)}
              />
            </Field.Frame>
            {problemWithName && (
              <Field.Hint data-property-hint>{problemWithName}</Field.Hint>
            )}
          </PropertiesPanel.Control>

          <PropertiesPanel.Control label="Tagline">
            <Field.Frame>
              <Field.Control
                value={taglineDraft}
                placeholder="Senior Product Designer at…"
                onChange={(event) => typeTagline(event.target.value)}
              />
            </Field.Frame>
          </PropertiesPanel.Control>
        </PropertiesPanel.ControlPanel>
      </PropertiesPanel.Section>

      <PropertiesPanel.Section
        defaultEnabled={Boolean(excerpt)}
        onEnabledChange={(enabled) => {
          if (enabled) return;
          cancelPendingExcerpt();
          setExcerptDraft(quote);
          setProblemWithExcerpt(null);
          onExcerptChange(null);
        }}
      >
        <PropertiesPanel.SectionHeader icon={<QuoteIcon aria-hidden />}>
          Excerpt
        </PropertiesPanel.SectionHeader>
        <PropertiesPanel.ControlPanel>
          <PropertiesPanel.Text
            ariaLabel="Excerpt"
            value={excerptDraft}
            onValueChange={typeExcerpt}
            rows={6}
          />
          {/* Not `Field.Hint`: it needs a context only `PropertiesPanel.Control` provides. */}
          {problemWithExcerpt && (
            <p className={proseHintStyle}>{problemWithExcerpt}</p>
          )}
        </PropertiesPanel.ControlPanel>
      </PropertiesPanel.Section>

      <PropertiesPanel.Section
        defaultEnabled={Boolean(avatarUrl)}
        onEnabledChange={(enabled) => {
          if (!enabled) onClearPicture();
        }}
      >
        <PropertiesPanel.SectionHeader icon={<MediaIcon aria-hidden />}>
          Picture
        </PropertiesPanel.SectionHeader>
        <PropertiesPanel.ControlPanel>
          <PropertiesPanel.Control label="Image">
            <ImageInput
              noun="picture"
              src={avatarUrl ?? undefined}
              onPick={onPickPicture}
            />
          </PropertiesPanel.Control>
        </PropertiesPanel.ControlPanel>
      </PropertiesPanel.Section>

      <PropertiesPanel.Section
        defaultEnabled={Boolean(linkedinUrl)}
        onEnabledChange={(enabled) => {
          if (enabled) return;
          cancelPendingCommit();
          setDraft("");
          setProblemWithUrl(null);
          onProfileChange(null);
        }}
      >
        <PropertiesPanel.SectionHeader icon={<LinkedInIcon aria-hidden />}>
          LinkedIn
        </PropertiesPanel.SectionHeader>
        <PropertiesPanel.ControlPanel>
          <PropertiesPanel.Control label="URL">
            <Field.Frame>
              <Field.Control
                type="url"
                inputMode="url"
                placeholder="linkedin.com/in/…"
                value={draft}
                onChange={(event) => typeUrl(event.target.value)}
              />
            </Field.Frame>

            {linkedinUrl && (
              <Link
                href={linkedinUrl}
                target="_blank"
                aria-label="Open profile"
              >
                <LinkedInIcon aria-hidden />
              </Link>
            )}

            {problemWithUrl && (
              <Field.Hint data-property-hint>{problemWithUrl}</Field.Hint>
            )}
          </PropertiesPanel.Control>
        </PropertiesPanel.ControlPanel>
      </PropertiesPanel.Section>
    </>
  );
}
