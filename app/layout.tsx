import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import { ThemeProvider } from "@/lib/theme";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0f1e" },
    { media: "(prefers-color-scheme: light)", color: "#f0f4f8" },
  ],
};

export const metadata: Metadata = {
  title: "🏓 Pickleball Open — Giải Đấu Bắt Cặp",
  description:
    "Vòng quay bắt cặp ngẫu nhiên và nhánh đấu loại trực tiếp cho giải Pickleball Open",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Pickleball Open",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${outfit.variable} h-full`} suppressHydrationWarning>
      <body
        className="min-h-full flex flex-col bg-animated antialiased"
        style={{ fontFamily: "var(--font-outfit)" }}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
