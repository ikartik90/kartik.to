import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/auth/server";
import { ArticleEditor } from "@/components/article-editor";
import { parseCategory } from "@/lib/posts";

export const metadata = { title: "New Draft" };

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
