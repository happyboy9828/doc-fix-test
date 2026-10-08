import ContentPage from "./../../components/ContentPage/ContentPage";
import { getPages } from "./../../lib/pages";

export const metadata = {
  title: "All Tools",
  description:
    "Browse every DocFix image tool in one place. Resize, compress, convert, watermark and more — all in your browser.",
};

export default function ToolsPage() {
  const pages = getPages();

  return (
    <ContentPage
      title="All Tools"
      description={`${pages.length} browser-only image utilities. No uploads, no install, no sign-up.`}
      eyebrow="Tools"
    >
      <ul className="tools-grid">
        {pages.map((page) => (
          <li key={page.href}>
            <a href={page.href} className="tool-link-card">
              <span className="tool-link-title">
                {page.title}
                <span aria-hidden="true">&rarr;</span>
              </span>
              <span className="tool-link-desc">{page.description}</span>
              <span className="tool-link-href">{page.href}</span>
            </a>
          </li>
        ))}
      </ul>
    </ContentPage>
  );
}
