import ContentPage from "../../../components/ContentPage/ContentPage";

export const metadata = {
  title: "Blog",
  description: "Latest updates, tips, and guides from the DocFix team.",
};

export default function BlogPage() {
  return (
    <ContentPage
      title="Blog"
      description="Stay up to date with the latest features, tutorials, and image processing tips."
      eyebrow="News"
    >
      <div className="prose">
        <p className="tool-hint">Blog posts coming soon. Check back for tutorials, release notes, and image processing guides.</p>
      </div>
    </ContentPage>
  );
}