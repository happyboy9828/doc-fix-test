// robots.txt — served as a route so it stays in the app directory and is
// picked up by Next.js automatically. The sitemap pointer tells crawlers
// where the dynamic sitemap lives.
export function GET() {
  const body = `User-agent: *
Allow: /

# Disallow tool internals that are not meant to be crawled.
Disallow: /_next/static/chunks/
Disallow: /api/

# Point crawlers at the dynamic sitemap.
Sitemap: https://docfix.app/sitemap.xml
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}