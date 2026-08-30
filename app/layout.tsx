import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "跳进地理书的旅行 · 上海＋杭州省钱攻略",
  description: "深圳出发，两天一夜上海迪士尼、外滩与杭州衔接的可交互省钱旅行工作台。",
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
