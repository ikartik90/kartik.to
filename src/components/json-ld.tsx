import { serializeJsonLd } from "@/utils/structured-data";

/**
 * Structured data for the page it is rendered on. A plain `<script>` rather
 * than `next/script`, as Next's JSON-LD guide says: it is data, not code, and
 * there is nothing to load or run.
 */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
