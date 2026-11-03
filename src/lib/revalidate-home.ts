import { revalidatePath } from "next/cache";
import { REVIEW_BASE } from "@/utils/review-path";

/** The homepage, and the pages that serve it again: each project's address, and the review copy's. */
export function revalidateHome(): void {
  revalidatePath("/");
  revalidatePath("/projects/[id]", "page");
  revalidatePath(REVIEW_BASE);
  revalidatePath(`${REVIEW_BASE}/projects/[id]`, "page");
}
