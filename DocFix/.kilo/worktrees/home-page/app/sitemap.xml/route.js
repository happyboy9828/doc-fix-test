// Dynamic sitemap.xml — generated from the filesystem so every tool route,
// plus every static marketing route, is listed with proper lastmod and
// change frequency. No external packages required.
import { getPages, toolMetadata } from "../../lib/pages";

const BASE = "https://docfix.app";

const STATIC_PAGES = [
  { path: "", changefreq: "weekly", priority: 1.0, title: "DocFix — Browser-only image tools" },
  { path: "/pricing", changefreq: "monthly", priority: 0.9, title: "Pricing — Basic, Pro and Ultra plans" },
  { path: "/tools", changefreq: "weekly", priority: 0.9, title: "All image tools — Resize, compress, convert and more" },
  { path: "/about", changefreq: "monthly", priority: 0.8, title: "About DocFix" },
  { path: "/faq", changefreq: "weekly", priority: 0.8, title: "FAQ — Privacy, pricing and browser support" },
  { path: "/docs", changefreq: "monthly", priority: 0.7, title: "Documentation — Guides and best practices" },
  { path: "/blog", changefreq: "weekly", priority: 0.8, title: "DocFix Blog — Tutorials and updates" },
  { path: "/contact", changefreq: "monthly", priority: 0.6, title: "Contact DocFix" },
  { path: "/privacy", changefreq: "yearly", priority: 0.5, title: "Privacy Policy" },
  { path: "/terms", changefreq: "yearly", priority: 0.4, title: "Terms of Service" },
];

// Tool-specific metadata for richer sitemap entries.
const TOOL_META = {
  "/BGRemove": {
    title: "Remove Image Background — Free Online Tool",
    desc: "Remove an image background automatically with erase and restore brushes. 100% browser-only.",
  },
  "/FavIcon": {
    title: "Favicon Generator — Create favicon.ico and PWA icons",
    desc: "Build favicon.ico, PWA icons and a web manifest from one image.",
  },
  "/ImageResizer": {
    title: "Image Resizer — Resize and crop images online",
    desc: "Resize photos to exact pixel dimensions or crop to an aspect ratio.",
  },
  "/ImgCompresser": {
    title: "Compress Image — Reduce file size without losing quality",
    desc: "Shrink image file sizes with a quality slider and batch ZIP download.",
  },
  "/ImgToBase64": {
    title: "Image to Base64 — Encode images as data URLs",
    desc: "Encode an image as a data URL, HTML tag, CSS background or raw Base64 string.",
  },
  "/JpgToPng": {
    title: "JPG to PNG — Convert images online",
    desc: "Convert JPG images to lossless PNG, with optional 8-bit indexed colour.",
  },
  "/PngToJpg": {
    title: "PNG to JPG — Convert images online",
    desc: "Convert PNG graphics to JPG, filling transparent areas with a custom colour.",
  },
  "/WebpToPng": {
    title: "WebP to PNG — Convert WebP images online",
    desc: "Convert WebP images to PNG in batches, preserving transparency.",
  },
};

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function GET() {
  const today = new Date().toISOString().split("T")[0];
  const pages = getPages();

  const toolEntries = pages.map((page) => {
    const meta = TOOL_META[page.href] ?? {
      title: `${page.title} — Free Online Tool`,
      desc: page.description,
    };
    return {
      path: page.href,
      changefreq: "weekly",
      priority: 0.85,
      title: meta.title,
    };
  });

  const urls = [
    ...STATIC_PAGES.map((p) => ({
      path: p.path,
      changefreq: p.changefreq,
      priority: p.priority,
      title: p.title,
    })),
    ...toolEntries,
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls
    .map(
      (u) => `  <url>
    <loc>${escapeXml(BASE + u.path)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority.toFixed(1)}</priority>
    <title>${escapeXml(u.title)}</title>
  </url>`
    )
    .join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
