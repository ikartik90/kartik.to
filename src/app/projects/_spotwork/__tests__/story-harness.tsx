import { render, screen, within, type RenderOptions } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DESIGN_SYSTEM } from "../copy";
import { DsStory, type Story } from "../ds-story";

/**
 * Renders `stories` one after another, as their pages draw them, inside `wrapper`. An example is found by its title;
 * untitled, the first.
 */
export function renderStories(stories: Story[], wrapper?: RenderOptions["wrapper"]) {
  const user = userEvent.setup();
  render(
    <>
      {stories.map((story) => (
        <DsStory key={story.figma} story={story} />
      ))}
    </>,
    { wrapper },
  );
  /** A story, by its title. */
  const story = (id: string) => screen.getByRole("region", { name: id });
  const example = (id: string, title?: string) =>
    title === undefined
      ? story(id).querySelector<HTMLElement>("[data-example]")!
      : within(story(id)).getByRole("region", { name: title });
  /** An example's live component alone, without its title or code. */
  const preview = (id: string, title?: string) => example(id, title).querySelector<HTMLElement>("[data-canvas]")!;
  /** The titles of a story's examples, in order. */
  const titles = (id: string) =>
    [...story(id).querySelectorAll("[data-example] > :is(h2, h3)")].map((heading) => heading.textContent);
  /** The code under an example. */
  const code = (id: string, title?: string) => example(id, title).querySelector("pre")!.textContent;
  const showCode = (id: string, title?: string) =>
    user.click(within(example(id, title)).getByRole("button", { name: DESIGN_SYSTEM.showCode }));
  return { user, story, example, preview, titles, code, showCode };
}

/** The option the arrow keys reached in the list `control` opens, which `control` names. */
export const keyed = (control: HTMLElement) =>
  document.getElementById(control.getAttribute("aria-activedescendant") ?? "")?.textContent ?? null;
