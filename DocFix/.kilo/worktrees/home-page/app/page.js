import Link from "next/link";
import { getPages } from "../lib/pages";

export default function Home() {
  const pages = getPages();

  return (
    <div className="home-shell">
      {/* Hero Section */}
      <header className="hero">
        <div className="hero-badge" aria-label="Privacy badge">
          <span className="badge-icon" aria-hidden="true">🔒</span>
          <span>100% Private • Zero Server Uploads</span>
        </div>

        <h1 className="hero-title">
          Fast, Secure Image Tools Right in Your Browser.
        </h1>

        <p className="hero-subtitle">
          Compress, resize, convert, and edit your images instantly. Everything runs locally
          on your device—your photos never touch a cloud server.
        </p>

        <div className="hero-cta">
          <Link
            href="/img/ImgCompresser"
            className="btn btn-primary"
            aria-label="Start compressing an image for free"
          >
            Compress an Image Free →
          </Link>
          <Link
            href="#tools"
            className="btn btn-secondary"
            aria-label="Explore all available tools"
          >
            Explore All Tools ↓
          </Link>
        </div>

        <div className="hero-trust" role="list" aria-label="Trust indicators">
          <div className="trust-item" role="listitem">
            <span className="trust-icon" aria-hidden="true">⚡</span>
            <span className="trust-text">Lightning Fast (Client-Side WASM/JS)</span>
          </div>
          <div className="trust-item" role="listitem">
            <span className="trust-icon" aria-hidden="true">🛡️</span>
            <span className="trust-text">No Data Logging</span>
          </div>
          <div className="trust-item" role="listitem">
            <span className="trust-icon" aria-hidden="true">📂</span>
            <span className="trust-text">Supports JPG, PNG, WebP, SVG</span>
          </div>
        </div>
      </header>

      {/* Tools Section */}
      <section id="tools" className="tools-section" aria-labelledby="tools-heading">
        <div className="tools-header">
          <h2 id="tools-heading" className="tools-title">
            All Image Tools
          </h2>
          <p className="tools-subtitle">
            {pages.length} browser-based tools. No installs. No uploads. No limits.
          </p>
        </div>

        {pages.length === 0 ? (
          <p className="tool-muted" style={{ textAlign: "center", padding: "40px 0" }}>
            No tools found. Add a folder under <code>app/</code> containing a
            <code>page.js</code> file and it will show up here.
          </p>
        ) : (
          <ul className="tools-grid" role="list">
            {pages.map((page) => (
              <li key={page.href} className="tool-card">
                <Link href={page.href} className="tool-link-card">
                  <span className="tool-link-title">
                    {page.title}
                    <span aria-hidden="true">→</span>
                  </span>
                  <span className="tool-link-desc">{page.description}</span>
                  <span className="tool-link-href">{page.href}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}