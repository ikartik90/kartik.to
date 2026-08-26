import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCover } from "@/app/actions/cover";
import { CoverPlayground } from "../cover-playground";

// ---------------------------------------------------------------------------
// A SAVED cover, reopened.
//
// Public for a PUBLISHED cover and a 404 for anything else, and that decision
// is the action's rather than this file's: `getCover` hands a visitor a
// published cover and answers null for one that is still the author's, which
// arrives here indistinguishable from a cover that does not exist. Tuning a
// shader is not a privilege — a visitor may open a published preset and play
// with it, and nothing they do is written anywhere.
// ---------------------------------------------------------------------------

interface Props {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: "Cover Playground",
};

export default async function EditCoverPage({ params }: Props) {
  const { id } = await params;

  // Null covers both cases on purpose — no such cover, and a cover a visitor
  // may not see — because the two must answer identically. A caught throw would
  // have been the same protection; `getCover` returning null is what makes the
  // catch unnecessary rather than what makes it safe.
  const cover = await getCover(id);
  if (!cover) notFound();

  return (
    <CoverPlayground
      cover={{
        id: cover.id,
        title: cover.title ?? null,
        shaderId: cover.shaderId,
        settings: cover.settings,
        publishedAt: cover.publishedAt,
      }}
    />
  );
}
