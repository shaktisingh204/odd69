import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { prisma } from "@/lib/db";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  let faviconUrl = '';
  try {
    const faviconConfig = await prisma.systemConfig.findUnique({
      where: { key: 'FAVICON_URL' }
    });
    faviconUrl = faviconConfig?.value || '';
  } catch (e) {
    // ignore
  }

  return {
    title: "Zeero Admin Panel",
    description: "Zeero platform administration dashboard",
    icons: faviconUrl ? {
      icon: [{ url: faviconUrl, sizes: "any", type: "image/png" }],
      apple: [{ url: faviconUrl }],
      shortcut: [{ url: faviconUrl }]
    } : undefined
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: "#1e293b", border: "1px solid #334155", color: "#f8fafc" },
          }}
        />
      </body>
    </html>
  );
}
