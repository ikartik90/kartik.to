import { revalidatePath } from "next/cache";
import type { Post } from "@/domain/post";
import { getEditUrl, getPostReadUrl } from "@/utils/post-urls";

export function revalidatePostPaths(
  post: Pick<Post, "slug" | "category">,
): void {
  revalidatePath("/");
  revalidatePath(getPostReadUrl(post.category, post.slug));
  revalidatePath(getEditUrl(post.category, post.slug));
}
