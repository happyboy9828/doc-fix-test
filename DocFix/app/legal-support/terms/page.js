import ContentPage from "../../../components/ContentPage/ContentPage";

export const metadata = {
  title: "Terms of Service",
  description:
    "Terms and conditions for using DocFix image tools. By using our site you agree to these terms.",
};

export default function TermsPage() {
  return (
    <ContentPage
      title="Terms of Service"
      description="The rules and guidelines for using DocFix."
      eyebrow="Terms"
    >
      <div className="prose">
        <h2>Acceptance</h2>
        <p>
          By accessing or using DocFix, you agree to be bound by these Terms of Service. If
          you do not agree to these terms, please do not use our services.
        </p>

        <h2>Use License</h2>
        <p>
          Permission is granted to use DocFix for personal and commercial purposes, subject
          to the restrictions below.
        </p>

        <h2>Restrictions</h2>
        <ul>
          <li>You may not use our tools for illegal or unauthorized purposes.</li>
          <li>You may not attempt to reverse-engineer or exploit our tools.</li>
          <li>You may not use our tools in a way that damages or overburdens our infrastructure.</li>
        </ul>

        <h2>Disclaimer</h2>
        <p>
          DocFix is provided "as is" without warranty of any kind. We do not
          guarantee uninterrupted or error-free operation.
        </p>

        <h2>Limitations</h2>
        <p>
          In no event shall DocFix be liable for any damages arising from the use or
          inability to use our tools.
        </p>

        <h2>Governing Law</h2>
        <p>
          These terms are governed by and construed in accordance with applicable laws,
          without regard to conflict of law principles.
        </p>

        <h2>Contact</h2>
        <p>Questions? Email us at hello@docfix.app.</p>
      </div>
    </ContentPage>
  );
}