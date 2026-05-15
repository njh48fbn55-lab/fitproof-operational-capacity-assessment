import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FitProof | Market Readiness Assessment",
  description: "Assess Market Readiness before customer usage, revenue, and retention data exist."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
