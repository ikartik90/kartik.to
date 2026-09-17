import type { Metadata } from "next";
import { PostPage, postPageMetadata } from "@/components/post-page";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return postPageMetadata("WORK", (await params).slug);
}

export default async function ProjectPage({ params }: Props) {
  return <PostPage category="WORK" slug={(await params).slug} />;
}
