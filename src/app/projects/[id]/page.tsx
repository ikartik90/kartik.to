import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { HomePage } from "@/components/home-page";
import { projectMetadata } from "@/lib/post-metadata";
import { movedTo, projectCard, projectPath, projectPreviewPath } from "@/data/project-cards";

// Dynamic: edits to the homepage revalidate only `/`.
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const card = projectCard((await params).id);
  return card ? projectMetadata(card.title, card.sentence, projectPath(card.id), projectPreviewPath(card.id)) : {};
}

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;
  const moved = movedTo(id);
  if (moved) permanentRedirect(projectPath(moved));
  if (!projectCard(id)) notFound();
  return <HomePage project={id} />;
}
