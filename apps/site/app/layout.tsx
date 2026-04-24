import type { Metadata } from "next";
import { IBM_Plex_Mono, Manrope } from "next/font/google";
import "./globals.css";

function getSiteUrl() {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL;

  if (!envUrl) {
    return "http://localhost:3000";
  }

  return envUrl.startsWith("http") ? envUrl : `https://${envUrl}`;
}

const siteUrl = getSiteUrl();

const bodyFont = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
});

const monoFont = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "Sendo",
    template: "%s | Sendo",
  },
  description:
    "Local-first desktop utility for Fire TV control, Spotify routing, reusable shortcuts, and explicit device workflows.",
  metadataBase: new URL(siteUrl),
  applicationName: "Sendo",
  keywords: [
    "Sendo",
    "Fire TV",
    "Spotify Connect",
    "desktop utility",
    "media routing",
    "ADB",
    "Windows app",
  ],
  authors: [{ name: "Piero Postigo Rocchetti", url: "https://postigo.sh" }],
  creator: "Piero Postigo Rocchetti",
  publisher: "Piero Postigo Rocchetti",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "/brand/sendo.svg",
    shortcut: "/brand/sendo.svg",
    apple: "/brand/sendo.svg",
  },
  openGraph: {
    title: "Sendo",
    description:
      "Control your TV from one desktop workflow with shortcuts, media actions, and explicit device targeting.",
    url: siteUrl,
    siteName: "Sendo",
    type: "website",
    images: ["/images/sendo-home.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sendo",
    description:
      "Local-first desktop utility for Fire TV control, Spotify routing, reusable shortcuts, and explicit device workflows.",
    images: ["/images/sendo-home.png"],
  },
  category: "technology",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${bodyFont.variable} ${monoFont.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
