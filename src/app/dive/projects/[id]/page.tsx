import "./page.styles.css";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { HomePage } from "@/components/home-page";
import { projectMetadata, reviewMetadata } from "@/lib/post-metadata";
import { REVIEW_BASE } from "@/utils/review-path";
import { movedTo, projectCard, projectParams, projectPath, projectPreviewPath } from "@/data/project-cards";

export const generateStaticParams = projectParams;

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const card = projectCard((await params).id);
  return card
    ? reviewMetadata(projectMetadata(card.title, card.sentence, projectPath(card.id), projectPreviewPath(card.id)))
    : {};
}

export default async function ReviewProjectPage({ params }: Props) {
  const { id } = await params;
  const moved = movedTo(id);
  if (moved) permanentRedirect(projectPath(moved, REVIEW_BASE));
  if (!projectCard(id)) notFound();
  return <HomePage project={id} base={REVIEW_BASE} />;
}
