import type { Metadata } from "next";
import { Luckiest_Guy, Noto_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const notoSans = Noto_Sans({ subsets: ["latin"], variable: "--font-noto" });
const luckiestGuy = Luckiest_Guy({ subsets: ["latin"], weight: "400", variable: "--font-luckiest" });

export const metadata: Metadata = {
  metadataBase: new URL("https://fantafort.com"),
  applicationName: "FantaFort",
  title: {
    default: "FantaFort | Fortnite Fantasy League",
    template: "%s | FantaFort",
  },
  description: "Create a private Fortnite fantasy league, draft FNCS pro players and score points from real competitive results.",
  alternates: {
    canonical: "/",
    languages: { en: "/", it: "/it", es: "/es", de: "/de", fr: "/fr", "x-default": "/" },
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "FantaFort",
    title: "FantaFort | Fortnite Fantasy League",
    description: "Draft Fortnite pros, create private leagues and follow FNCS results.",
  },
  twitter: {
    card: "summary_large_image",
    title: "FantaFort | Fortnite Fantasy League",
    description: "Draft Fortnite pros, create private leagues and follow FNCS results.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${notoSans.variable} ${luckiestGuy.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
