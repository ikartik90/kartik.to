// Holds a press on a project's card made before hydration, which would otherwise load the project's address as a new
// page; the homepage's projects collect it once live and open it over the page. If they never come, the link is
// followed after all. Repeats the rule in plain-click.ts (this runs before any module loads): keep the two in step.

export const FOLLOW_AFTER_MS = 10_000;

export const PROJECT_INTENT_SCRIPT = `(function(){try{
var held=null;
var stop=function(){document.removeEventListener('click',onClick,true)};
var onClick=function(e){var a=e.target&&e.target.closest&&e.target.closest('[data-sheet-card]>a');
if(!a||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
e.preventDefault();held=a;
setTimeout(function(){if(held===a){stop();held=null;a.click()}},${FOLLOW_AFTER_MS})};
document.addEventListener('click',onClick,true);
window.__takeProjectIntent=function(){stop();var a=held;held=null;return a?a.parentNode.getAttribute('data-sheet-card'):null}
}catch(e){}})()`;

type IntentWindow = Window & { __takeProjectIntent?: () => string | null };

/** The card pressed before hydration, if any. Answers once: collecting the press also stops holding them. */
export function takeProjectIntent(): string | null {
  if (typeof window === "undefined") return null;
  const take = (window as IntentWindow).__takeProjectIntent;
  return typeof take === "function" ? take() : null;
}
