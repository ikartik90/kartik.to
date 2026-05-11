import { Typography } from "@/components/ui/typography";

export default function Home() {
  return (
    <main>
      <article>
        <Typography tag="h1" type="title">
          Kartik Iyer
        </Typography>

        <Typography tag="h2" type="subheading">
          Designer. Engineer. Builder.
        </Typography>

        <Typography tag="p" type="paragraph">
          The quick brown fox jumps over the lazy dog — paragraph. This is a
          longer sentence to demonstrate how the paragraph style handles line
          height and text wrapping across multiple lines of body copy.
        </Typography>

        <Typography tag="blockquote" type="quote">
          The quick brown fox jumps over the lazy dog — quote
        </Typography>

        <Typography tag="p" type="sidenote">
          The quick brown fox jumps over the lazy dog — sidenote
        </Typography>

        <Typography tag="figcaption" type="caption">
          The quick brown fox jumps over the lazy dog — caption
        </Typography>
      </article>
    </main>
  );
}
