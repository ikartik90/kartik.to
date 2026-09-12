"use client";

import { useCallback, useRef, useState } from "react";
import { css } from "../../../../styled-system/css";
import { ImageInsertDialog } from "@/components/image-insert-dialog";
import type { PropertiesPanelHandle } from "@/components/ui/properties-panel";
import { updateTestimonialDetails } from "@/app/actions/testimonial";
import type { Testimonial } from "@/domain/testimonial";
import { SocialShaderStage } from "@/components/social-icon-shader";
import { TestimonialCard } from "./testimonial-card";
import { TestimonialRail } from "./testimonial-rail";

// ---------------------------------------------------------------------------
// The board: every collected testimonial as a card, and a rail on whichever one
// is selected.
//
// The only stateful thing on this route, which is why the page above it stays a
// server component — it reads the table and hands the rows down, and this owns
// what happens to them afterwards.
//
// THE ROWS ARE HELD HERE, seeded from the server's copy and updated as writes
// land, rather than re-fetched. A `router.refresh()` after each save would be
// the other way to do it and is wrong for this surface: it re-runs the page,
// re-reads the table and replaces every card to show a change to one, for a
// value this component already has in hand. Holding them makes the card
// reflect the rail immediately, which is the thing being asked for here, and
// makes a FAILED write recoverable — see `writeDetails`.
//
// ONE RAIL for the whole board, not one per card. Only one row can be inspected
// at a time, so a panel per card would be a dozen portalled dialogs of which
// eleven are always closed. It is keyed by the selected row's id, so moving to
// another card remounts it: the rail holds a draft of the URL being typed, and
// carrying that across a selection would be one card's half-finished value
// sitting in another card's box.
// ---------------------------------------------------------------------------

const boardStyle = css({
  display: "grid",
  // Sized to the words rather than to a column count: a testimonial is a few
  // lines of prose, and a track narrower than this makes a ragged column of
  // four-word rows. `auto-fill` then decides how many fit, so the same grid is
  // one column on a phone and three on a desktop with nothing to declare.
  gridTemplateColumns:
    "repeat(auto-fill, minmax(token(sizes.testimonialCard), 1fr))",
  gap: "xl",
  // Each card keeps its own height rather than being stretched to its row's
  // tallest — the near-masonry effect. Not a real masonry layout: CSS columns
  // would give one, but they reorder the cards down each column rather than
  // across, and every card here is a BUTTON, so the tab order would stop
  // matching the reading order. Rows of naturally-sized cards keep both.
  alignItems: "start",
  listStyle: "none",
  padding: "none",
  margin: "none",
});

export interface TestimonialBoardProps {
  /** Every row, newest first, as the server read them. */
  testimonials: Testimonial[];
}

export function TestimonialBoard({ testimonials }: TestimonialBoardProps) {
  const [rows, setRows] = useState(testimonials);
  // Pinned to the ID, never to an index: the list is stable today, but an index
  // would quietly become "whatever moved into that slot" the first time
  // anything reorders it.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // Closing goes through the PANEL rather than through the state, or the rail
  // is dropped from the tree mid-animation and leaves without its slide.
  const railRef = useRef<PropertiesPanelHandle>(null);

  const selected = rows.find((row) => row.id === selectedId) ?? null;

  /**
   * Write one row's author fields, and show the result on its card.
   *
   * OPTIMISTIC, then reconciled: the card changes on the press, the write
   * follows, and the stored row replaces the guess when it lands — which
   * matters for the profile, since the server stores a canonical spelling of
   * what was typed and the card should show that rather than the typing.
   *
   * A failure puts the row BACK. A board that kept showing a picture the
   * database does not have would be lying about what is stored, and this page
   * has no Save button whose absence might hint that something is pending.
   */
  const writeDetails = useCallback(
    async (
      id: string,
      change: Partial<
        Pick<
          Testimonial,
          | "avatarUrl"
          | "linkedinUrl"
          | "excerpt"
          | "name"
          | "tagline"
          | "publishedAt"
        >
      >,
    ) => {
      const before = rows.find((row) => row.id === id);
      if (!before) return;

      const after = { ...before, ...change };
      setProblem(null);
      setRows((current) => current.map((row) => (row.id === id ? after : row)));

      try {
        const stored = await updateTestimonialDetails({
          id,
          avatarUrl: after.avatarUrl,
          linkedinUrl: after.linkedinUrl,
          excerpt: after.excerpt,
          tagline: after.tagline,
          name: after.name,
          // THE ONE FIELD NOT SENT ON EVERY WRITE, and the exception is the
          // point. The five above are sent whole each time because re-writing a
          // value with itself costs nothing. Publication is a TIMESTAMP behind
          // a boolean, so re-writing it with itself would re-stamp the moment —
          // and "published" would quietly come to mean "last edited". So it
          // goes only when the switch was the thing that moved, and the
          // action's absent-means-leave-alone rule does the rest.
          ...("publishedAt" in change
            ? { published: change.publishedAt !== null }
            : {}),
        });
        setRows((current) =>
          current.map((row) => (row.id === id ? { ...row, ...stored } : row)),
        );
      } catch {
        setRows((current) =>
          current.map((row) => (row.id === id ? before : row)),
        );
        // The detail is mine and is in the server's log; what the board needs to
        // say is that the card in front of it is not what is stored.
        setProblem("Could not save that. Try again?");
      }
    },
    [rows],
  );

  const setPicture = useCallback(
    (avatarUrl: string | null) => {
      if (selectedId) void writeDetails(selectedId, { avatarUrl });
    },
    [selectedId, writeDetails],
  );

  const setName = useCallback(
    (name: string) => {
      if (selectedId) void writeDetails(selectedId, { name });
    },
    [selectedId, writeDetails],
  );

  const setTagline = useCallback(
    (tagline: string | null) => {
      if (selectedId) void writeDetails(selectedId, { tagline });
    },
    [selectedId, writeDetails],
  );

  const setExcerpt = useCallback(
    (excerpt: string | null) => {
      if (selectedId) void writeDetails(selectedId, { excerpt });
    },
    [selectedId, writeDetails],
  );

  /**
   * Put these words on the homepage, or take them off.
   *
   * The board holds a DATE optimistically because that is what the row holds;
   * the one the server stamps replaces it when the write lands. Which instant
   * it is never reaches the screen — the switch reads it as a yes/no — so the
   * guess costs nothing even while it is wrong.
   */
  const setPublished = useCallback(
    (published: boolean) => {
      if (selectedId) {
        void writeDetails(selectedId, {
          publishedAt: published ? new Date() : null,
        });
      }
    },
    [selectedId, writeDetails],
  );

  const setProfile = useCallback(
    (linkedinUrl: string | null) => {
      if (selectedId) void writeDetails(selectedId, { linkedinUrl });
    },
    [selectedId, writeDetails],
  );

  return (
    <>
      {/* ONE stage for the whole board, not one per card. A stage holds a
          single WebGL context and moves it to whichever icon is hovered, so a
          stage per card would be a context per card — a dozen of them, against
          a browser limit of about sixteen. The profile links inside register
          with this one. */}
      <SocialShaderStage>
        <ul className={boardStyle}>
          {rows.map((row) => (
            <li key={row.id}>
              <TestimonialCard
                testimonial={row}
                selected={row.id === selectedId}
                onSelect={() => {
                  // A stale failure from the last row would otherwise greet the
                  // next one as if its own write had gone wrong.
                  setProblem(null);
                  setSelectedId(row.id);
                }}
              />
            </li>
          ))}
        </ul>
      </SocialShaderStage>

      {/* A SIBLING of the grid rather than a child of the card it edits: it is
          fixed to the viewport and portals to the body to get there, so it
          takes no space here and needs none. */}
      {selected && (
        <TestimonialRail
          ref={railRef}
          testimonial={selected}
          onPickPicture={() => setPicking(true)}
          onClearPicture={() => setPicture(null)}
          onProfileChange={setProfile}
          onExcerptChange={setExcerpt}
          onNameChange={setName}
          onTaglineChange={setTagline}
          onPublishedChange={setPublished}
          problem={problem}
          onDismiss={() => setSelectedId(null)}
        />
      )}

      {/* Owned HERE and not by the rail, for the reason the grid owns its own:
          the rail is a portalled surface with an outside-press dismiss, and a
          modal opened from inside it would be a second surface fighting the
          first for every press. The rail exempts `dialog` from that dismiss so
          the round trip survives. */}
      <ImageInsertDialog
        open={picking}
        mode="change"
        initialPhase="library"
        // Not the media library: a testimonial's face lives in `profiles/`,
        // and this dialog both lists and uploads there. See `MediaFolder`.
        folder="profiles"
        onClose={() => setPicking(false)}
        onInsert={(payload) => {
          setPicture(payload.src);
          setPicking(false);
        }}
      />
    </>
  );
}
