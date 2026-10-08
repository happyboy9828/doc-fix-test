import ContentPage from "../../../components/ContentPage/ContentPage";

export const metadata = {
  title: "About DocFix",
  description: "Learn about DocFix — fast, private, browser-based image tools for everyone.",
};

export default function AboutPage() {
  return (
    <ContentPage
      title="About DocFix"
      description="Our mission: make image processing fast, private, and accessible."
      eyebrow="About"
    >
      <div className="prose">
        <h2>What is DocFix?</h2>
        <p>DocFix is a collection of image tools that run entirely in your browser. No uploads, no cloud processing, no waiting for servers. Everything happens on your device using modern web APIs.</p>

        <h2>Why Browser-Based?</h2>
        <ul>
          <li><strong>Privacy:</strong> Your images never leave your computer.</li>
          <li><strong>Speed:</strong> No upload/download latency. Processing is instant.</li>
          <li><strong>Offline-ready:</strong> Once loaded, tools work without internet.</li>
          <li><strong>No accounts needed:</strong> Open a tool and start working immediately.</li>
        </ul>

        <h2>Technology</h2>
        <p>DocFix uses HTML5 Canvas, Web Workers, and modern JavaScript APIs. Built with Next.js and React.</p>

        <h2>Open Source</h2>
        <p>The core image processing logic is open source. Check out the <a href="https://github.com/docfix" target="_blank" rel="noopener noreferrer">GitHub repository</a>.</p>

        <h2>Contact</h2>
        <p>Questions or feedback? Email <a href="mailto:hello@docfix.app">hello@docfix.app</a>.</p>
      </div>
    </ContentPage>
  );
}