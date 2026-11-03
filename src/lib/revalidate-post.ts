import { revalidatePath } from "next/cache";
import { revalidateHome } from "@/lib/revalidate-home";
import type { Post } from "@/domain/post";
import { getEditUrl, getPostReadUrl } from "@/utils/post-urls";

export function revalidatePostPaths(
  post: Pick<Post, "slug" | "category">,
): void {
  revalidateHome();
  revalidatePath(getPostReadUrl(post.category, post.slug));
  revalidatePath(getEditUrl(post.category, post.slug));
}
