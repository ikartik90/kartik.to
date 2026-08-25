// ---------------------------------------------------------------------------
// A ⌘K pressed before the palette can answer.
//
// The palette's listener is an effect in the root layout, so it exists only
// once the page has hydrated. Everything before that — the seconds where the
// page is painted, looks finished, and invites the shortcut — silently drops
// the press. The reader gets nothing, and the second press is the one that
// works, which reads as "the menu takes a while to load".
//
// So a listener that costs no JavaScript to install runs in `<head>`, records
// that the shortcut was asked for, and hands that over to the palette the
// moment the palette is alive. It cannot OPEN anything: the dialog exists in
// the server HTML but nothing in it can be typed in or chosen until React is
// attached, and a menu that answers nothing is worse than one that arrives a
// beat later. It only makes sure the press is not lost.
//
// This is the one place the shortcut's platform rule is written twice (see
// `keyboard-shortcut.ts` for the other, which is the authority). It has to be:
// the script runs before any module has loaded. Keep the two in step.
// ---------------------------------------------------------------------------

/**
 * Runs in `<head>`, before hydration. Records a ⌘K / Ctrl K into
 * `window.__paletteIntent` and exposes `__takePaletteIntent()` to collect it.
 */
export const PALETTE_INTENT_SCRIPT = `(function(){try{
var apple=/mac|iphone|ipad|ipod/i.test((navigator.userAgentData&&navigator.userAgentData.platform)||navigator.platform||navigator.userAgent||'');
var onKeyDown=function(e){if((apple?e.metaKey:e.ctrlKey)&&(e.key==='k'||e.key==='K')){e.preventDefault();window.__paletteIntent=1}};
window.addEventListener('keydown',onKeyDown,true);
window.__takePaletteIntent=function(){window.removeEventListener('keydown',onKeyDown,true);var asked=window.__paletteIntent;window.__paletteIntent=0;return !!asked}
}catch(e){}})()`;

type IntentWindow = Window & { __takePaletteIntent?: () => boolean };

/**
 * Was the shortcut pressed while the palette was still catching up? Answers
 * once — collecting the press also retires the early listener, leaving the
 * palette's own the only one.
 */
export function takePaletteIntent(): boolean {
  if (typeof window === "undefined") return false;
  const take = (window as IntentWindow).__takePaletteIntent;
  return typeof take === "function" ? take() : false;
}
