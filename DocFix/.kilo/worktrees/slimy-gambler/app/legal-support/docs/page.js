import ContentPage from "../../../components/ContentPage/ContentPage";

export const metadata = {
  title: "Documentation",
  description: "Technical documentation and guides for DocFix tools.",
};

export default function DocsPage() {
  return (
    <ContentPage
      title="Documentation"
      description="Learn how to use DocFix tools effectively."
      eyebrow="Docs"
    >
      <div className="prose">
        <h2>Getting Started</h2>
        <p>DocFix is a suite of browser-based image tools. No installation required — just open a tool and start working.</p>

        <h2>Tools Overview</h2>
        <ul>
          <li><strong>WebP to PNG:</strong> Convert WebP images to lossless PNG</li>
          <li><strong>JPG to PNG:</strong> Convert JPG to PNG with 8-bit or 24-bit color depth</li>
          <li><strong>PNG to JPG:</strong> Convert transparent PNGs to JPG with custom background fill</li>
          <li><strong>Image Resizer:</strong> Crop and resize to exact dimensions and aspect ratios</li>
          <li><strong>Image Compressor:</strong> Reduce file size with quality/size targeting</li>
          <li><strong>Image to Base64:</strong> Encode images as Data URLs, HTML, or CSS</li>
          <li><strong>Favicon Generator:</strong> Create multi-size favicon packages</li>
          <li><strong>Watermark:</strong> Add text or logo watermarks to batches of photos</li>
          <li><strong>Background Remover:</strong> Automatic subject detection with manual refinement</li>
        </ul>

        <h2>Common Workflows</h2>
        <h3>Batch Processing</h3>
        <p>Drag multiple files onto any tool's drop zone. Most tools support up to 50 files at once.</p>

        <h3>Download Options</h3>
        <p>Download individual files or use "Download All (.ZIP)" to get a single archive.</p>

        <h3>Privacy First</h3>
        <p>All processing happens locally in your browser. No uploads, no accounts required for basic use.</p>
      </div>
    </ContentPage>
  );
}