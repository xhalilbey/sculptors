import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sculptors",
  description: "Sculptors is the Agent Store for developers. Every piece is a primitive you compose yourself, so nothing about how your agents sell is decided for you.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/sculptors-icon.png", type: "image/png", sizes: "579x579" },
    ],
    apple: [{ url: "/sculptors-icon.png", type: "image/png" }],
  },
};

/**
 * Root Layout
 * 
 * Route groups (they do not appear in URLs) choose the providers:
 * - (marketing) → the public landing page; no providers, no session check
 * - (dashboard) → AppProviders (session, organizations) and the AppLayout shell
 * - auth/ (a real segment, /auth/*) → the session provider only
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${geistMono.variable} antialiased font-sans`}
      >
        {children}
      </body>
    </html>
  );
}
