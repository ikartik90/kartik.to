import type { Metadata } from "next";
import { HomePage } from "@/components/home-page";
import { getHomeDescription } from "@/lib/home";
import { homeMetadata, reviewMetadata } from "@/lib/post-metadata";
import { REVIEW_BASE } from "@/utils/review-path";

// Dynamic: edits to the homepage revalidate only `/`.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return reviewMetadata(homeMetadata(await getHomeDescription()));
}

export default function ReviewHome() {
  return <HomePage base={REVIEW_BASE} />;
}
