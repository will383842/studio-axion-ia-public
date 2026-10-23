import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { EnregistrementPwa } from "@/components/coquille/EnregistrementPwa";
import { RepriseMiseAJour } from "@/components/coquille/RepriseMiseAJour";
import { HoteConfirmationPrix } from "@/components/ui/ConfirmationPrix";
import { Toasts } from "@/components/ui/Toast";
import "./globals.css";

// Polices rangées dans le dépôt (sous-ensemble latin de Google Fonts, licence SIL OFL) : la construction de l'image
// ne dépend plus du réseau (VERIF-E2E-2, gêne 20).
const policeTitre = localFont({
  src: "./polices/archivo-black-latin.woff2",
  variable: "--police-titre",
  weight: "400",
  display: "swap",
});

const policeTexte = localFont({
  src: "./polices/manrope-latin.woff2",
  variable: "--police-texte",
  weight: "200 800",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Axion-IA Studio", template: "%s · Axion-IA Studio" },
  description: "Mon studio vidéo.",
  robots: { index: false, follow: false, nocache: true },
  applicationName: "Axion-IA Studio",
  appleWebApp: { capable: true, title: "Studio", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/icones/icone.svg", type: "image/svg+xml" }],
    apple: "/icones/icone-180.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#16120f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${policeTitre.variable} ${policeTexte.variable} h-full`}>
      <body className="min-h-full bg-fond text-texte">
        {children}
        <Toasts />
        <HoteConfirmationPrix />
        <EnregistrementPwa />
        <RepriseMiseAJour />
      </body>
    </html>
  );
}
