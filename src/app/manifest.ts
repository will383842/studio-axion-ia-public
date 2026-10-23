import type { MetadataRoute } from "next";

/** Manifeste PWA : studio installable sur l'écran d'accueil du téléphone. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Axion-IA Studio",
    short_name: "Studio",
    description: "Mon studio vidéo",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#16120f",
    theme_color: "#16120f",
    lang: "fr",
    icons: [
      { src: "/icones/icone-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icones/icone-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icones/icone-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Générateur, lot G2 : raccourci d'application (appui long sur l'icône, Android) « + Matière », au micro.
    shortcuts: [{ name: "Nouvelle matière", short_name: "+ Matière", url: "/ecrire/matieres?ajout=matiere", icons: [{ src: "/icones/icone-192.png", sizes: "192x192" }] }],
  };
}
