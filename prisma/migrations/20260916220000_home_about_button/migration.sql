-- The homepage's way on to the About page, moved from a button the icon row
-- drew into a `button_link` block in the homepage's own document — so it is
-- written, moved and removed like any other block.
--
-- The row stops drawing its button in the same deploy, so the block goes in
-- here, directly above the icon row, where the button stood. Only on the
-- homepage's record, only where the document has an icon row to stand above,
-- and only where it holds no button yet — the author may have added one
-- already, and a second would be a duplicate.
UPDATE "Post"
SET "content" = jsonb_set(
  "content",
  '{content}',
  (
    SELECT jsonb_agg(block ORDER BY position)
    FROM (
      SELECT block, position::numeric AS position
      FROM jsonb_array_elements("content" -> 'content')
        WITH ORDINALITY AS existing(block, position)
      UNION ALL
      SELECT
        '{"type": "button_link", "text": "About me", "href": "/about"}'::jsonb,
        position - 0.5
      FROM jsonb_array_elements("content" -> 'content')
        WITH ORDINALITY AS existing(block, position)
      WHERE block ->> 'type' = 'social_links'
    ) AS blocks
  )
)
WHERE "slug" = 'home'
  AND "category" = 'PAGE'
  AND "content" -> 'content' @> '[{"type": "social_links"}]'
  AND NOT "content" -> 'content' @> '[{"type": "button_link"}]';
