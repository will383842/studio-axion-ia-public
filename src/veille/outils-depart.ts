/**
 * Outils surveillés au départ (`VEILLE-DES-OUTILS.md`), posés par la migration 15 s'ils manquent.
 * La « version utilisée » est lue DANS LE CODE : `studio-rendu/package.json` (généré dans `versions-utilisees.ts`),
 * réglages des fournisseurs (modèles fal.ai, version HeyGen), image du conteneur de rendu (FFmpeg de Debian 12).
 * Identifiants stables : la migration est idempotente et ne supprime rien.
 */
import type { SourceVeille, VeilleOutil } from "@/domaine/types";
import { MODELES_FAL } from "@/fournisseurs/illustration/fal";
import { VERSIONS_STUDIO_RENDU } from "./versions-utilisees";

export interface OutilDepart {
  id: string;
  nom: string;
  role: string;
  source: SourceVeille;
  versionUtilisee?: string;
}

/** Nom court d'un modèle fal.ai (« fal-ai/nano-banana » → « nano-banana »). */
function modeleCourt(m: string): string {
  return m.replace(/^fal-ai\//, "").replace(/\/(image-to-video|text-to-image)$/, "");
}

/**
 * FFmpeg du conteneur de rendu : paquet `ffmpeg` de Debian 12 (bookworm), image `node:22-bookworm-slim`
 * (`deploiement/studio-rendu/Dockerfile`). À changer avec l'image.
 */
export const VERSION_FFMPEG_RENDU = "5.1";

export const OUTILS_DEPART: OutilDepart[] = [
  { id: "veille-heygen", nom: "HeyGen", role: "Double, voix et décors", source: { type: "page", url: "https://developers.heygen.com/changelog" }, versionUtilisee: "v3" },
  { id: "veille-elevenlabs", nom: "ElevenLabs", role: "Voix de secours", source: { type: "page", url: "https://elevenlabs.io/docs/changelog" } },
  {
    id: "veille-remotion",
    nom: "Remotion",
    role: "Montage",
    source: { type: "github", depot: "remotion-dev/remotion", fichiersSurveilles: ["LICENSE.md"] },
    versionUtilisee: VERSIONS_STUDIO_RENDU.remotion,
  },
  {
    id: "veille-fal",
    nom: "Modèles d'illustration",
    role: "Images et clips (fal.ai)",
    source: { type: "fal" },
    versionUtilisee: `${modeleCourt(MODELES_FAL.image)} · ${modeleCourt(MODELES_FAL.clip).replace("bytedance/", "")}`,
  },
  { id: "veille-claude", nom: "Claude", role: "Scripts et contrôles", source: { type: "anthropic" } },
  { id: "veille-whisperx", nom: "WhisperX", role: "Sous-titres", source: { type: "github", depot: "m-bain/whisperX" } },
  { id: "veille-ffmpeg", nom: "FFmpeg", role: "Image et son", source: { type: "github", depot: "FFmpeg/FFmpeg" }, versionUtilisee: VERSION_FFMPEG_RENDU },
  // Réseaux : pages d'aide officielles (formats, durées, règles sur les contenus faits avec l'IA). Changement = alerte.
  { id: "veille-tiktok", nom: "TikTok", role: "Règles et formats", source: { type: "page", url: "https://support.tiktok.com/fr/using-tiktok/creating-videos/ai-generated-content" } },
  { id: "veille-instagram", nom: "Instagram", role: "Règles et formats", source: { type: "page", url: "https://www.facebook.com/help/instagram/1038071743007909" } },
  { id: "veille-youtube", nom: "YouTube", role: "Règles et formats", source: { type: "page", url: "https://support.google.com/youtube/answer/14328491?hl=fr" } },
  { id: "veille-linkedin", nom: "LinkedIn", role: "Règles et formats", source: { type: "page", url: "https://www.linkedin.com/help/linkedin/answer/a564109" } },
];

/** Outil neuf, tel qu'enregistré la première fois (état gris tant qu'aucune lecture n'a réussi). */
export function outilNeuf(o: OutilDepart, maintenant: string, ajoutePar: VeilleOutil["ajoutePar"] = "depart"): VeilleOutil {
  return { id: o.id, nom: o.nom, role: o.role, source: o.source, ...(o.versionUtilisee ? { versionUtilisee: o.versionUtilisee } : {}), etat: "injoignable", ajoutePar, creeLe: maintenant, modifieLe: maintenant };
}

/**
 * Adresse donnée par Will → source : un dépôt GitHub, un paquet npm, sinon la page elle-même.
 * Renvoie null si l'adresse n'est pas une adresse web publique.
 */
export function sourceDepuisAdresse(adresse: string): SourceVeille | null {
  let u: URL;
  try {
    u = new URL(adresse.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[?::1)/.test(u.hostname)) return null;
  const morceaux = u.pathname.split("/").filter(Boolean);
  if (u.hostname === "github.com" && morceaux.length >= 2) return { type: "github", depot: `${morceaux[0]}/${morceaux[1]}` };
  if (u.hostname === "www.npmjs.com" && morceaux[0] === "package" && morceaux[1]) {
    return { type: "npm", paquet: morceaux[1].startsWith("@") && morceaux[2] ? `${morceaux[1]}/${morceaux[2]}` : morceaux[1] };
  }
  return { type: "page", url: u.toString() };
}

/**
 * Pose les outils de départ qui manquent et recale la « version utilisée » sur le code (après une mise à jour
 * décidée par Will). Idempotent, AUCUNE suppression ; un outil rangé par Will reste rangé.
 */
export async function assurerOutilsDepart(
  depot: { obtenir(id: string): Promise<VeilleOutil | null>; enregistrer(o: VeilleOutil): Promise<VeilleOutil>; modifier(id: string, p: Partial<VeilleOutil>): Promise<VeilleOutil> },
  maintenant: string,
): Promise<{ ajoutes: string[]; versionsMisesAJour: string[] }> {
  const ajoutes: string[] = [];
  const versionsMisesAJour: string[] = [];
  for (const o of OUTILS_DEPART) {
    const existant = await depot.obtenir(o.id);
    if (!existant) {
      await depot.enregistrer(outilNeuf(o, maintenant));
      ajoutes.push(o.nom);
    } else if (o.versionUtilisee && existant.versionUtilisee !== o.versionUtilisee) {
      await depot.modifier(o.id, { versionUtilisee: o.versionUtilisee, modifieLe: maintenant });
      versionsMisesAJour.push(`${o.nom} ${existant.versionUtilisee ?? "?"} → ${o.versionUtilisee}`);
    }
  }
  return { ajoutes, versionsMisesAJour };
}
