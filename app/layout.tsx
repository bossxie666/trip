import type { Metadata } from "next";
import type { CSSProperties } from "react";
import "./globals.css";
import "./home-journal.css";
import "./dialogs.css";
import "./site-background.css";

// Chinese display faces remain local; shared Latin text uses native metrics-compatible fallbacks.
const nativeFonts = {
  "--font-geist-sans": 'Arial, "Microsoft YaHei", sans-serif',
  "--font-geist-mono": '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
} as CSSProperties;

export const metadata: Metadata = {
  metadataBase: new URL("https://trip.bossxie.win"),
  title: "跳进地理书的旅行 · Travel Archive",
  description: "旅行、地图、相册与费用管理。",
  openGraph: {
    title: "跳进地理书的旅行",
    description: "旅行、地图、相册与费用管理。",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "跳进地理书的旅行" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  manifest: "/manifest.webmanifest",
  robots: { index: false, follow: false, nocache: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body
        className="antialiased" style={nativeFonts}
      >
        {children}
      </body>
    </html>
  );
}
