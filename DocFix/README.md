# DocFix

Fast, secure image tools that run 100% in your browser. Nothing is uploaded to a
server — every tool reads your file with the File API and writes the result back
with a Blob URL.

- **Next.js 16** · **React 19** · **Tailwind CSS v4**
- **Zero uploads** · **No sign-up** · **Free**

---

## Tools

| Route | What it does |
| --- | --- |
| `/` | Homepage with hero, featured tools, and full toolkit |
| `/tools` | Browse every tool in one place |
| `/img/BGRemove` | Remove an image background automatically, then refine it with erase and restore brushes |
| `/img/FavIcon` | Build favicon.ico, PWA icons and a web manifest from one image |
| `/img/ImageResizer` | Resize photos to exact pixel dimensions or crop them to an aspect ratio |
| `/img/ImgCompresser` | Shrink image file sizes with a quality slider or target size limit, with batch ZIP download |
| `/img/ImgToBase64` | Encode an image as a data URL, HTML tag, CSS background or raw Base64 |
| `/img/JpgToPng` | Convert JPG to lossless PNG, optionally 8-bit indexed, optionally clearing white edges |
| `/img/PngToJpg` | Convert PNG to JPG, filling transparent areas with white, black or a custom hex colour |
| `/img/WebpToPng` | Convert WebP to PNG in batches, preserving or replacing transparency |
| `/img/Watermark` | Protect your images with custom text or image watermarks |
| `/dev-tools/CSSMinifier` | Compress CSS by stripping comments, whitespace and redundant code |
| `/dev-tools/HTMLMinifier` | Minify HTML markup by removing comments, collapsing whitespace and optimising inline CSS and JavaScript |
| `/dev-tools/PasswordGenerator` | Generate cryptographically secure random passwords and memorable passphrases |
| `/dev-tools/QRCodeGenerator` | Create custom high-resolution QR codes with logos and colour gradients |
| `/dev-tools/QRCodeScanner` | Scan QR codes from your camera or uploaded images |

### Planned tools

| Category | Status |
| --- | --- |
| PDF Tools | Under build |
| MS Office Tools | Under build |
| Text Tools | Under build |

---

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run start    # serve the production build
npm run lint     # eslint
```

## Adding a tool

1. Create `app/img/<ToolName>/page.js`. The route folder **must** use the same
   casing as the tool folder — on a case-sensitive filesystem a mismatch
   breaks the build.
2. Add the tool's title and description to `PAGE_META` in `lib/pages.js`. Routes
   are discovered from the filesystem, so the nav and home page pick it up
   automatically, but this is what gives it a readable name.
3. Add `app/img/<ToolName>/layout.js` exporting `metadata` from `toolMetadata`.
   Tool pages are client components and cannot export metadata themselves.

## Project structure

```
app/              Next.js App Router routes and each tool's implementation
components/       shared React components (Navbar, Footer, pricing, ads, etc.)
lib/pages.js      route discovery + the single source of truth for titles and descriptions
utils/shared/     helpers used by every tool (see below)
utils/img/        image tool utilities (BGRemove, FavIcon, etc.)
utils/dev-tools/  dev tool utilities (CSSMinifier, HTMLMinifier, PasswordGenerator, QRCodeGenerator, QRCodeScanner)
ads/              ad units (banner, popup, push notification, etc.)
```

### Shared helpers

`utils/shared/` exists so the tools do not each grow their own copy of the same
utilities. Import from here rather than re-implementing:

- `download.js` — `downloadBlob(blob, filename)`
- `format.js` — `formatBytes`, `savingsPercent`, `clamp`, `baseName`,
  `withExtension`, `MAX_FILES`, `nextFrame`, `sleep`
- `imageFile.js` — `kindOf`, `isAcceptedFile`, `ACCEPT_ATTR`, `loadImage`,
  `canvasToBlob`, `canvasToBytes`, `canEncode`
- `zip.js` — `createZip`, `createZipFromBlobs`, `crc32`, `deflate`, `encodeText`

### Conventions

- **React components use JSX.** Plain-DOM helpers inside `utils/` use a local
  `h`/`el` helper. Do not use `createElement` for components: the React Compiler
  lint rules cannot see through it and will reject every ref.
- **Two component styles are intentional.** New tools should be React with
  hooks. The imperative tools (`ImgToBase64`, `JpgToPng`, `PngToJpg`,
  `WebpToPng` in `utils/img/`, and `CSSMinifier`, `HTMLMinifier`,
  `PasswordGenerator`, `QRCodeGenerator`, `QRCodeScanner` in
  `utils/dev-tools/`) build their DOM in a `mount*` or `create*` function
  that returns a cleanup; their pages just call it from a `useEffect`.
  Keep new tools on the React side.
- **Double quotes** in JS and CSS.
- **Own your root element.** `app/layout.js` renders the single `<main>`, so a
  page renders a `<div class="<prefix>-page">`, never another `<main>`.
- **CSS custom property prefixes.** Each tool scopes its styles
  (`rb-`, `fg-`, `ci-`, `itb-`, `j2p-`, `p2j-`, `w2p-`, `cm-`, `hm-`, `pg-`,
  `qrt-`, `qrs-`) but reads the shared `--tool-width`, `--tool-font` and
  `--tool-mono` from `app/globals.css` so all tools line up.

## Themes

The site supports three themes via CSS custom properties on `:root`:

- **Light** — Cool slate surfaces with deep charcoal text and indigo accents
- **Dark** — Deep navy background with light slate text and blue accents
- **Neon** — High-contrast dark with electric cyan accents

Theme preference is persisted in `localStorage` and applied with the
`data-theme` attribute on `<html>`.

## Ads & monetisation

Ad units live under `ads/` and are mounted once in `app/layout.js` so triggers
are configured in a single place:

- **AdBanner** — leaderboard banner
- **AdInArticle** — sponsored content block
- **AdPopup** — timed modal popup
- **AdOnClick** — triggers after a deliberate number of clicks
- **AdPagePushBanner** — corner banner that auto-hides
- **AdPushNotification** — browser push-request consent card

## License

Private. All rights reserved.
