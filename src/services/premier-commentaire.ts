/**
 * Premier commentaire d'une vidéo, pour un réseau : lu là où la vidéo le porte déjà, jamais inventé.
 * Ordre : « Cas concret » (texte de publication du réseau), « Image → vidéo » (livraison du réseau), puis la version
 * du générateur sur son propre réseau (sources et lien suivi). Lecture seule : ne publie rien.
 */
import "server-only";
import type { Id, IdReseau } from "@/domaine/types";
import { ID_MOTEUR_CAS_CONCRET, lireEntreesCasConcret } from "@/moteurs/montage-cas-concret";
import { composerPremierCommentaire, modePremierCommentaire, type ModePremierCommentaire, type ObjectifCommentaire } from "@/domaine/ecriture-post/commentaire";
import type { ContenuSourceType } from "@/domaine/ecriture-post/contenu-source";
import { evaluerPremierCommentaire } from "@/generateur/roles/premier-commentaire";
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

/** L3-08 : proposition de premier commentaire à partir d'un contenu source seul (sans videoId : contenu importé à la main). */
export interface OptionsProposition {
  objectif?: ObjectifCommentaire;
  lien?: string;
  /** Preuve RC-08 faite : Instagram devient automatique. TikTok ne l'est jamais. */
  preuveRC08?: boolean;
}
export interface PropositionPremierCommentaire {
  mode: ModePremierCommentaire;
  /** Le texte à copier à la main (toujours présent). */
  texte: string;
  copier: boolean;
  /** Présent seulement si le texte part avec la publication (jamais Instagram avant RC-08, jamais TikTok). */
  firstComment?: string;
}

export async function proposerPremierCommentaire(contenuSource: ContenuSourceType, reseau: IdReseau, options: OptionsProposition = {}): Promise<PropositionPremierCommentaire> {
  const face = modePremierCommentaire(reseau, { preuveRC08: options.preuveRC08 });
  const texte = composerPremierCommentaire({ contenu: contenuSource, reseau, objectif: options.objectif, lien: options.lien });
  const echecs = evaluerPremierCommentaire({ texte }, { reseau, objectif: options.objectif, lien: options.lien });
  if (echecs.length > 0) throw new Error(`Premier commentaire refusé : ${echecs.join(" ; ")}`);
  return { mode: face.mode, texte, copier: face.copier, ...(face.transmettre ? { firstComment: texte } : {}) };
}
