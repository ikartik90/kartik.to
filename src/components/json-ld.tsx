import { serializeJsonLd } from "@/utils/structured-data";

/** A plain `<script>`, not `next/script`, per Next's JSON-LD guide. */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
