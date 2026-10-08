import Link from "next/link";

const ALL_TOOL_CATEGORIES = [
  {
    name: "Image & Format Tools",
    tools: [
      {
        title: "JPG to PNG",
        description: "Convert JPG images to lossless PNG with optional 8-bit indexed colour and white edge removal.",
        href: "/img/JpgToPng",
      },
      {
        title: "PNG to JPG",
        description: "Convert PNG graphics to JPG, filling transparent areas with white, black or a custom hex colour.",
        href: "/img/PngToJpg",
      },
      {
        title: "WebP to PNG",
        description: "Convert WebP images to PNG in batches, preserving transparency or replacing it with a solid colour.",
        href: "/img/WebpToPng",
      },
      {
        title: "Image to Base64",
        description: "Encode an image as a data URL, HTML tag, CSS background or raw Base64 string.",
        href: "/img/ImgToBase64",
      },
    ],
  },
  {
    name: "Optimization & Editing",
    tools: [
      {
        title: "Compress Image",
        description: "Shrink image file sizes with a quality slider, a target size limit and batch ZIP download.",
        href: "/img/ImgCompresser",
      },
      {
        title: "Remove BG",
        description: "Remove an image background automatically, then refine it with erase and restore brushes.",
        href: "/img/BGRemove",
      },
      {
        title: "Image Resizer",
        description: "Resize photos to exact pixel dimensions or crop them to an aspect ratio, with unit, DPI and format control.",
        href: "/img/ImageResizer",
      },
      {
        title: "Watermark",
        description: "Protect your images with custom text or image watermarks.",
        href: "/img/Watermark",
      },
      {
        title: "Favicon Generator",
        description: "Build favicon.ico, PWA icons and a web manifest from one image, with a ready-made head snippet.",
        href: "/img/FavIcon",
      },
    ],
  },
];

// Homepage showcase: the six most-used tools as interactive cards.
// The full catalogue (every route under app/) lives at /tools.
const FEATURED_TOOLS = [
  {
    title: "Compress Image",
    description:
      "Shrink image file sizes with a quality slider and target size limit.",
    href: "/img/ImgCompresser",
  },
  {
    title: "Remove BG",
    description:
      "Automatically remove backgrounds, then refine with brushes.",
    href: "/img/BGRemove",
  },
  {
    title: "Image Resizer",
    description:
      "Resize photos to exact pixel dimensions or crop to aspect ratios.",
    href: "/img/ImageResizer",
  },
  {
    title: "JPG to PNG / WebP Converter",
    description: "Batch convert image formats instantly.",
    href: "/img/JpgToPng",
  },
  {
    title: "Favicon Generator",
    description: "Build favicon.ico, PWA icons, and web manifests.",
    href: "/img/FavIcon",
  },
  {
    title: "Watermark",
    description: "Protect your images with custom text or image watermarks.",
    href: "/img/Watermark",
  },
];

export default function Home() {
  return (
    <div className="home-shell">
      {/* Section 1: Hero */}
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

      {/* Section 2: Most Popular Tools — directly below the hero */}
      <section
        id="tools"
        className="popular-section"
        aria-labelledby="popular-heading"
      >
        <div className="tools-header">
          <h2 id="popular-heading" className="tools-title">
            Most Popular Tools
          </h2>
          <p className="tools-subtitle">
            The six tools our users reach for most. No installs. No uploads.
            No limits.
          </p>
        </div>

        <ul className="popular-grid" role="list">
          {FEATURED_TOOLS.map((tool) => (
            <li key={tool.href} className="popular-card-item">
              <Link href={tool.href} className="popular-card">
                <span className="popular-card-title">{tool.title}</span>
                <span className="popular-card-desc">{tool.description}</span>
                <span className="popular-card-cta">
                  Open Tool <span aria-hidden="true">→</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Section 3: Why Choose DocFix? — feature/benefit highlights */}
      <section
        id="why"
        className="why-section"
        aria-labelledby="why-heading"
      >
        <div className="why-header">
          <h2 id="why-heading" className="why-title">
            Why Developers &amp; Designers Choose DocFix
          </h2>
          <p className="why-subtitle">
            Built for people who care about their data and their time.
          </p>
        </div>

        <div className="why-grid">
          <article className="why-card">
            <span className="why-icon" aria-hidden="true">🛡️</span>
            <h3 className="why-card-title">Absolute Privacy</h3>
            <p className="why-card-desc">
              Because processing happens 100% locally in your browser, no uploads
              leave your device. Perfect for sensitive or proprietary images.
            </p>
          </article>

          <article className="why-card">
            <span className="why-icon" aria-hidden="true">🚀</span>
            <h3 className="why-card-title">Instant Speed</h3>
            <p className="why-card-desc">
              No waiting for files to upload to a remote server or download back.
              Results render in milliseconds using client-side processing.
            </p>
          </article>

          <article className="why-card">
            <span className="why-icon" aria-hidden="true">💸</span>
            <h3 className="why-card-title">Free &amp; No Friction</h3>
            <p className="why-card-desc">
              No bloated sign-ups or hidden fees for basic tasks. Open the
              browser tab and get to work.
            </p>
          </article>
        </div>
      </section>

      {/* Section 4: Complete Directory / All Tools */}
      <section
        id="all-tools"
        className="directory-section"
        aria-labelledby="directory-heading"
      >
        <div className="directory-header">
          <h2 id="directory-heading" className="directory-title">
            Explore the Full Toolkit
          </h2>
          <p className="directory-subtitle">
            All {ALL_TOOL_CATEGORIES.reduce((n, c) => n + c.tools.length, 0)} browser-only utilities, organized by what you need.
          </p>
        </div>

        <div className="directory-accordion">
          {ALL_TOOL_CATEGORIES.map((category) => (
            <details key={category.name} className="directory-category">
              <summary className="directory-category-head">
                <span className="directory-category-name">{category.name}</span>
                <span className="directory-category-count">{category.tools.length} tools</span>
                <span className="directory-chevron" aria-hidden="true">▾</span>
              </summary>
              <ul className="directory-tools-list" role="list">
                {category.tools.map((tool) => (
                  <li key={tool.href} className="directory-tool-item">
                    <Link href={tool.href} className="directory-tool-card">
                      <span className="directory-tool-title">{tool.title}</span>
                      <span className="directory-tool-desc">{tool.description}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </section>

      {/* Section 5: Final CTA & Trust Footer */}
      <section
        id="cta"
        className="cta-section"
        aria-labelledby="cta-heading"
      >
        <div className="cta-box">
          <h2 id="cta-heading" className="cta-title">
            Ready to edit your images securely?
          </h2>
          <p className="cta-subtitle">
            No uploads. No sign-up. No limits on basic tasks.
          </p>
          <Link
            href="/img/ImgCompresser"
            className="cta-btn"
            aria-label="Get started with a free image tool"
          >
            Get Started Now — It's Free
          </Link>
        </div>
      </section>
    </div>
  );
}
