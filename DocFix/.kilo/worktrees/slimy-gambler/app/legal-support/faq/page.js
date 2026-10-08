import ContentPage from "../../../components/ContentPage/ContentPage";

export const metadata = {
  title: "FAQ",
  description: "Frequently asked questions about DocFix tools, pricing, and privacy.",
};

export default function FAQPage() {
  return (
    <ContentPage
      title="Frequently Asked Questions"
      description="Quick answers to common questions about DocFix."
      eyebrow="FAQ"
    >
      <div className="prose">
        <h2>General</h2>
        <h3>Are my images uploaded to a server?</h3>
        <p>No. All DocFix tools run entirely in your browser. Your files never leave your device.</p>

        <h3>Is there a file size limit?</h3>
        <p>Most tools support images up to 8192px on the longest side. Batch tools accept up to 50 files at once.</p>

        <h3>Which browsers are supported?</h3>
        <p>DocFix works in all modern browsers: Chrome, Firefox, Safari, Edge. Some features (like WebP encoding) may not be available in older Safari versions.</p>

        <h2>Privacy</h2>
        <h3>Do you collect analytics?</h3>
        <p>We use privacy-friendly, aggregated analytics. No personal data or file content is ever included.</p>

        <h3>Do you use cookies?</h3>
        <p>Only essential cookies for site functionality. No tracking or advertising cookies.</p>

        <h2>Pricing</h2>
        <h3>Can I try before subscribing?</h3>
        <p>Yes. All tools are free to use without an account. Subscriptions unlock higher batch limits and advanced features.</p>

        <h3>How do I cancel?</h3>
        <p>Cancel anytime from your account settings. No questions asked.</p>

        <h2>Technical</h2>
        <h3>Why is my conversion slow?</h3>
        <p>Large images or batch processing can take time. For best results, use images under 4000px when possible.</p>

        <h3>The tool isn't working. What should I do?</h3>
        <p>Try refreshing the page. If the issue persists, email hello@docfix.app with your browser version and a screenshot.</p>
      </div>
    </ContentPage>
  );
}