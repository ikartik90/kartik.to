import { notFound } from "next/navigation";
import { env } from "@/lib/env";
import { auth } from "@/lib/auth/server";
import { ArticleEditor } from "@/components/article-editor";

export const metadata = { title: "New Article" };

async function isAdmin(): Promise<boolean> {
  const { data: session } = await auth.getSession();
  return session?.user?.email === env.ADMIN_GITHUB_ID;
}

export default async function NewArticlePage() {
  if (!(await isAdmin())) notFound();
  return (
    <main>
      <article>
        <ArticleEditor />
      </article>
    </main>
  );
}
