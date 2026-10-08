// Popup advertisement: a modal unit that opens on a trigger, traps focus and
// can be dismissed three ways (close button, Escape, backdrop click). Shown at
// most once per browser tab unless oncePerSession is turned off.
//
// Props:
//   enabled          render nothing when false                      (true)
//   trigger          "delay" | "scroll" | "exitIntent"             ("delay")
//   delayMs          delay before opening, trigger "delay"          (6000)
//   scrollPercent    scroll depth before opening, trigger "scroll"  (55)
//   oncePerSession   show once per browser tab                     (true)
//   sessionKey       sessionStorage key for that memory            ("ads:popup")
//   onImpression     called once, when the popup is shown
//   onDismiss        called when the reader closes or clicks through
//   slot, label, advertiser, title, description, cta, href, creative
//
// Mount it once per page: the trigger guards make repeat mounts inert.

"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useOverlaySlot } from "../overlay";
import "./AdPopup.css";

const DEFAULTS = {
  slot: "popup",
  label: "Advertisement",
  advertiser: "PixelForge Pro",
  title: "Convert a whole folder in one pass",
  description: "Drop up to 200 files and let the queue handle formats and sizes.",
  cta: "Open PixelForge",
  href: "/",
  delayMs: 6000,
  scrollPercent: 55,
  sessionKey: "ads:popup",
};

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

function initials(name) {
  return name.trim().slice(0, 2).toUpperCase();
}

// sessionStorage can throw when storage is blocked or the tab is in private
// mode. Treat that as "not seen" so the popup still shows; it only costs one
// extra impression per reload instead of the ad never appearing.
function seenThisSession(key) {
  try {
    return window.sessionStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

function rememberSession(key) {
  try {
    window.sessionStorage.setItem(key, String(Date.now()));
  } catch {
    // Same as above: failing to remember cannot break the popup.
  }
}

export default function AdPopup({
  enabled = true,
  trigger = "delay",
  delayMs = DEFAULTS.delayMs,
  scrollPercent = DEFAULTS.scrollPercent,
  oncePerSession = true,
  sessionKey = DEFAULTS.sessionKey,
  slot = DEFAULTS.slot,
  label = DEFAULTS.label,
  advertiser = DEFAULTS.advertiser,
  title = DEFAULTS.title,
  description = DEFAULTS.description,
  cta = DEFAULTS.cta,
  href = DEFAULTS.href,
  creative = null,
  onImpression = null,
  onDismiss = null,
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const restoreRef = useRef(null);
  const shownRef = useRef(false);
  const titleId = useId();
  const descId = useId();
  // One modal surface at a time: if AdOnClick is already open this
  // unit stands down and picks the surface up once that one closes.
  const blocked = useOverlaySlot(`popup:${slot}`, open);

  const show = useCallback(() => {
    if (shownRef.current) return;
    if (oncePerSession) {
      if (seenThisSession(sessionKey)) {
        shownRef.current = true;
        return;
      }
      rememberSession(sessionKey);
    }
    shownRef.current = true;
    setOpen(true);
    onImpression?.();
  }, [oncePerSession, sessionKey, onImpression]);

  const close = useCallback(() => {
    setOpen(false);
    onDismiss?.();
  }, [onDismiss]);

  // Trigger: waits, scroll depth or the pointer leaving through the top edge.
  useEffect(() => {
    if (!enabled) return;

    if (trigger === "scroll") {
      const onScroll = () => {
        const root = document.documentElement;
        const scrollable = root.scrollHeight - root.clientHeight;
        if (scrollable <= 0) return;
        if ((root.scrollTop / scrollable) * 100 >= scrollPercent) show();
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
      return () => window.removeEventListener("scroll", onScroll);
    }

    if (trigger === "exitIntent") {
      const onMouseOut = (event) => {
        // relatedTarget null means the pointer left the document.
        if (event.relatedTarget === null && event.clientY <= 8) show();
      };
      document.addEventListener("mouseout", onMouseOut);
      return () => document.removeEventListener("mouseout", onMouseOut);
    }

    const timer = window.setTimeout(show, Math.max(0, delayMs));
    return () => window.clearTimeout(timer);
  }, [enabled, trigger, delayMs, scrollPercent, show]);

  // Modal behaviour while open: scroll lock, Escape, focus trap, focus restore.
  useEffect(() => {
    if (!open || blocked) return;

    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    // Locking overflow removes the scrollbar; pad it back so the page does not
    // jump sideways under the overlay.
    const gap = window.innerWidth - document.documentElement.clientWidth;

    restoreRef.current = document.activeElement;
    body.style.overflow = "hidden";
    if (gap > 0) body.style.paddingRight = `${gap}px`;
    closeRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(dialogRef.current?.querySelectorAll(FOCUSABLE) ?? []);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
      // Hand focus back to whatever opened the popup.
      restoreRef.current?.focus?.();
    };
  }, [open, blocked, close]);

  if (!open || blocked) return null;

  return (
    <div className="ad-popup" onClick={(event) => event.target === event.currentTarget && close()}>
      <div
        className="ad-popup-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-labelledby={titleId}
        aria-describedby={descId}
        data-slot={slot}
        ref={dialogRef}
      >
        <div className="ad-popup-bar">
          <span className="ad-popup-label">Ad</span>
          <button
            type="button"
            className="ad-popup-close"
            onClick={close}
            ref={closeRef}
            aria-label="Close advertisement"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path
                d="M4 4l8 8M12 4l-8 8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="ad-popup-creative">
          {creative ?? <span className="ad-popup-mark">{initials(advertiser)}</span>}
        </div>

        <div className="ad-popup-body">
          <p className="ad-popup-advertiser">{advertiser}</p>
          <h2 className="ad-popup-title" id={titleId}>
            {title}
          </h2>
          <p className="ad-popup-desc" id={descId}>
            {description}
          </p>
        </div>

        <div className="ad-popup-actions">
          <a
            className="ad-popup-cta"
            href={href}
            target="_blank"
            rel="sponsored nofollow noopener noreferrer"
            onClick={close}
          >
            {cta}
          </a>
          <button type="button" className="ad-popup-dismiss" onClick={close}>
            No thanks
          </button>
        </div>
      </div>
    </div>
  );
}