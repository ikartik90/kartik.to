"use client";

import { useCallback, useEffect, useRef, useState, type Ref } from "react";
import { css } from "../../../../styled-system/css";
import {
  PropertiesPanel,
  type PropertiesPanelHandle,
} from "@/components/ui/properties-panel";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input/field";
import { Link } from "@/components/ui/link";
import { Notice } from "@/components/ui/notice";
import {
  LinkedInProfileUrlSchema,
  TESTIMONIAL_EXCERPT_NOT_THEIRS,
  isExcerptOfQuote,
  type Testimonial,
} from "@/domain/testimonial";
import { filenameFromMediaUrl } from "@/domain/media";
import LinkedInIcon from "@/assets/icons/linkedin.svg";
import QuoteIcon from "@/assets/icons/quote.svg";
import TitleIcon from "@/assets/icons/title.svg";
import MediaIcon from "@/assets/icons/media.svg";
import CrossIcon from "@/assets/icons/cross-small.svg";

// ---------------------------------------------------------------------------
// The rail that edits one collected testimonial — the two fields that are mine
// to fill, in the same docked inspector the grid and the media library use.
//
// TWO SECTIONS, not two always-on groups, and that is the whole shape of this
// panel. A `Section` is a property you ADD and REMOVE: its header carries one
// button that mounts the controls and, on the way back out, clears what they
// were editing. That is exactly what these two are — a row arrives with no
// picture and no profile, and either may go back to having none — so the
// add/remove pair is the feature rather than decoration, and there is no
// separate "clear" control to build.
//
// THE WORDS ARE NOT HERE. The quote and the name are on the card and nowhere
// else, because they are not mine to edit — the server would refuse the write
// (`TestimonialDetailsSchema` has no `name` or `quote` in it), and a box that
// looked editable and was not would be worse than no box. The header says whose
// row this is and stops there.
//
// COMMITS ON A PAUSE, not on a press. There is no Save on this page and no
// draft to commit — the board writes each change as it is made, the way the
// media library writes an alt text. What that costs is this file's one piece of
// real machinery: a URL is typed one character at a time and almost every
// intermediate state is invalid, so the value is held locally and only offered
// upward once the typing has stopped. See `COMMIT_DELAY_MS`.
// ---------------------------------------------------------------------------

/**
 * How long a pause counts as "done typing".
 *
 * The same 400ms the media library waits before saving an alt text, and it is
 * the number doing two jobs here rather than one: it decides when the value is
 * WRITTEN, and it decides when the value is JUDGED. Validating on the keystroke
 * would put "that does not look like a LinkedIn URL" under the box from the
 * first character typed until the last — a complaint about a field nobody has
 * finished filling in.
 */
const COMMIT_DELAY_MS = 400;

const pickerRowStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "xs",
  minWidth: 0,
});

// The button is as wide as the field track and the name inside it is clipped,
// rather than the button growing to fit a 60-character R2 filename and pushing
// the row's action column off the panel.
const pickerButtonStyle = css({ flex: "1 1 0", minWidth: 0 });

const pickerNameStyle = css({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

// The notice is a section's width but not a section: it carries the same inline
// inset the header and the control panels do, so it lines up with them, and a
// block of its own space so it does not sit flush against the title above it.
const problemStyle = css({ paddingInline: "xl", paddingBlock: "md" });

// The note under the excerpt box. Matches what `Field.Hint` draws in a control
// row — the smallest step in the scale, dialled back so it reads as a remark on
// the field above rather than as another value.
const proseHintStyle = css({
  textStyle: "fineprint",
  color: "text.body/50",
  margin: "none",
});

export interface TestimonialRailProps {
  /** The row as the board currently shows it — picture, profile and all. */
  testimonial: Testimonial;
  /**
   * Asks for the media library.
   *
   * The rail emits the INTENT and the board owns the dialog, for the reason
   * `CardPropertiesPanel` does the same: this panel is a portalled, fixed
   * surface with its own outside-press dismiss, and a modal opened from inside
   * it would be a second surface fighting the first for every press.
   */
  onPickPicture: () => void;
  onClearPicture: () => void;
  /** The profile, canonical or cleared — never a half-typed one. */
  onProfileChange: (linkedinUrl: string | null) => void;
  /** The portion to quote, or null for all of it. Only ever a real slice. */
  onExcerptChange: (excerpt: string | null) => void;
  /** A tidied name. Never blank — the rail refuses that before it gets here. */
  onNameChange: (name: string) => void;
  /** A write that did not land. The board owns it; this only shows it. */
  problem: string | null;
  onDismiss: () => void;
  ref?: Ref<PropertiesPanelHandle>;
}

export function TestimonialRail({
  testimonial,
  onPickPicture,
  onClearPicture,
  onProfileChange,
  onExcerptChange,
  onNameChange,
  problem,
  onDismiss,
  ref,
}: TestimonialRailProps) {
  const { name, quote, avatarUrl, linkedinUrl, excerpt } = testimonial;

  // What is in the BOX, which is not what is in the row: the row holds
  // `https://www.linkedin.com/in/ada` and the box holds whatever is being typed
  // on the way there. Seeded from the row and its own from then on — the whole
  // rail is remounted per card (see the board's `key`), so there is no stale
  // draft to carry across a selection.
  const [draft, setDraft] = useState(linkedinUrl ?? "");
  const [problemWithUrl, setProblemWithUrl] = useState<string | null>(null);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Seeded with the WHOLE quote when nothing has been chosen yet, because the
  // gesture this field expects is "cut this down", not "type a quote". An empty
  // box would invite the one thing the rule forbids.
  const [excerptDraft, setExcerptDraft] = useState(excerpt ?? quote);
  const [problemWithExcerpt, setProblemWithExcerpt] = useState<string | null>(
    null,
  );
  const excerptTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [nameDraft, setNameDraft] = useState(name);
  const [problemWithName, setProblemWithName] = useState<string | null>(null);
  const nameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // A pending commit outlives its own rail otherwise: select another card
  // within the pause and the timer fires against a panel that is gone, writing
  // the abandoned value onto the row it was typed for.
  useEffect(() => cancelPendingCommit, [cancelPendingCommit]);
  useEffect(() => cancelPendingExcerpt, [cancelPendingExcerpt]);
  useEffect(() => cancelPendingName, [cancelPendingName]);

  /**
   * Correct the spelling of who said it.
   *
   * The only submitted field this rail writes. A blank one is REFUSED rather
   * than cleared — the column is NOT NULL, and the other three fields' "empty
   * means none" rule would leave a testimonial credited to nobody.
   */
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

  /**
   * Trim the quote down, on the same pause the URL commits on.
   *
   * Checked against the quote HERE as well as on the server, and the
   * duplication is the point rather than an oversight: the server's refusal is
   * what makes the rule true, and this one is what makes it legible — it puts
   * the reason under the box while the words are still in front of you, instead
   * of after a round trip that has already failed.
   */
  const typeExcerpt = (value: string) => {
    setExcerptDraft(value);
    cancelPendingExcerpt();
    excerptTimer.current = setTimeout(() => {
      const typed = value.trim();

      // Emptied means "show all of it again" — the same thing removing the
      // section does, and not a misquote to complain about.
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
      // The whole quote is not an excerpt of itself worth storing: it is the
      // fallback, and storing it would be the same words in two columns.
      const next = typed === quote.trim() ? null : typed;
      if (next !== excerpt) onExcerptChange(next);
    }, COMMIT_DELAY_MS);
  };

  const typeUrl = (value: string) => {
    setDraft(value);
    cancelPendingCommit();
    commitTimer.current = setTimeout(() => {
      const typed = value.trim();

      // An emptied box is a cleared profile, not a malformed one — no complaint
      // and no `LinkedInProfileUrlSchema`, which would refuse it.
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
      // Compared CANONICALLY, so re-typing the same profile in a different
      // spelling is not a write, and neither is the row coming back from the
      // server in the spelling this just sent it.
      if (parsed.data !== linkedinUrl) onProfileChange(parsed.data);
    }, COMMIT_DELAY_MS);
  };

  return (
    <PropertiesPanel
      ref={ref}
      ariaLabel={`Details for ${name}'s testimonial`}
      // The media library is a modal `<dialog>` opened from a control in here.
      // Portalled, so it is outside this panel by every measure the dismiss can
      // take, and a press in it would otherwise close the rail it belongs to.
      ignoreSelector="dialog"
      onDismiss={onDismiss}
    >
      {/* Whose row this is, and the only place either of their words appears
          in the rail. Not editable — see the note at the top. */}
      <PropertiesPanel.Header>{name}</PropertiesPanel.Header>

      {/* A write that did not land, said once for the whole rail rather than
          under the field that provoked it. It belongs to the ROW: the picture
          and the profile are written by the same call, either can be the one
          that fails, and the picture's section may not even be open to put a
          message in. `role="alert"` because nothing else on screen announces
          it — the card has already sprung back to what is stored, and a card
          that quietly undid itself is the confusing case this exists for. */}
      {problem && (
        <div className={problemStyle}>
          <Notice role="alert">
            <Notice.Label>{problem}</Notice.Label>
          </Notice>
        </div>
      )}

      {/* ALWAYS ON, and drawn with no section header: a name is not something
          you add or remove, it is a property every testimonial has. That is the
          panel's own idiom for such a group — `enabled` held true, and the
          control panel named by an `ariaLabel` since there is no heading left
          to be named by. */}
      <PropertiesPanel.Section enabled>
        <PropertiesPanel.ControlPanel ariaLabel="Attribution">
          <PropertiesPanel.Control label={<TitleIcon aria-hidden />}>
            <Field.Frame>
              <Field.Control
                aria-label="Name"
                value={nameDraft}
                onChange={(event) => typeName(event.target.value)}
              />
            </Field.Frame>
            {problemWithName && (
              <Field.Hint data-property-hint>{problemWithName}</Field.Hint>
            )}
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
          {/* Prose filling the panel rather than a labelled row — this is
              several lines of somebody's writing being cut down, and a
              single-line input would hide everything past its right edge. */}
          <PropertiesPanel.Text
            ariaLabel="Excerpt"
            value={excerptDraft}
            onValueChange={typeExcerpt}
            rows={6}
          />
          {/* A plain paragraph, not `Field.Hint`: that part reads a context
              only `PropertiesPanel.Control` puts in place, and this message
              belongs to a block of prose rather than to a labelled row. */}
          {problemWithExcerpt && (
            <p className={proseHintStyle}>{problemWithExcerpt}</p>
          )}
        </PropertiesPanel.ControlPanel>
      </PropertiesPanel.Section>

      <PropertiesPanel.Section
        // Open when there is something to show, shut when there is not, so the
        // panel opens describing the row rather than describing itself.
        defaultEnabled={Boolean(avatarUrl)}
        // Closing the section is how a picture is REMOVED. The panel unmounts
        // the controls either way; this is what makes the row agree with them.
        onEnabledChange={(enabled) => {
          if (!enabled) onClearPicture();
        }}
      >
        <PropertiesPanel.SectionHeader icon={<MediaIcon aria-hidden />}>
          Picture
        </PropertiesPanel.SectionHeader>
        <PropertiesPanel.ControlPanel>
          <PropertiesPanel.Control label="Image">
            <div className={pickerRowStyle}>
              {/* Labelled rather than left to the row's label, because a button
                  is not labelable by a `<label>`: the filename written on it is
                  its only other accessible name, and that changes with the
                  picture. */}
              <Button
                type="button"
                size="sm"
                emphasis="tertiary"
                aria-label={avatarUrl ? "Change picture" : "Add picture"}
                className={pickerButtonStyle}
                onClick={onPickPicture}
              >
                <Button.Text className={pickerNameStyle}>
                  {avatarUrl ? filenameFromMediaUrl(avatarUrl) : "Add picture"}
                </Button.Text>
              </Button>
              {avatarUrl && (
                <Button
                  type="button"
                  size="sm"
                  variant="icon"
                  emphasis="tertiary"
                  aria-label="Clear picture"
                  onClick={onClearPicture}
                >
                  <CrossIcon aria-hidden />
                </Button>
              )}
            </div>
          </PropertiesPanel.Control>
        </PropertiesPanel.ControlPanel>
      </PropertiesPanel.Section>

      <PropertiesPanel.Section
        defaultEnabled={Boolean(linkedinUrl)}
        onEnabledChange={(enabled) => {
          if (enabled) return;
          // The pause is still running if the section is closed mid-type, and a
          // timer that fired after this would put the profile straight back.
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

            {/* The row's third column. The card cannot hold this — it is a
                button, and a link inside one is not keyboard-operable — so the
                rail is the only place a stored profile is reachable from.
                Drawn off the STORED value, never the draft: a link built from
                half-typed text would open half a URL. */}
            {linkedinUrl && (
              <Link
                href={linkedinUrl}
                target="_blank"
                aria-label="Open profile"
              >
                <LinkedInIcon aria-hidden />
              </Link>
            )}

            {/* The value being wrong, as opposed to the write not landing —
                which is the panel's message above, not this field's. */}
            {problemWithUrl && (
              <Field.Hint data-property-hint>{problemWithUrl}</Field.Hint>
            )}
          </PropertiesPanel.Control>
        </PropertiesPanel.ControlPanel>
      </PropertiesPanel.Section>
    </PropertiesPanel>
  );
}
