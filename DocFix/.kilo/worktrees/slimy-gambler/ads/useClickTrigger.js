"use client";

import { useEffect, useRef } from "react";

// Counts real left clicks anywhere on the page and calls `onReach` on the Nth
// one. Shared by the click-triggered units (AdOnClick, AdPushNotification) so
// they agree on what a "real" click is:
//
//   - a click carrying cmd/ctrl/shift/alt is skipped, because the reader is
//     opening something in a new tab and interrupting that is a bug;
//   - a click inside a `[data-download]` control is skipped: a
//     download must start the instant its button is pressed, so no
//     click-triggered unit may open on it or be advanced by it;
//   - a click that starts inside `ignoreRef` is skipped, so a unit never counts
//     the reader closing or clicking through it;
//   - only the first `count` clicks are counted, so the unit cannot follow the
//     reader around the page after it has fired.
//
// The listener is in the capture phase, so it runs before any navigation the
// click triggers. It subscribes once per configuration change: `onReach` is held
// in a ref, because an inline arrow passed from a parent would otherwise rebuild
// the listener on every render and reset the count.

export default function useClickTrigger({
  enabled = true,
  count = 3,
  ignoreRef = null,
  onReach = null,
}) {
  const reachRef = useRef(onReach);

  useEffect(() => {
    reachRef.current = onReach;
  }, [onReach]);

  useEffect(() => {
    if (!enabled) return;

    let left = Math.max(1, count);
    const onClick = (event) => {
      if (event.button > 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (ignoreRef?.current?.contains(event.target)) return;
      if (event.target instanceof Element && event.target.closest("[data-download]")) return;

      left -= 1;
      if (left <= 0) {
        document.removeEventListener("click", onClick, true);
        reachRef.current?.();
      }
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [enabled, count, ignoreRef]);
}
