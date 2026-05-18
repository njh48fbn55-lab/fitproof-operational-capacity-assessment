import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FitProof | Nonprofit Revenue Pipeline Assessment",
  description: "Assess how effectively a nonprofit revenue pipeline moves from lead to cash."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
