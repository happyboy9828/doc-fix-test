// 404. Rendered inside the shared document shell, so it keeps the navbar, the ad
// rail and the .tool-page rhythm every other route uses, and it lists the same
// tool cards the home page does: a reader who lands here with a dead link should
// still have somewhere to go in one click.

import Link from "next/link";
import PageCard from "../components/PageCard/PageCard";
import NotFoundPath from "../components/NotFoundPath/NotFoundPath";
import { getPages } from "../lib/pages";
import "./not-found.css";

const SUGGESTION = "/ImgCompresser";

export default function NotFound() {
  const pages = getPages();
  const suggestion = pages.find((page) => page.href === SUGGESTION) ?? pages[0];

  return (
    <div className="tool-page nf">
      <section className="nf-hero">
        <svg
          className="nf-art"
          viewBox="0 0 220 140"
          role="img"
          aria-label="A dotted path leading to a crossed-out point"
        >
          <rect
            x="8"
            y="8"
            width="204"
            height="124"
            rx="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="6 7"
            opacity="0.3"
          />
          <path
            d="M30 112C68 74 118 122 186 36"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="4 8"
            strokeLinecap="round"
            opacity="0.5"
          />
          <circle
            cx="186"
            cy="36"
            r="13"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            opacity="0.7"
          />
          <path
            d="M181 31l10 10M191 31l-10 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>

        <p className="nf-code" aria-hidden="true">
          404
        </p>
        <h1 className="nf-title">This page went missing</h1>
        <p className="nf-lead">
          The address does not match anything in the app. Nothing was deleted, so
          the tools below all still work.
        </p>

        <NotFoundPath />

        <div className="nf-actions">
          <Link href="/" className="tool-btn nf-btn-primary">
            Back to all tools
          </Link>
          {suggestion ? (
            <Link href={suggestion.href} className="tool-btn nf-btn-ghost">
              {suggestion.title}
              <span aria-hidden="true">&rarr;</span>
            </Link>
          ) : null}
        </div>
      </section>

      <section className="nf-list" aria-labelledby="nf-list-title">
        <h2 className="nf-list-title" id="nf-list-title">
          Everything in the app
        </h2>
        {pages.length === 0 ? (
          <p className="tool-empty">No tools are registered yet.</p>
        ) : (
          <ul className="tool-cards">
            {pages.map((page) => (
              <li key={page.href}>
                <PageCard href={page.href} title={page.title} description={page.description} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
