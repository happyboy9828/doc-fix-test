// Ad container 1: horizontal leaderboard. Sits at the top of a page or between
// two sections and spans the full content width. Server component, no hooks.
//
// Props: slot, label, advertiser, title, description, cta, href, creative.
// `creative` is an escape hatch for a real ad tag; without it the unit renders
// the advertiser's initials, which keeps the layout reserved while no creative
// is being served.

import "./AdBanner.css";

const DEFAULTS = {
  slot: "leaderboard",
  label: "Advertisement",
  advertiser: "PixelForge",
  title: "Batch convert images without the upload",
  description: "Run every format in one browser-only queue.",
  cta: "Try it free",
  href: "/",
};

function initials(name) {
  return name.trim().slice(0, 2).toUpperCase();
}

export default function AdBanner({
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
    <aside className="ad-banner" aria-label={label} data-slot={slot}>
      <div className="ad-banner-main">
        <div className="ad-banner-creative">
          {creative ?? <span className="ad-banner-mark">{initials(advertiser)}</span>}
        </div>

        <div className="ad-banner-body">
          <p className="ad-banner-meta">
            <span className="ad-banner-label">Ad</span>
            <span className="ad-banner-advertiser">{advertiser}</span>
          </p>
          <a
            className="ad-banner-title"
            href={href}
            target="_blank"
            rel="sponsored nofollow noopener noreferrer"
          >
            {title}
          </a>
          <p className="ad-banner-desc">{description}</p>
        </div>
      </div>

      <a
        className="ad-banner-cta"
        href={href}
        target="_blank"
        rel="sponsored nofollow noopener noreferrer"
      >
        {cta}
        <span aria-hidden="true">&rarr;</span>
      </a>
    </aside>
  );
}