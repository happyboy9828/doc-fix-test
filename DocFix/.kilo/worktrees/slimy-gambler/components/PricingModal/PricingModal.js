// Pricing popup for the navbar's "Get Pro" button. It surfaces the
// same pricing table as the /pricing page in a compact modal so the
// reader never has to leave the page to compare plans, with a link
// through to the full pricing page.
//
// Modal behaviour follows the AdPopup pattern: scroll lock, Escape,
// backdrop click and a focus trap, with focus returned to the button
// that opened the popup.

"use client";

import { useEffect, useId, useRef } from "react";
import Link from "next/link";
import PricingTable from "../PricingTable/PricingTable";
import "./PricingModal.css";

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function PricingModal({ open, onClose }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const restoreRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;

    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    const gap = window.innerWidth - document.documentElement.clientWidth;

    restoreRef.current = document.activeElement;
    body.style.overflow = "hidden";
    if (gap > 0) body.style.paddingRight = `${gap}px`;
    closeRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll(FOCUSABLE) ?? []
      );
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

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
      restoreRef.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="pricing-modal"
      onClick={(event) =>
        event.target === event.currentTarget && onCloseRef.current()
      }
    >
      <div
        className="pricing-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
      >
        <div className="pricing-modal-bar">
          <div>
            <p className="pricing-modal-eyebrow">DocFix Pro</p>
            <h2 className="pricing-modal-title" id={titleId}>
              Choose your plan
            </h2>
          </div>
          <button
            type="button"
            className="pricing-modal-close"
            onClick={() => onCloseRef.current()}
            ref={closeRef}
            aria-label="Close pricing popup"
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

        <div className="pricing-modal-body">
          <PricingTable />
        </div>

        <div className="pricing-modal-foot">
          <p className="pricing-modal-note">
            Every plan runs locally in your browser — no uploads, no account
            required to try.
          </p>
          <Link
            href="/pricing"
            className="pricing-modal-full"
            onClick={() => onCloseRef.current()}
          >
            View full pricing page
            <span aria-hidden="true"> &rarr;</span>
          </Link>
        </div>
      </div>
    </div>
  );
}