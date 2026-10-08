// Ad container 5: click-to-open interstitial, the "onclick" format. Instead of
// firing on a timer it counts real clicks on the page and opens on the Nth one,
// optionally behind a visible countdown.
//
// Rules that keep the format from becoming a bug: modified clicks are never
// counted (a reader opening a link in a new tab is not interrupted), the count
// stops at the Nth click, the countdown is cancelable at any point, and the
// unit shares the overlay registry so it never stacks on AdPopup.
//
// Props:
//   enabled          render nothing when false                      (true)
//   clicks           clicks before the unit appears                 (3)
//   countdownMs      "ad in N" countdown, 0 opens immediately       (3000)
//   forceOpen        when the countdown ends, open href in a tab    (false)
//   oncePerSession   show once per browser tab                     (true)
//   sessionKey       sessionStorage key for that memory       ("ads:onclick")
//   slot, label, advertiser, title, description, cta, href, creative
//   onImpression     called once, when the unit opens
//   onDismiss        called when the reader closes or clicks through
//
// Mount it once per page: the click counter stops itself after firing.

"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import useClickTrigger from "../useClickTrigger";
import { useOverlaySlot } from "../overlay";
import "./AdOnClick.css";

const DEFAULTS = {
  slot: "onclick",
  label: "Advertisement",
  advertiser: "PixelForge Pro",
  title: "One more format, one more tool",
  description: "Everything runs in this tab, so no file is ever uploaded.",
  cta: "Browse the tools",
  href: "/",
  clicks: 3,
  countdownMs: 3000,
  sessionKey: "ads:onclick",
};

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

function initials(name) {
  return name.trim().slice(0, 2).toUpperCase();
}

// Storage can throw when it is blocked or the tab is private. Treat a failure to
// read as "not seen": the unit shows, costing one extra impression per reload.
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
    // Failing to remember cannot break the unit.
  }
}

export default function AdOnClick({
  enabled = true,
  clicks = DEFAULTS.clicks,
  countdownMs = DEFAULTS.countdownMs,
  forceOpen = false,
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
  const [remaining, setRemaining] = useState(countdownMs);
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const restoreRef = useRef(null);
  const shownRef = useRef(false);
  const titleId = useId();
  const descId = useId();
  const blocked = useOverlaySlot(`onclick:${slot}`, open);

  const close = useCallback(() => {
    setOpen(false);
    onDismiss?.();
  }, [onDismiss]);

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
    setRemaining(Math.max(0, countdownMs));
    setOpen(true);
    onImpression?.();
  }, [oncePerSession, sessionKey, countdownMs, onImpression]);

  useClickTrigger({ enabled, count: clicks, ignoreRef: dialogRef, onReach: show });

  // Countdown. The call to action stays inert until it reaches zero, and with
  // forceOpen the unit can hand the reader off to the advertiser at that point.
  useEffect(() => {
    if (!open || countdownMs <= 0) return;

    const started = Date.now();
    const timer = window.setInterval(() => {
      const left = Math.max(0, countdownMs - (Date.now() - started));
      setRemaining(left);
      if (left > 0) return;
      window.clearInterval(timer);
      if (forceOpen) window.open(href, "_blank", "noopener,noreferrer");
    }, 200);

    return () => window.clearInterval(timer);
  }, [open, countdownMs, forceOpen, href]);

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
      // Hand focus back to whatever opened the unit.
      restoreRef.current?.focus?.();
    };
  }, [open, blocked, close]);

  if (!open || blocked) return null;

  const waiting = remaining > 0;
  const seconds = Math.ceil(remaining / 1000);
  const progress = countdownMs > 0 ? ((countdownMs - remaining) / countdownMs) * 100 : 100;

  return (
    <div
      className="ad-onclick"
      onClick={(event) => event.target === event.currentTarget && close()}
    >
      <div
        className="ad-onclick-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-labelledby={titleId}
        aria-describedby={descId}
        data-slot={slot}
        ref={dialogRef}
      >
        <div className="ad-onclick-bar">
          <span className="ad-onclick-label">Ad</span>
          <button
            type="button"
            className="ad-onclick-close"
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

        <div className="ad-onclick-creative">
          {creative ?? <span className="ad-onclick-mark">{initials(advertiser)}</span>}
        </div>

        <div className="ad-onclick-body">
          <p className="ad-onclick-advertiser">{advertiser}</p>
          <h2 className="ad-onclick-title" id={titleId}>
            {title}
          </h2>
          <p className="ad-onclick-desc" id={descId}>
            {description}
          </p>
        </div>

        <div className="ad-onclick-actions">
          {waiting ? (
            // A span, not a disabled link: an inert call to action must not be
            // reachable by keyboard while the countdown runs.
            <span className="ad-onclick-cta is-waiting" aria-hidden="true">
              {cta}
            </span>
          ) : (
            <a
              className="ad-onclick-cta"
              href={href}
              target="_blank"
              rel="sponsored nofollow noopener noreferrer"
              onClick={close}
            >
              {cta}
            </a>
          )}
          <button type="button" className="ad-onclick-dismiss" onClick={close}>
            No thanks
          </button>
        </div>

        {countdownMs > 0 ? (
          <div className="ad-onclick-countdown">
            <span className="ad-onclick-countdown-text">
              {waiting ? `Opening in ${seconds}s` : "You can close this at any time"}
            </span>
            <span className="ad-onclick-countdown-track">
              <span
                className="ad-onclick-countdown-bar"
                style={{ width: `${progress}%` }}
              />
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
