// Ad container 6: web push notification. Asks for Notification permission and,
// once it is granted, delivers the creative as a real system notification.
//
// Permission is never requested on load. A prompt fired without a user gesture
// is a bad-practice pattern that readers reflexively deny, so the unit waits for
// a trigger (delay / exit intent / Nth click) and then shows a small consent
// card whose button performs the request inside a click handler. Three outcomes:
//
//   granted  the notification is sent straight away, no card is shown
//   default  the consent card appears
//   denied   nothing is rendered, and the card does not come back on this device
//
// Only the card has state; the permission itself is read as external state, so
// "denied" and "unsupported" need no branch to keep in sync.
// `new Notification` is used because the app ships no service worker. Swapping
// in `navigator.serviceWorker.ready.then(reg => reg.showNotification(...))`
// is the only change needed once a worker exists.
//
// Props:
//   enabled, trigger, delayMs, clicks, dismissible, storageKey,
//   slot, label, advertiser, title, description, cta, href, icon, badge, tag,
//   requireInteraction, silent, onPermission, onImpression, onDismiss

"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import useClickTrigger from "../useClickTrigger";
import "./AdPushNotification.css";

const DEFAULTS = {
  slot: "push",
  label: "Notification",
  advertiser: "PixelForge Pro",
  title: "Convert a whole folder in one pass",
  description: "Drop up to 200 files and let the queue handle formats and sizes.",
  cta: "Allow",
  href: "/",
  trigger: "delay",
  delayMs: 15000,
  clicks: 4,
  storageKey: "ads:push:declined",
};

// Notification.permission is external state, so it is read through
// useSyncExternalStore. The server snapshot keeps the first client render in step
// with the server's, and the real value arrives right after hydration.
const noopSubscribe = () => () => {};

function readPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

function useNotificationPermission() {
  return useSyncExternalStore(noopSubscribe, readPermission, () => "unknown");
}

function readFlag(key) {
  try {
    return window.localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

function writeFlag(key) {
  try {
    window.localStorage.setItem(key, String(Date.now()));
  } catch {
    // Failing to remember only costs one extra card per visit.
  }
}

export default function AdPushNotification({
  enabled = true,
  trigger = DEFAULTS.trigger,
  delayMs = DEFAULTS.delayMs,
  clicks = DEFAULTS.clicks,
  dismissible = true,
  storageKey = DEFAULTS.storageKey,
  slot = DEFAULTS.slot,
  label = DEFAULTS.label,
  advertiser = DEFAULTS.advertiser,
  title = DEFAULTS.title,
  description = DEFAULTS.description,
  cta = DEFAULTS.cta,
  href = DEFAULTS.href,
  icon = null,
  badge = null,
  tag = null,
  requireInteraction = false,
  silent = false,
  onPermission = null,
  onImpression = null,
  onDismiss = null,
}) {
  // The consent card is the only thing this component renders, and only while
  // the permission is genuinely undecided: "denied" and "unsupported" fall
  // through to nothing without a state machine to keep in sync.
  const [asking, setAsking] = useState(false);
  const cardRef = useRef(null);
  const sentRef = useRef(false);
  const permission = useNotificationPermission();

  const send = useCallback(() => {
    if (sentRef.current) return;
    sentRef.current = true;
    onImpression?.();

    try {
      const notification = new Notification(title, {
        body: description,
        icon: icon ?? undefined,
        badge: badge ?? undefined,
        tag: tag ?? slot,
        requireInteraction,
        silent,
      });

      notification.onclick = () => {
        window.focus();
        if (href) window.location.href = href;
        notification.close();
      };
    } catch {
      // Some browsers expose the constructor but refuse outside a service
      // worker context. Nothing to recover, so just stay quiet.
    }
  }, [description, href, icon, badge, tag, slot, requireInteraction, silent, title, onImpression]);

  // Already-permitted readers get the notification with no prompt and no card.
  useEffect(() => {
    if (!enabled) return;
    if (permission === "granted") send();
  }, [enabled, permission, send]);

  // The card only appears once the reader has stayed long enough, or on the way
  // out, or after a few clicks. The request itself still happens from the button
  // below, inside a real click.
  const showCard = useCallback(() => {
    if (sentRef.current || readFlag(storageKey)) return;
    setAsking(true);
  }, [storageKey]);

  useClickTrigger({
    enabled: enabled && trigger === "click",
    count: clicks,
    ignoreRef: cardRef,
    onReach: showCard,
  });

  useEffect(() => {
    if (!enabled || trigger !== "delay") return;
    const timer = window.setTimeout(showCard, Math.max(0, delayMs));
    return () => window.clearTimeout(timer);
  }, [enabled, trigger, delayMs, showCard]);

  useEffect(() => {
    if (!enabled || trigger !== "exitIntent") return;
    const onMouseOut = (event) => {
      // relatedTarget null means the pointer left the document.
      if (event.relatedTarget === null && event.clientY <= 8) showCard();
    };
    document.addEventListener("mouseout", onMouseOut);
    return () => document.removeEventListener("mouseout", onMouseOut);
  }, [enabled, trigger, showCard]);

  const ask = async () => {
    setAsking(false);
    try {
      const result = await Notification.requestPermission();
      onPermission?.(result);
      writeFlag(storageKey);

      if (result === "granted") {
        send();
        return;
      }
      onDismiss?.();
    } catch {
      onDismiss?.();
    }
  };

  const decline = () => {
    writeFlag(storageKey);
    setAsking(false);
    onDismiss?.();
  };

  if (!asking || permission !== "default") return null;

  return (
    <aside
      className="ad-push"
      aria-label={label}
      data-slot={slot}
      ref={cardRef}
    >
      <span className="ad-push-mark" aria-hidden="true">
        {advertiser.trim().slice(0, 2).toUpperCase()}
      </span>

      <div className="ad-push-body">
        <p className="ad-push-meta">
          <span className="ad-push-label">Ad</span>
          <span className="ad-push-advertiser">{advertiser}</span>
        </p>
        <p className="ad-push-title">{title}</p>
        <p className="ad-push-desc">{description}</p>
      </div>

      <div className="ad-push-actions">
        <button type="button" className="ad-push-cta" onClick={ask}>
          {cta}
        </button>
        {dismissible ? (
          <button type="button" className="ad-push-decline" onClick={decline}>
            No thanks
          </button>
        ) : null}
      </div>
    </aside>
  );
}
