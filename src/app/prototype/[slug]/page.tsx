import type { Metadata } from "next";
import { PostPage, postPageMetadata } from "@/components/post-page";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return postPageMetadata("PROTOTYPE", (await params).slug);
}

export default async function PrototypePage({ params }: Props) {
  return <PostPage category="PROTOTYPE" slug={(await params).slug} />;
}
