// ---------------------------------------------------------------------------
// Whether a key press belongs to something the visitor is typing into.
//
// Two callers ask it, for the same reason from opposite directions. ⌘Z asks so
// it steps the DRAFT back only when a field is not undoing its own edit; the
// `<` shortcut asks so it goes up a level only when `<` is not a character
// somebody meant to type. Both are about a key that means one thing in a field
// and another outside one.
//
// Contenteditable counts, and is the case that matters most here: the article
// editor and its sidenotes are contenteditable rather than fields, and they are
// where a bracket is most likely to be typed in earnest.
// ---------------------------------------------------------------------------

/** Whether `target` is a field, an area, or a contenteditable. */
export function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    // Coerced, not just trusted: `isContentEditable` is declared `boolean` but
    // is absent in jsdom, so the bare chain returns `undefined` there — and an
    // `undefined` from a function that promises a boolean is a lie that only
    // shows up in whichever caller thought to compare against `false`.
    target.isContentEditable === true
  );
}
