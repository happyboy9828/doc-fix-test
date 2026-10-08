import Link from "next/link";

export default function PageCard({ href, title, description }) {
  return (
    <Link href={href} className="tool-link-card">
      <span className="tool-link-title">
        {title}
        <span aria-hidden="true">&rarr;</span>
      </span>
      <span className="tool-link-desc">{description}</span>
      <span className="tool-link-href">{href}</span>
    </Link>
  );
}