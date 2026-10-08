import { Geist, Geist_Mono } from "next/font/google";
import Navbar from "./../components/Navbar/Navbar";
import Footer from "../components/Footer/Footer";
import { getPages } from "../lib/pages";
import AdBanner from "../ads/AdBanner/AdBanner";
import AdInArticle from "../ads/AdInArticle/AdInArticle";
import AdPopup from "../ads/AdPopup/AdPopup";
import AdOnClick from "../ads/AdOnClick/AdOnClick";

import AdPagePushBanner from "../ads/AdPagePushBanner/AdPagePushBanner";
import AdPushNotification from "../ads/AdPushNotification/AdPushNotification";
import "./globals.css";
import "./tool.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata = {
  title: {
    default: "DocFix",
    template: "%s · DocFix",
  },
  description: "A collection of small browser-only image tools.",
  icons: {
    icon: "/logo.svg",
  },
};

// Pages own their own page body; the Navbar, the ad shell and that main landmark
// stay here so every route shares one document shell. The shell keeps the
// navbar's container width and widens at xl so the tool container has room to
// breathe.
//
// Every ad unit is mounted here, once, so the triggers are all configured in one
// place. Two of them (AdPopup, AdOnClick) can take the screen, so they share the
// overlay registry in ads/overlay.js and only one is ever open. The other two
// are non-modal: AdPagePushBanner is a corner banner and AdPushNotification is
// a consent card that only asks when permission is undecided.
export default function RootLayout({ children }) {
  const pages = getPages();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Navbar pages={pages} />

        <div className="mx-auto w-full max-w-[var(--tool-width)] flex-1 px-6 xl:max-w-[1400px]">
          <div className="ad-banner-spacer pt-10">
            <AdBanner slot="leaderboard-top" />
          </div>

          <main className="flex min-w-0 flex-col">{children}</main>

          <AdInArticle slot="sponsored-footer" />
        </div>

        <Footer />

        {/* Screen units. The delays are staggered so a reader never gets two at
            once: the modal popup waits, and the onclick unit only reacts to a
            deliberate click. */}
        <AdPopup trigger="delay" delayMs={9000} />
        <AdOnClick clicks={3} countdownMs={2500} />

        {/* Non-modal units. The banner slides in and leaves on its own; the
            notification unit only shows a consent card, and never if the reader
            already denied the permission. */}
        <AdPagePushBanner position="bottom-left" delayMs={4500} autoHideMs={16000} />
        <AdPushNotification trigger="delay" delayMs={20000} />
      </body>
    </html>
  );
}
