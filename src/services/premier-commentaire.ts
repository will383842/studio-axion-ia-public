/**
 * Premier commentaire d'une vidéo, pour un réseau : lu là où la vidéo le porte déjà, jamais inventé.
 * Ordre : « Cas concret » (texte de publication du réseau), « Image → vidéo » (livraison du réseau), puis la version
 * du générateur sur son propre réseau (sources et lien suivi). Lecture seule : ne publie rien.
 */
import "server-only";
import type { Id, IdReseau } from "@/domaine/types";
import { ID_MOTEUR_CAS_CONCRET, lireEntreesCasConcret } from "@/moteurs/montage-cas-concret";
import { depots } from "./_commun";

const objet = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const texteNonVide = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

async function deCasConcret(videoId: Id, reseau: IdReseau): Promise<string | undefined> {
  const video = await depots().videos.obtenir(videoId);
  const version = video?.versionChoisieId ? await depots().versions.obtenir(video.versionChoisieId) : null;
  if (!version || version.commande?.moteurId !== ID_MOTEUR_CAS_CONCRET) return undefined;
  // Une vidéo d'essai n'a pas de texte de publication à elle.
  if (lireEntreesCasConcret(version.commande.entrees).essai) return undefined;
  const publication = objet(objet(version.projetMontage)?.casConcret)?.publication;
  if (!Array.isArray(publication)) return undefined;
  const ligne = publication.map(objet).find((p) => p?.reseau === reseau);
  return texteNonVide(ligne?.premierCommentaire) ? ligne.premierCommentaire.trim() : undefined;
}

async function deImageVideo(videoId: Id, reseau: IdReseau): Promise<string | undefined> {
  const { travailImageVideo } = await import("./image-video-carte");
  const etat = objet(objet((await travailImageVideo(videoId))?.parametres)?.imageVideo);
  if (etat?.version !== "fabrication-iv/1" || !Array.isArray(etat.livraison)) return undefined;
  const ligne = etat.livraison.map(objet).find((l) => l?.reseau === reseau);
  return texteNonVide(ligne?.premierCommentaire) ? ligne.premierCommentaire.trim() : undefined;
}

/** Version du générateur : le « Premier commentaire » que le kit affiche (sources puis lien suivi). */
export function deLaVersion(variante: { reseau: IdReseau; champs: { sources: string[]; lienSuivi?: string } } | undefined, reseau: IdReseau): string | undefined {
  if (!variante || variante.reseau !== reseau) return undefined;
  const t = [...variante.champs.sources, variante.champs.lienSuivi].filter(texteNonVide).join("\n").trim();
  return t || undefined;
}

export async function premierCommentaireDeVideo(videoId: Id, reseau: IdReseau, variante?: Parameters<typeof deLaVersion>[0]): Promise<string | undefined> {
  return (await deCasConcret(videoId, reseau).catch(() => undefined)) ?? (await deImageVideo(videoId, reseau).catch(() => undefined)) ?? deLaVersion(variante, reseau);
}
