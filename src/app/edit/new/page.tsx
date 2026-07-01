import { notFound } from "next/navigation";
import { env } from "@/lib/env";
import { auth } from "@/lib/auth/server";
import { ArticleEditor } from "@/components/article-editor";
import { parseCategory } from "@/lib/posts";

export const metadata = { title: "New Draft" };

async function isAdmin(): Promise<boolean> {
  const { data: session } = await auth.getSession();
  return session?.user?.email === env.ADMIN_GITHUB_ID;
}

interface Props {
  searchParams: Promise<{ category?: string }>;
}

export default async function NewEditPage({ searchParams }: Props) {
  if (!(await isAdmin())) notFound();

  const { category: categoryParam } = await searchParams;
  const category = parseCategory(categoryParam) ?? "ARTICLE";

  return (
    <main>
      <article>
        <ArticleEditor category={category} />
      </article>
    </main>
  );
}
