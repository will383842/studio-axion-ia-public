import { NextResponse, type NextRequest } from "next/server";
import type { Ratio } from "@/domaine/types";
import { estIdReseau } from "@/domaine/reseaux-video";
import { sessionApi } from "@/services/auth";
import { fournisseur } from "@/services/_commun";
import { fichierATelecharger } from "@/services/telechargement-video";

export const dynamic = "force-dynamic";

/** Durée du lien signé (secondes). */
const DUREE_LIEN_SEC = 600;
const ID_VIDEO = /^[A-Za-z0-9_-]{1,80}$/;
const RATIOS: readonly Ratio[] = ["9:16", "1:1", "4:5", "16:9"];
const SANS_CACHE = { "Cache-Control": "no-store" };
/** Chemin du studio : commence par une seule barre, jamais « // » ni « / » (adresses vers un autre site). */
const CHEMIN_LOCAL = /^\/(?![\/\\])/;

const refus = (statut: number, erreur: string) => NextResponse.json({ erreur }, { status: statut, headers: SANS_CACHE });

/** Redirection ; un chemin du studio ne doit jamais sortir de son origine (le lien signé du stockage, lui, est externe). */
function aller(cible: URL, requete: NextRequest, externe = false) {
  if (!externe && cible.origin !== requete.nextUrl.origin) return refus(404, "Cette vidéo n'a pas de fichier à télécharger.");
  return NextResponse.redirect(cible, { status: 302, headers: SANS_CACHE });
}

/**
 * Téléchargement direct d'une vidéo : `?video=<id>[&reseau=<réseau>][&ratio=9:16][&fil=1]`.
 * SÉCURITÉ : la route ne reçoit que des identifiants, jamais une clé de stockage (elle vient de la base). Session
 * obligatoire (401), paramètres validés (400), vidéo absente ou à la corbeille = 404. Réponse : 302 vers un lien signé de
 * 600 s qui force l'enregistrement (le stockage est sur un autre domaine : l'attribut `download` d'un lien y est ignoré).
 */
export async function GET(requete: NextRequest) {
  if (!(await sessionApi())) return refus(401, "Connexion requise.");
  const p = requete.nextUrl.searchParams;
  const video = p.get("video");
  const reseau = p.get("reseau");
  const ratio = p.get("ratio");
  if (!video || !ID_VIDEO.test(video)) return refus(400, "Précisez la vidéo à télécharger.");
  if (reseau !== null && !estIdReseau(reseau)) return refus(400, "Ce réseau n'existe pas.");
  if (ratio !== null && !RATIOS.includes(ratio as Ratio)) return refus(400, "Ce format n'existe pas.");

  try {
    const fichier = await fichierATelecharger(video, {
      reseau: reseau !== null && estIdReseau(reseau) ? reseau : undefined,
      ratio: ratio !== null ? (ratio as Ratio) : undefined,
      fil: p.get("fil") === "1",
    });
    if (!fichier) return refus(404, "Cette vidéo n'a pas de fichier à télécharger.");
    // Média du studio (démonstration) : servi par le studio lui-même, rien à signer.
    // Chemin relatif simple seulement : « //hote/x » et « /\hote/x » sont des adresses vers un autre site.
    if (CHEMIN_LOCAL.test(fichier.cle)) return aller(new URL(fichier.cle, requete.nextUrl.origin), requete);
    const stockage = await fournisseur("stockage");
    const adresse = stockage.urlLectureDuree ? await stockage.urlLectureDuree(fichier.cle, DUREE_LIEN_SEC, { telechargerSous: fichier.nom }) : await stockage.urlLecture(fichier.cle);
    if (!adresse) return refus(404, "Cette vidéo n'a pas de fichier à télécharger.");
    // Adresse signée du stockage (https) ou chemin du studio ; tout le reste (« //hote », schéma inconnu) est refusé.
    if (!CHEMIN_LOCAL.test(adresse) && !/^https:\/\//.test(adresse)) return refus(404, "Cette vidéo n'a pas de fichier à télécharger.");
    return aller(new URL(adresse, requete.nextUrl.origin), requete, !CHEMIN_LOCAL.test(adresse));
  } catch (e) {
    console.error("[telechargement-video]", e);
    return refus(502, "Le téléchargement n'a pas pu démarrer. Réessayez dans un instant.");
  }
}
