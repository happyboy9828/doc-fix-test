// Shared shell for static marketing/content pages (About, FAQ, Pricing, etc.).
//
// Every content page gets the same centered, readable container so the prose
// stays narrow on wide screens and the type scale feels consistent with the
// tools. The component is a server component — it only marks up structure.
export default function ContentPage({
  title,
  description,
  eyebrow,
  children,
}) {
  return (
    <div className="tool-page">
      <header className="tool-head">
        {eyebrow ? <p className="tool-muted" style={{ margin: 0, textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 12, fontWeight: 600 }}>
          {eyebrow}
        </p> : null}
        <h1 style={{ margin: "4px 0 6px" }}>{title}</h1>
        <p style={{ margin: 0, color: "var(--tool-muted)", maxWidth: "62ch" }}>{description}</p>
      </header>
      <div style={{ maxWidth: "720px", margin: "0 auto" }}>{children}</div>
    </div>
  );
}