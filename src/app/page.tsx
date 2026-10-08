import type { Metadata } from "next";
import { HomePage } from "@/components/home-page";
import { getHomeDescription } from "@/lib/home";
import { homeMetadata } from "@/lib/post-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return homeMetadata(await getHomeDescription());
}

export default function Home() {
  return <HomePage />;
}
