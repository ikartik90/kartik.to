// Records a ⌘K pressed before hydration. Repeats the platform rule in keyboard-shortcut.ts
// (this runs before any module loads): keep the two in step.

export const PALETTE_INTENT_SCRIPT = `(function(){try{
var apple=/mac|iphone|ipad|ipod/i.test((navigator.userAgentData&&navigator.userAgentData.platform)||navigator.platform||navigator.userAgent||'');
var onKeyDown=function(e){if((apple?e.metaKey:e.ctrlKey)&&(e.key==='k'||e.key==='K')){e.preventDefault();window.__paletteIntent=1}};
window.addEventListener('keydown',onKeyDown,true);
window.__takePaletteIntent=function(){window.removeEventListener('keydown',onKeyDown,true);var asked=window.__paletteIntent;window.__paletteIntent=0;return !!asked}
}catch(e){}})()`;

type IntentWindow = Window & { __takePaletteIntent?: () => boolean };

/** Answers once: collecting the press also removes the early listener. */
export function takePaletteIntent(): boolean {
  if (typeof window === "undefined") return false;
  const take = (window as IntentWindow).__takePaletteIntent;
  return typeof take === "function" ? take() : false;
}
