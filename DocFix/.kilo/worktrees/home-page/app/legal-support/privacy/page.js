import ContentPage from "../../../components/ContentPage/ContentPage";

export const metadata = {
  title: "Privacy Policy",
  description:
    "Learn how DocFix handles your data, files and privacy. We do not upload your images to any server.",
};

export default function PrivacyPage() {
  return (
    <ContentPage
      title="Privacy Policy"
      description="Your privacy matters. Here is exactly what we do and do not collect."
      eyebrow="Privacy"
    >
      <div className="prose">
        <h2>Data Processing</h2>
        <p>
          All DocFix tools run locally in your browser. We do not upload, store or process
          your images on any server. Your files remain on your device at all times.
        </p>

        <h2>Analytics</h2>
        <p>
          We use privacy-friendly analytics to understand how our tools are used. These
          metrics are aggregated and anonymized. No personal data or file content is ever
          included.
        </p>

        <h2>Cookies</h2>
        <p>
          We use essential cookies for site functionality only. We do not use tracking
          cookies or third-party advertising cookies.
        </p>

        <h2>Third-Party Services</h2>
        <p>
          Payment processing is handled by a secure, PCI-compliant provider. We do not
          receive or store your full payment details.
        </p>

        <h2>Your Rights</h2>
        <p>
          You can use DocFix without providing any personal information. If you subscribe,
          you can request deletion of your account data at any time by contacting
          hello@docfix.app.
        </p>

        <h2>Changes</h2>
        <p>
          We may update this policy from time to time. The latest version will always be
          posted here with an updated revision date.
        </p>

        <p>Last updated: 2026-09-01</p>
      </div>
    </ContentPage>
  );
}