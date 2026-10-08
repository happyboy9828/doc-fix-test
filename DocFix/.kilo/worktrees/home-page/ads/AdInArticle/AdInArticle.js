// Ad container 3: native in-content unit. Drops between paragraphs of an
// article, so it stays quiet: hairline rules, no card chrome, disclosure first.
// Server component, no hooks.
//
// Props: slot, label, advertiser, title, description, cta, href, creative.

import "./AdInArticle.css";

const DEFAULTS = {
  slot: "in-article",
  label: "Sponsored content",
  advertiser: "Wireframe Weekly",
  title: "How three teams cut page weight in half",
  description: "A 12 minute read on asset budgets and lazy loading.",
  cta: "Read the story",
  href: "/",
};

function initials(name) {
  return name.trim().slice(0, 2).toUpperCase();
}

export default function AdInArticle({
  slot = DEFAULTS.slot,
  label = DEFAULTS.label,
  advertiser = DEFAULTS.advertiser,
  title = DEFAULTS.title,
  description = DEFAULTS.description,
  cta = DEFAULTS.cta,
  href = DEFAULTS.href,
  creative = null,
}) {
  return (
    <aside className="ad-inline" aria-label={label} data-slot={slot}>
      <p className="ad-inline-disclosure">
        <span className="ad-inline-tag">Sponsored</span>
      </p>

      <div className="ad-inline-row">
        <span className="ad-inline-mark">
          {creative ?? initials(advertiser)}
        </span>

        <div className="ad-inline-body">
          <a
            className="ad-inline-title"
            href={href}
            target="_blank"
            rel="sponsored nofollow noopener noreferrer"
          >
            {title}
          </a>
          <p className="ad-inline-desc">{description}</p>
          <p className="ad-inline-advertiser">by {advertiser}</p>
        </div>

        <a
          className="ad-inline-cta"
          href={href}
          target="_blank"
          rel="sponsored nofollow noopener noreferrer"
        >
          {cta}
          <span aria-hidden="true">&rarr;</span>
        </a>
      </div>
    </aside>
  );
}