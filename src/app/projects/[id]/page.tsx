import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HomePage } from "@/components/home-page";
import { projectMetadata } from "@/lib/post-metadata";
import { openCard, projectPath, projectPreviewPath } from "@/app/_project-stacks/data";

// Dynamic: edits to the homepage revalidate only `/`.
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const card = openCard((await params).id);
  return card
    ? projectMetadata(card.title, card.sentence, projectPath(card.id), projectPreviewPath(card.id))
    : {};
}

export default async function ProjectPage({ params }: Props) {
  const card = openCard((await params).id);
  if (!card) notFound();
  return <HomePage sheet={card.id} />;
}
