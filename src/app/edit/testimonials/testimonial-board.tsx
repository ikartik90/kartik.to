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

const boardStyle = css({
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fill, minmax(token(sizes.testimonialCard), 1fr))",
  gap: "xl",
  alignItems: "start",
  listStyle: "none",
  padding: "none",
  margin: "none",
});

export interface TestimonialBoardProps {
  testimonials: Testimonial[];
}

export function TestimonialBoard({ testimonials }: TestimonialBoardProps) {
  const [rows, setRows] = useState(testimonials);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // Close through the panel, not the state, or the rail unmounts mid-animation.
  const railRef = useRef<PropertiesPanelHandle>(null);

  const selected = rows.find((row) => row.id === selectedId) ?? null;

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
          // Sent only when the switch moved: re-sending would re-stamp the publish time.
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
      {/* One stage for the board: each stage holds a WebGL context, and browsers cap them at ~16. */}
      <SocialShaderStage>
        <ul className={boardStyle}>
          {rows.map((row) => (
            <li key={row.id}>
              <TestimonialCard
                testimonial={row}
                selected={row.id === selectedId}
                onSelect={() => {
                  setProblem(null);
                  setSelectedId(row.id);
                }}
              />
            </li>
          ))}
        </ul>
      </SocialShaderStage>

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

      {/* Owned here, not by the rail: a modal inside the rail would fight its outside-press dismiss. */}
      <ImageInsertDialog
        open={picking}
        mode="change"
        initialPhase="library"
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
