To make all the tool implementations work correctly in your Next.js or CRA application, you need to include the following 3 core CDNs depending on which tools you are integrating.1. Core CDN Scripts ListA. PDF Processing (pdf-lib)Purpose: Handles PDF generation, page extraction, splitting, merging, and rotation.CDN URL:HTML<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js"></script>
(Alternative unpkg URL):HTML<script src="https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js"></script>
B. PDF Rendering & Previewing (pdf.js / pdfjs-dist)Purpose: Renders visual thumbnails, page previews, and extracts images to canvas.CDN Script & Worker Setup:HTML<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script>
  if (typeof window !== 'undefined' && window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
</script>
C. ZIP Archiving (jszip)Purpose: Bundles multiple pages or generated JPG images into downloadable .zip files.CDN URL:HTML<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
2. Complete Copy-Paste Snippet for Your ProjectAdd this complete snippet directly inside the <head> section of your application:For Create React App (public/index.html): Inside the <head> tag.For Next.js App Router (app/layout.js or app/layout.tsx): Using Next.js Script tag or raw HTML head.For Next.js Pages Router (pages/_document.js): Inside the <Head> component.HTML<!-- PDF-LIB CDN -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js"></script>

<!-- PDF.JS CDN & WORKER CONFIG -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script>
  if (typeof window !== 'undefined' && window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
</script>

<!-- JSZIP CDN -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
3. Which Tool Needs Which CDN?Tool Utilitypdf-libpdf.jsjszipRotate PDFRequiredRequiredNot neededMerge PDFRequiredRequiredNot neededSplit PDFRequiredRequiredRequiredPDF to JPGNot neededRequiredRequired