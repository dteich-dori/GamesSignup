import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Nav } from "@/components/Nav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Games Signup",
  description: "Tennis doubles game signup board",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192.svg",
    apple: "/icon-192.svg",
  },
  appleWebApp: {
    capable: true,
    title: "Games Signup",
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex font-sans">
        <Nav />
        <main className="flex-1 p-8">{children}</main>
      </body>
    </html>
  );
}
