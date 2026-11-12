/**
 * KIT-CC-IV · textes de publication rangés dans la version d'une vidéo « Cas concret » ou « Image → vidéo ».
 * Ces deux formats écrivent eux-mêmes leurs textes : le kit de publication les lit ici (source « variante »),
 * le rédacteur « texte-reseaux » n'est jamais appelé pour eux. Lecture seule : ne publie ni n'écrit rien.
 */
import "server-only";
import type { Id, IdReseau, TexteReseau } from "@/domaine/types";
import { ID_FORMAT_IMAGE_VIDEO } from "@/formats/image-video";
import { ID_MOTEUR_CAS_CONCRET, lireEntreesCasConcret } from "@/moteurs/montage-cas-concret";
import { listerReseaux } from "@/reseaux";
import { depots } from "./_commun";

export type FormatSansRedacteur = "cas-concret" | "image-video";
export type TextesDeVersion = Partial<Record<IdReseau, TexteReseau>>;

const objet = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const texteNonVide = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

/** Mots-dièse écrits par le format (`motsDiese` ou `hashtags`), sinon aucun : rien n'est deviné dans le texte. */
function motsDieseDe(ligne: Record<string, unknown>): string[] {
  const brut = Array.isArray(ligne.motsDiese) ? ligne.motsDiese : Array.isArray(ligne.hashtags) ? ligne.hashtags : [];
  return brut.filter(texteNonVide).map((m) => m.trim());
}

function versTexte(ligne: Record<string, unknown> | null): TexteReseau | null {
  if (!ligne || !texteNonVide(ligne.texte)) return null;
  const titre = texteNonVide(ligne.titre) ? ligne.titre.trim() : undefined;
  return { texte: ligne.texte.trim(), motsDiese: motsDieseDe(ligne), ...(titre ? { titre } : {}), source: "variante" };
}

function parReseau(lignes: unknown, accepte: (l: Record<string, unknown>) => boolean = () => true): TextesDeVersion {
  const connus = new Set<string>(listerReseaux().map((r) => r.id));
  const out: TextesDeVersion = {};
  if (!Array.isArray(lignes)) return out;
  for (const brut of lignes) {
    const l = objet(brut);
    if (!l || typeof l.reseau !== "string" || !connus.has(l.reseau) || !accepte(l)) continue;
    const t = versTexte(l);
    if (t && !out[l.reseau as IdReseau]) out[l.reseau as IdReseau] = t;
  }
  return out;
}

/** Le format de cette vidéo écrit-il lui-même ses textes ? `null` : format ordinaire (rédacteur habituel). */
export async function formatSansRedacteur(videoId: Id): Promise<FormatSansRedacteur | null> {
  const video = await depots().videos.obtenir(videoId);
  if (!video) return null;
  if (video.formatId === ID_FORMAT_IMAGE_VIDEO) return "image-video";
  const version = video.versionChoisieId ? await depots().versions.obtenir(video.versionChoisieId) : null;
  return version?.commande?.moteurId === ID_MOTEUR_CAS_CONCRET ? "cas-concret" : null;
}

/**
 * Textes de la version par réseau. `null` : format ordinaire. Objet vide : le format n'a rangé aucun texte utilisable
 * (illisible, vide, vidéo d'essai, réseau non livré) : le kit reste sans texte, jamais de texte d'essai.
 */
export async function textesDeLaVersion(videoId: Id): Promise<TextesDeVersion | null> {
  const format = await formatSansRedacteur(videoId);
  if (!format) return null;
  try {
    if (format === "cas-concret") {
      const video = await depots().videos.obtenir(videoId);
      const version = video?.versionChoisieId ? await depots().versions.obtenir(video.versionChoisieId) : null;
      if (!version || lireEntreesCasConcret(version.commande.entrees).essai) return {};
      return parReseau(objet(objet(version.projetMontage)?.casConcret)?.publication);
    }
    const { travailImageVideo } = await import("./image-video-carte");
    const etat = objet(objet((await travailImageVideo(videoId))?.parametres)?.imageVideo);
    if (etat?.version !== "fabrication-iv/1") return {};
    return parReseau(etat.livraison, (l) => l.version !== "aucune");
  } catch {
    return {};
  }
}
