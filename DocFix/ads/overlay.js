"use client";

import { useEffect, useState } from "react";

// One modal surface at a time. AdPopup and AdOnClick both open on timers or
// scroll events, so two of them can become ready in the same frame. Without a
// registry the reader gets stacked overlays: two backdrops, two focus traps,
// two Escape handlers. A unit that loses the race waits for the surface to
// free up instead of dropping the impression, so nothing silently vanishes.

let holder = null;
const waiting = new Set();

export function acquireOverlay(id) {
  if (holder === id) return true;
  if (holder) return false;
  holder = id;
  return true;
}

export function releaseOverlay(id) {
  if (holder !== id) return;
  holder = null;
  for (const retry of [...waiting]) retry();
}

// `open` drives the claim, the returned flag is true while this unit lost the
// surface and is therefore rendering nothing.
export function useOverlaySlot(id, open) {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!open) return;

    let disposed = false;
    const claim = () => {
      if (disposed) return;
      setBlocked(!acquireOverlay(id));
    };

    claim();
    waiting.add(claim);
    return () => {
      disposed = true;
      waiting.delete(claim);
      releaseOverlay(id);
    };
  }, [id, open]);

  return blocked;
}
