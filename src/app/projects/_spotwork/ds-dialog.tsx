"use client";

import { Children, cloneElement, isValidElement, useCallback, useEffect, useState, type ReactElement, type ReactNode } from "react";
import { SNACKS } from "./copy";
import { defineStory } from "./ds-story";
import { Div } from "./ds-tailwind";
import { Snackbar } from "./shifts-page";
import { postedMessage } from "./shifts";
import { Presence } from "./ui";

// SW Curie's Dialog page (1787:1821): its snackbar, alone and stacked, each back a moment after it closes.

const AGAIN_MS = 1000;

/** Shown, and shown again a moment after it closes. */
function useShownAgain() {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    if (shown) return;
    const id = window.setTimeout(() => setShown(true), AGAIN_MS);
    return () => window.clearTimeout(id);
  }, [shown]);
  const close = useCallback(() => setShown(false), []);
  return [shown, close] as const;
}

type AgainProps = { children: ReactElement<{ onClose?: () => void }> };

/** Its snackbar, gone (through `Presence`) once it closes and back a moment later. */
function ShownAgain({ children }: AgainProps) {
  const [shown, close] = useShownAgain();
  return <Presence>{shown && cloneElement(children, { onClose: close })}</Presence>;
}

// The code view shows the snackbar alone, which closes itself.
ShownAgain.unwrap = ({ children }: AgainProps) => children;

type StackProps = { children: ReactElement<{ children: ReactNode }> };

/** A stack whose snackbars each come back, newest, a moment after they close. */
function KeptStacked({ children: stack }: StackProps) {
  const all = Children.toArray(stack.props.children).filter(isValidElement<{ onClose?: () => void }>);
  const [order, setOrder] = useState(() => all.map((snackbar) => String(snackbar.key)));
  const [gone, setGone] = useState<string[]>([]);
  useEffect(() => {
    if (gone.length === 0) return;
    const id = window.setTimeout(() => {
      setOrder((now) => [...now, gone[0]]);
      setGone((now) => now.slice(1));
    }, AGAIN_MS);
    return () => window.clearTimeout(id);
  }, [gone]);
  const close = (key: string) => {
    setOrder((now) => now.filter((shown) => shown !== key));
    setGone((now) => [...now, key]);
  };
  return cloneElement(
    stack,
    {},
    order.map((key) => cloneElement(all.find((snackbar) => String(snackbar.key) === key)!, { onClose: () => close(key) })),
  );
}

// The code view shows the stack alone, its snackbars closing themselves.
KeptStacked.unwrap = ({ children }: StackProps) => children;

export const SNACKBAR = defineStory({
  id: "Snackbar",
  figma: "Molecules/Snackbar",
  examples: [
    {
      layout: "fill",
      // At the foot of what holds it, its 44px over 24px either side.
      render: () => (
        <Div tw="relative h-[5.75rem] w-full">
          <ShownAgain>
            <Snackbar>
              {SNACKS.invitationSent}
              <Snackbar.Close />
            </Snackbar>
          </ShownAgain>
        </Div>
      ),
    },
    {
      title: "Stacked",
      layout: "fill",
      // Room for the three spread out while pointed at.
      render: () => (
        <Div tw="relative h-[13.5rem] w-full">
          <KeptStacked>
            <Snackbar.Stack>
              <Snackbar key="posted">
                {postedMessage(4)}
                <Snackbar.Close />
              </Snackbar>
              <Snackbar key="sent">
                {SNACKS.invitationSent}
                <Snackbar.Close />
              </Snackbar>
              <Snackbar key="copied">
                {SNACKS.linkCopied}
                <Snackbar.Close />
              </Snackbar>
            </Snackbar.Stack>
          </KeptStacked>
        </Div>
      ),
    },
  ],
});
