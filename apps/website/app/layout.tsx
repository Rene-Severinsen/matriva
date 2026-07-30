import type { Metadata } from "next";
import { Mulish } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

const mulish = Mulish({
  subsets: ["latin"],
  variable: "--font-mulish",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://matriva.dk"),
  title: {
    default: "Matriva – Dit hus samlet ét sted",
    template: "%s | Matriva",
  },
  description:
    "Overblik over boligoplysninger, dokumenter, vedligeholdelse og historik.",
  applicationName: "Matriva",
  openGraph: {
    type: "website",
    locale: "da_DK",
    siteName: "Matriva",
    title: "Matriva – Dit hus samlet ét sted",
    description:
      "Overblik over boligoplysninger, dokumenter, vedligeholdelse og historik.",
    images: [
      {
        url: "/social/matriva-social-share-1200x630.png",
        width: 1200,
        height: 630,
        alt: "Matriva – Dit hus samlet ét sted",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Matriva – Dit hus samlet ét sted",
    description:
      "Overblik over boligoplysninger, dokumenter, vedligeholdelse og historik.",
    images: ["/social/matriva-social-share-1200x675.png"],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="da" className={mulish.variable}>
      <body>{children}</body>
    </html>
  );
}
