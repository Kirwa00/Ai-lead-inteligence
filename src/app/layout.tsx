import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "A1 Lead Intelligence | Command Center",
  description: "AI-powered autonomous lead generation agency platform",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-on-surface antialiased min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
