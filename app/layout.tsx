import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./budget-overrides.css";
import "./participant-presence.css";
import "./travel-journal-v12.css";
import "./home-journal.css";
import "./reference-home.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "跳进地理书的旅行 · Travel Archive",
  description: "旅行档案、攻略与城市影集。",
  openGraph: {
    title: "跳进地理书的旅行",
    description: "深圳 → 上海迪士尼 → 外滩 → 杭州",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "上海杭州旅行手帐" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
