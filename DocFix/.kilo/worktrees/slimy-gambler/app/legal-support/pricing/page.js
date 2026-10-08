import ContentPage from "../../../components/ContentPage/ContentPage";
import PricingTable from "../../../components/PricingTable/PricingTable";

export const metadata = {
  title: "Pricing",
  description:
    "Choose the DocFix plan that fits your workflow. Simple, transparent pricing for individuals and teams.",
};

export default function PricingPage() {
  return (
    <ContentPage
      title="Pricing"
      description="All plans run locally in your browser — no uploads, no account required to try."
      eyebrow="Plans"
    >
      <PricingTable />
    </ContentPage>
  );
}