import type { Metadata, Viewport } from "next";
import "./globals.scss";
import { appBaseUrl } from "@/lib/http";

const siteUrl = appBaseUrl();

export const metadata: Metadata = {
  // Without metadataBase, canonical and Open Graph URLs such as "/p/slug" resolve against the wrong host.
  metadataBase: new URL(siteUrl),
  title: {
    default: "vCard Platform — Your digital business card",
    template: "%s | vCard Platform",
  },
  description:
    "Create a professional digital business card and share it instantly with a QR code.",
  applicationName: "vCard Platform",
  openGraph: {
    siteName: "vCard Platform",
    title: "vCard Platform — Your digital business card",
    description: "Create a professional digital business card and share it instantly with a QR code.",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
