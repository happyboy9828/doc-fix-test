import ContentPage from "../../../components/ContentPage/ContentPage";

export const metadata = {
  title: "Contact",
  description: "Get in touch with the DocFix team for support, feedback, or business inquiries.",
};

export default function ContactPage() {
  return (
    <ContentPage
      title="Contact Us"
      description="We'd love to hear from you."
      eyebrow="Contact"
    >
      <div className="prose">
        <p>Email: <a href="mailto:hello@docfix.app">hello@docfix.app</a></p>
        <p>We typically respond within 1-2 business days.</p>

        <h2>Common Inquiries</h2>
        <ul>
          <li><strong>Technical support:</strong> Include your browser, OS, and steps to reproduce the issue.</li>
          <li><strong>Feature requests:</strong> Tell us what tool or improvement you'd like to see.</li>
          <li><strong>Business / partnerships:</strong> We're open to collaborations and enterprise licensing.</li>
          <li><strong>Press / media:</strong> Contact us for logos, screenshots, and press kits.</li>
        </ul>

        <p>Before emailing, check our <a href="/faq">FAQ</a> for quick answers.</p>
      </div>
    </ContentPage>
  );
}