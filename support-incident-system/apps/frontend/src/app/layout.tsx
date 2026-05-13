// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Support & Incident Portal",
    template: "%s | Support & Incident Portal",
  },
  description: "IT Support & Incident Management Portal — Internal System",
  robots: "noindex, nofollow",
  icons: {
    icon: "/logo-seamolec.ico",
    apple: "/logo-seamolec.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-slate-100 text-slate-800 font-sans">
        {children}
      </body>
    </html>
  );
}