import "./page.styles.css";
import { redirect } from "next/navigation";

export default function NewArticlePage() {
  redirect("/edit/new?category=ARTICLE");
}
