import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vrijgezellen Speurtocht Tilburg",
  description: "Speurtocht app voor het vrijgezellenfeest in Tilburg",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}