# DocFix

A small collection of image tools that run entirely in the browser. Nothing is
uploaded: every tool reads your file with the File API and writes the result
back with a Blob URL.

## Tools

| Route | What it does |
| --- | --- |
| `/` | Index of every tool found under `app/` |
| `/BGRemove` | Removes an image background automatically, then refine it with erase/restore brushes and swap in a new backdrop |
| `/FavIcon` | Turns one image into `favicon.ico`, PWA icons, a web manifest and a ready-made `<head>` snippet |
| `/ImgCompresser` | Shrinks images with a quality slider or a target size limit, with batch ZIP download |
| `/ImgToBase64` | Encodes an image as a data URL, HTML tag, CSS background or raw Base64 |
| `/JpgToPng` | Converts JPG to lossless PNG, optionally 8-bit indexed, optionally clearing white edges |
| `/PngToJpg` | Converts PNG to JPG, filling transparent areas with white, black or a custom hex colour |
| `/WebpToPng` | Converts WebP to PNG in batches, preserving or replacing transparency |

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run start    # serve the production build
npm run lint     # eslint
```

## Adding a tool

1. Create `app/<ToolName>/page.js`. The route folder **must** use the same casing
   as the tool folder — on a case-sensitive filesystem a mismatch
   breaks the build.
2. Add the tool's title and description to `PAGE_META` in `lib/pages.js`. Routes
   are discovered from the filesystem, so the nav and home page pick it up
   automatically, but this is what gives it a readable name.
3. Add `app/<ToolName>/layout.js` exporting `metadata` from `toolMetadata`.
   Tool pages are client components and cannot export metadata themselves.

## Layout

```
app/            Next.js App Router routes + each tool's implementation
components/     shared React components (Navbar, Footer, pricing, etc.)
lib/pages.js    route discovery + the single source of truth for titles
utils/shared/   helpers used by every tool (see below)
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
  hooks. The four imperative tools (`ImgToBase64`, `JpgToPng`, `PngToJpg`,
  `WebpToPng`) build their DOM in a `mount*` function that returns a cleanup;
  their pages just call it from a `useEffect`. Keep new tools on the React side.
- **Double quotes** in JS and CSS.
- **Own your root element.** `app/layout.js` renders the single `<main>`, so a
  page renders a `<div class="<prefix>-page">`, never another `<main>`.
- **CSS custom property prefixes.** Each tool scopes its styles
  (`rb-`, `fg-`, `ci-`, `itb-`, `j2p-`, `p2j-`, `w2p-`) but reads the shared
  `--tool-width`, `--tool-font` and `--tool-mono` from `app/globals.css` so all
  seven tools line up.