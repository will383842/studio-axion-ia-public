import type { NextConfig } from "next";

const enDev = process.env.NODE_ENV !== "production";

/**
 * Stockage R2 (lot M1b) : le navigateur lit les médias et envoie les rushs DIRECTEMENT au seau, par des adresses
 * signées sur le point d'accès S3 du compte (`{compte}.r2.cloudflarestorage.com`, ou `{compte}.eu.…` pour un seau
 * européen). Un hôte personnalisé (`R2_PUBLIC_HOST`) connu à la construction de l'image s'ajoute.
 * La règle CORS du seau (PUT et GET depuis https://studio.axion-ia.com, en-tête ETag exposé) : deploiement/r2-cors.json.
 */
const hoteR2 = process.env.R2_PUBLIC_HOST?.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
const R2 = ["https://*.r2.cloudflarestorage.com", ...(hoteR2 && !hoteR2.endsWith(".r2.cloudflarestorage.com") ? [`https://${hoteR2}`] : [])].join(" ");

/**
 * CSP compatible Next (App Router) : les scripts en ligne de Next exigent 'unsafe-inline'
 * sans nonce ; 'unsafe-eval' seulement en développement. Médias : le studio (public/demo) et R2.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${enDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${R2}`,
  `media-src 'self' blob: ${R2}`,
  "font-src 'self' data:",
  `connect-src 'self' ${R2}${enDev ? " ws: wss:" : ""}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // NEXT_DIST_DIR : construire dans un autre dossier (ex. .next-verif) sans casser un serveur
  // déjà lancé sur .next (ses fichiers disparaîtraient sous lui : feuilles de style en 500).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  // Image Docker autonome (Dockerfile) : seul le nécessaire est copié.
  output: "standalone",
  // mammoth et unpdf (correcteur 3, B6) : lecture des .docx et .pdf importés, sur le serveur seulement.
  serverExternalPackages: ["@node-rs/argon2", "pg", "web-push", "mammoth", "unpdf"],
  // « Importer un fichier » (B6) passe par /api/import (session exigée AVANT la lecture du corps, 5 Mo au plus) :
  // les actions serveur gardent leur limite par défaut, 1 Mo (relecture paquet 4, sécurité P1).
  // Vignettes lues dans R2 par adresse signée (lot M1b) : la requête signée doit être gardée (pas de `search`).
  images: { remotePatterns: [{ protocol: "https", hostname: "**.r2.cloudflarestorage.com" }] },
  async headers() {
    return [
      {
        source: "/:chemin*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Lot G4c : « Enregistrer ici » filme avec la caméra avant du téléphone (le studio seul, jamais un tiers).
          { key: "Permissions-Policy", value: "camera=(self), geolocation=(), microphone=(self)" },
        ],
      },
    ];
  },
};

export default nextConfig;
