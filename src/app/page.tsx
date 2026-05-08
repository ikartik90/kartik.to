import Link from "next/link";
import { css } from "../../styled-system/css";

export default function Home() {
  return (
    <main
      className={css({
        minH: "100vh",
        display: "flex",
        flexDir: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "6",
        px: "6",
      })}
    >
      <h1 className={css({ fontSize: "3xl", fontWeight: "bold" })}>
        Fresh Next.js + Vercel starter
      </h1>
      <p className={css({ color: "gray.600", textAlign: "center", maxW: "2xl" })}>
        Panda CSS, Zod, Supabase, Prisma, and GitHub OAuth scaffolding are set up.
      </p>
      <Link
        href="/login"
        className={css({
          px: "4",
          py: "2",
          rounded: "md",
          bg: "black",
          color: "white",
          _hover: { opacity: 0.9 },
        })}
      >
        Continue with GitHub
      </Link>
    </main>
  );
}
