import type { Metadata } from "next";
import { IBM_Plex_Mono, Manrope } from "next/font/google";
import "./globals.css";

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
  title: "Sendo",
  description:
    "Local-first desktop utility for Fire TV control, Spotify routing, reusable shortcuts, and explicit device workflows.",
  metadataBase: new URL("https://postigo.sh"),
  openGraph: {
    title: "Sendo",
    description:
      "Control your TV from one desktop workflow with shortcuts, media actions, and explicit device targeting.",
    images: ["/images/sendo-home.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sendo",
    description:
      "Local-first desktop utility for Fire TV control, Spotify routing, reusable shortcuts, and explicit device workflows.",
    images: ["/images/sendo-home.png"],
  },
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
