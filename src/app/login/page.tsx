import Link from "next/link";
import { css } from "../../../styled-system/css";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;

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
      <h1 className={css({ fontSize: "2xl", fontWeight: "bold" })}>Sign in</h1>
      {error ? (
        <p className={css({ color: "red.600" })}>Authentication failed. Please try again.</p>
      ) : null}
      <Link
        href="/auth/sign-in"
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
