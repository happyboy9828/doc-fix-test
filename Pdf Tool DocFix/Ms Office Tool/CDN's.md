To integrate Microsoft Office and tabular document conversion tools (Word, Excel, PowerPoint, CSV, HTML) into your web application, you need specific CDN libraries depending on the exact utility you are building.

1. Essential CDNs by MS Office Tool / Document Type
A. Microsoft Word (.docx)
Used for reading, parsing, generating, and converting .docx files.

Mammoth.js (Reads & converts .docx to HTML/Text):

HTML
<script src="https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js"></script>
docx.js (Creates & formats .docx files client-side):

HTML
<script src="https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.min.js"></script>
html-docx-js (Parses HTML code/DOM trees into .docx format):

HTML
<script src="https://cdn.jsdelivr.net/npm/html-docx-js@0.3.1/dist/html-docx.min.js"></script>
B. Microsoft Excel (.xlsx, .xls, .csv, .tsv)
Used for reading/writing spreadsheets, auto-formatting tables, and parsing delimiter data.

SheetJS / xlsx (Full Excel & CSV parsing/generation engine):

HTML
<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
C. Microsoft PowerPoint (.pptx)
Used for programmatically creating presentation slide decks client-side.

PPTXGenJS (Generates .pptx presentations with text, tables, shapes, and images):

HTML
<script src="https://cdn.jsdelivr.net/gh/gitbrent/pptxgenjs@3.12.0/dist/pptxgen.bundle.js"></script>
D. PDF Support & Utilities (PDF <-> Office Converters)
Used for rendering previews, generating PDF decks/reports, and bundling downloads.

pdf-lib (Generates, modifies, merges, and splits PDFs):

HTML
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js"></script>
PDF.js (Renders PDF pages to Canvas for thumbnails/previews and extracts text):

HTML
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script>
  if (typeof window !== 'undefined' && window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
</script>
jsPDF & AutoTable (Generates tabular PDF reports directly from spreadsheets):

HTML
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js"></script>
FileSaver.js (Triggers cross-browser file downloads cleanly):

HTML
<script src="https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js"></script>
2. Complete All-in-One Copy & Paste Snippet
If you want to support all MS Office tools (Word, Excel, PowerPoint, CSV, PDF) across your application, add this entire bundle inside your <head> element:

For Create React App (public/index.html): Add directly inside <head>.

For Next.js App Router (app/layout.js): Embed via standard HTML head tags or Next.js <Script> components.

For Next.js Pages Router (pages/_document.js): Add inside the <Head> component.

HTML
<!-- Word (.docx) Libraries -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/html-docx-js@0.3.1/dist/html-docx.min.js"></script>

<!-- Excel (.xlsx, .csv) Library -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>

<!-- PowerPoint (.pptx) Library -->
<script src="https://cdn.jsdelivr.net/gh/gitbrent/pptxgenjs@3.12.0/dist/pptxgen.bundle.js"></script>

<!-- PDF Generation & Rendering Libraries -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script>
  if (typeof window !== 'undefined' && window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
</script>

<!-- Utilities -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js">