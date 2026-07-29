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
  title: "Matriva – Dit hjem i overblik",
  description:
    "Saml dokumenter, vedligeholdelse og vigtige oplysninger om dit hjem ét sted.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="da" className={mulish.variable}>
      <body>{children}</body>
    </html>
  );
}
