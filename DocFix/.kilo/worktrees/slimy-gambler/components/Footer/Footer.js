import Link from "next/link";
import Logo from "../Logo/Logo";
import { getCategories } from "../../lib/pages";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
];

const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/faq", label: "FAQ" },
  { href: "/docs", label: "Docs" },
];

// Shared list renderers so the static desktop columns and the
// mobile accordions always show exactly the same items.
function FooterLinks({ links }) {
  return (
    <ul className="tool-footer-list">
      {links.map((link) => (
        <li key={link.href}>
          <Link href={link.href} className="tool-footer-link">
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function FooterCategories({ categories }) {
  return (
    <ul className="tool-footer-list tool-footer-categories">
      {categories.map((category) => (
        <li key={category.name} className="tool-footer-category-name">
          {category.name}
        </li>
      ))}
    </ul>
  );
}

export default function Footer() {
  const year = new Date().getFullYear();
  const categories = getCategories();

  // Each section renders twice: a static .tool-footer-section
  // column for desktop (every list always expanded) and a native
  // <details> accordion for narrow screens (collapsed until
  // tapped). CSS shows only one variant per viewport, so the
  // hidden copy never renders visually.
  return (
    <footer className="tool-footer" role="contentinfo">
      <div className="tool-footer-inner">
        <div className="tool-footer-brand">
          <Link href="/" className="tool-footer-logo" aria-label="DocFix — home">
            <Logo className="tool-footer-logo-mark" />
          </Link>
          <p className="tool-footer-tag">
            Browser-only image tools. No uploads leave your device.
          </p>
        </div>

        <section className="tool-footer-section">
          <h2 className="tool-footer-heading">Navigation</h2>
          <FooterLinks links={NAV_LINKS} />
        </section>

        <section className="tool-footer-section">
          <h2 className="tool-footer-heading">Popular Category</h2>
          <FooterCategories categories={categories} />
        </section>

        <section className="tool-footer-section">
          <h2 className="tool-footer-heading">Legal &amp; Support</h2>
          <FooterLinks links={LEGAL_LINKS} />
        </section>

        <details className="tool-footer-accordion">
          <summary className="tool-footer-accordion-head">
            <h2 className="tool-footer-heading">Navigation</h2>
            <span className="tool-footer-chevron" aria-hidden="true">
              ▾
            </span>
          </summary>
          <FooterLinks links={NAV_LINKS} />
        </details>

        <details className="tool-footer-accordion">
          <summary className="tool-footer-accordion-head">
            <h2 className="tool-footer-heading">Popular Category</h2>
            <span className="tool-footer-chevron" aria-hidden="true">
              ▾
            </span>
          </summary>
          <FooterCategories categories={categories} />
        </details>

        <details className="tool-footer-accordion">
          <summary className="tool-footer-accordion-head">
            <h2 className="tool-footer-heading">Legal &amp; Support</h2>
            <span className="tool-footer-chevron" aria-hidden="true">
              ▾
            </span>
          </summary>
          <FooterLinks links={LEGAL_LINKS} />
        </details>
      </div>

      <div className="tool-footer-meta">
        <span>© {year} DocFix</span>
        <span className="tool-footer-sep" aria-hidden="true">
          •
        </span>
        <span>All processing happens locally in your browser.</span>
      </div>
    </footer>
  );
}
