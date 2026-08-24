import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCover } from "@/app/actions/cover";
import { CoverPlayground } from "../cover-playground";

// ---------------------------------------------------------------------------
// A SAVED cover, reopened for editing.
//
// The only admin-gated part of the playground, and gated by the action rather
// than by this file: `getCover` requires the admin session, so a visitor asking
// for a cover id gets the same 404 the routes that write to the database give.
// The playground itself stays public at the bare route — tuning a shader is not
// a privilege, and only the saved library is.
// ---------------------------------------------------------------------------

interface Props {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: "Cover Playground",
};

export default async function EditCoverPage({ params }: Props) {
  const { id } = await params;

  // A thrown Unauthorized from the action is a visitor asking after the
  // library, which must answer exactly as a missing cover does — otherwise the
  // difference between the two responses says a cover by that id exists.
  const cover = await getCover(id).catch(() => null);
  if (!cover) notFound();

  return (
    <CoverPlayground
      cover={{
        id: cover.id,
        title: cover.title ?? null,
        shaderId: cover.shaderId,
        settings: cover.settings,
      }}
    />
  );
}
