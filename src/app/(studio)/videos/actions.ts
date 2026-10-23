"use server";

/**
 * Actions serveur de Mes vidéos, de la fiche vidéo, du kit de publication et du partage (groupe C).
 * Chaque action commence par exigerSession() et renvoie un Resultat sérialisable.
 */
import { revalidatePath } from "next/cache";
import type { EtapeEditoriale, IdReseau, KitPublication, ModeEnvoiPublication, Ratio } from "@/domaine/types";
import { ErreurStudio, essayer, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { estimerRetouche } from "@/services/C-videos-publication-complements";
import { reexporter } from "@/services/fabrication";
import { appliquerSousTitres } from "@/services/recalque";
import { abandonnerModification, confirmerModification, proposerModification, suivreModification, type PropositionModification } from "@/services/modifications";
import { annulerTravail, rendreUrgent } from "@/services/travaux";
import { creerPartage, revoquerPartage } from "@/services/partages";
import { annulerVideo, listerANettoyer, nettoyerVideos } from "@/services/annulation-video";
import { mettreALaCorbeille, restaurerDeLaCorbeille, viderCorbeille } from "@/services/corbeille";
import { definirVotreMarque, rattacherVideo } from "@/services/series";
import { cocherAvantDePublier, compterPublicationsProgrammees, envoyerVersBuffer, modifierTexteKit, noterPublicationManuelle, regenererTexteKit } from "@/services/publications";
import {
  archiverVideos,
  changerEtapeEditoriale,
  choisirMiniature,
  choisirVersion,
  corrigerMotSousTitres,
  demanderRetouche,
  desarchiverVideo,
  enregistrerCommeModele,
  renommerVideo,
  reprendreVideo,
  abandonnerBrouillon,
} from "@/services/videos";
import type { AccordPrix } from "@/domaine/accord";

function rafraichir(videoId?: string) {
  revalidatePath("/videos");
  if (videoId) revalidatePath(`/videos/${videoId}`);
}

/* --- Fabrication en cours (lot M1b) --------------------------------- */

/** « Arrêter » : la vidéo passe « annulée » ; seules les étapes déjà faites sont payées. */
export async function arreterFabricationAction(travailId: string, videoId: string): Promise<Resultat<{ centimes: number }>> {
  await exigerSession();
  return essayer(async () => {
    const r = await annulerTravail(travailId);
    rafraichir(videoId);
    revalidatePath("/");
    return { centimes: r?.depense.centimes ?? 0 };
  });
}

/** « Passer devant » : la vidéo prend la première place de la file d'attente. */
export async function passerDevantAction(travailId: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await rendreUrgent(travailId);
    revalidatePath("/");
    return undefined;
  });
}

/* --- Mes vidéos ---------------------------------------------------- */

/** « Reprendre » une vidéo arrêtée : elle repasse en brouillon (rien n'est effacé). */
export async function reprendreVideoAction(id: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await reprendreVideo(id);
    rafraichir(id);
    return undefined;
  });
}

export async function archiverVideosAction(ids: string[]): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await archiverVideos(ids);
    rafraichir();
    return undefined;
  });
}

/** Avant d'archiver : combien de publications programmées seraient retirées du calendrier. */
export async function publicationsProgrammeesAction(ids: string[]): Promise<Resultat<number>> {
  await exigerSession();
  return essayer(() => compterPublicationsProgrammees(ids));
}

/** Abandonne un brouillon (archivé, jamais effacé) : toute autre vidéo (maquette, échec, annulée…) est laissée telle quelle. */
export async function abandonnerBrouillonAction(id: string): Promise<Resultat<void>> {
  await exigerSession();
  return essayer(() => abandonnerBrouillon(id));
}

export async function desarchiverVideosAction(ids: string[]): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    let restaurees = 0;
    for (const id of ids) if (await desarchiverVideo(id)) restaurees++;
    if (!restaurees) throw new ErreurStudio("INTROUVABLE", ids.length > 1 ? "Ces vidéos ne sont plus archivées." : "Cette vidéo n'est plus archivée.");
    rafraichir();
    return undefined;
  });
}

/** « Mettre à la corbeille » : restaurable 30 jours, puis supprimée. Mêmes refus que la suppression (fabrication, publication programmée). */
export async function mettreALaCorbeilleAction(ids: string[]): Promise<Resultat<{ mises: number; brouillonsBuffer: number; pagesRetirees: number }>> {
  await exigerSession();
  return essayer(async () => {
    const r = await mettreALaCorbeille(ids);
    rafraichir();
    for (const id of ids) revalidatePath(`/videos/${id}`);
    revalidatePath("/");
    return r;
  });
}

/**
 * « Annuler cette vidéo » : la met à la corbeille (restaurable 30 jours). Fabrication en cours : `travailId` l'arrête d'abord.
 * Une vidéo prête est refusée ; mêmes refus que la corbeille (publication programmée, envoi Buffer incertain).
 */
export async function annulerVideoAction(videoId: string, travailId?: string): Promise<Resultat<{ mises: number; centimes: number; brouillonsBuffer: number; pagesRetirees: number; refus?: string }>> {
  await exigerSession();
  return essayer(async () => {
    const r = await annulerVideo(videoId, travailId ? { travailId } : {});
    rafraichir(videoId);
    revalidatePath("/");
    return { mises: r.mises, centimes: r.centimes, brouillonsBuffer: r.brouillonsBuffer, pagesRetirees: r.pagesRetirees, refus: r.refus };
  });
}

/** « Nettoyer » : ce qui sera proposé (brouillons, échecs, annulées de plus de 24 h). Ne change rien. */
export async function listerANettoyerAction(): Promise<Resultat<{ id: string; titre: string; statut: string; formatId: string; modifieLe: string }[]>> {
  await exigerSession();
  return essayer(async () => (await listerANettoyer()).map((v) => ({ id: v.id, titre: v.titre, statut: v.statut, formatId: v.format.id, modifieLe: v.modifieLe })));
}

/** « Nettoyer » confirmé : met TOUTES les vidéos cochées à la corbeille (celles qui ne sont plus éligibles sont ignorées). */
export async function nettoyerVideosAction(ids: string[]): Promise<Resultat<{ mises: number; refusees: number; ignorees: number; brouillonsBuffer: number; pagesRetirees: number; messages: string[] }>> {
  await exigerSession();
  return essayer(async () => {
    const r = await nettoyerVideos(ids);
    rafraichir();
    for (const id of ids) revalidatePath(`/videos/${id}`);
    revalidatePath("/");
    return r;
  });
}

export async function restaurerDeLaCorbeilleAction(ids: string[]): Promise<Resultat<{ restaurees: number }>> {
  await exigerSession();
  return essayer(async () => {
    const r = await restaurerDeLaCorbeille(ids);
    // Rien de restauré : la vidéo n'est plus à la corbeille (supprimée entre-temps). On ne dit jamais « restaurée » pour rien.
    if (!r.restaurees) throw new ErreurStudio("INTROUVABLE", ids.length > 1 ? "Ces vidéos ne sont plus à la corbeille." : "Cette vidéo n'est plus à la corbeille.");
    rafraichir();
    for (const id of ids) revalidatePath(`/videos/${id}`);
    revalidatePath("/");
    return r;
  });
}

/** « Supprimer définitivement » depuis la corbeille (la confirmation est demandée par l'écran). */
export async function viderCorbeilleAction(ids: string[]): Promise<Resultat<{ supprimees: number }>> {
  await exigerSession();
  return essayer(async () => {
    const r = await viderCorbeille(ids);
    rafraichir();
    for (const id of ids) revalidatePath(`/videos/${id}`);
    revalidatePath("/");
    return r;
  });
}

/* --- Fiche vidéo --------------------------------------------------- */

export async function renommerVideoAction(id: string, titre: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await renommerVideo(id, titre);
    rafraichir(id);
    return undefined;
  });
}

export async function changerEtapeEditorialeAction(id: string, etape: EtapeEditoriale): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await changerEtapeEditoriale(id, etape);
    rafraichir(id);
    return undefined;
  });
}

export async function choisirVersionAction(videoId: string, versionId: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await choisirVersion(videoId, versionId);
    rafraichir(videoId);
    return undefined;
  });
}

export async function choisirMiniatureAction(videoId: string, miniatureId: string, titre?: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await choisirMiniature(videoId, miniatureId, titre);
    rafraichir(videoId);
    return undefined;
  });
}

/** « Refaire les miniatures » : celles dont le titre commence par un code interne sont refaites, titre nettoyé. */
export async function refaireMiniaturesAction(videoId: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    const { refaireMiniaturesTitreInterne } = await import("@/services/miniatures");
    await refaireMiniaturesTitreInterne(videoId);
    rafraichir(videoId);
    return undefined;
  });
}

export async function corrigerMotAction(videoId: string, segmentId: string, indexMot: number, mot: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    const propre = mot.trim();
    if (!propre) throw new ErreurStudio("MOT_VIDE", "Écrivez le mot corrigé.");
    await corrigerMotSousTitres(videoId, segmentId, indexMot, propre);
    rafraichir(videoId);
    return undefined;
  });
}

/** « Appliquer à la vidéo » (lot M4) : la correction des sous-titres est recomposée sur la vidéo, gratuitement. */
export async function appliquerSousTitresAction(videoId: string): Promise<Resultat<{ travailId: string }>> {
  await exigerSession();
  return essayer(async () => {
    const r = await appliquerSousTitres(videoId);
    rafraichir(videoId);
    return { travailId: r.travailId };
  });
}

export async function estimerRetoucheAction(videoId: string, planIds: string[]): Promise<Resultat<{ centimes: number; dureeSec: number }>> {
  await exigerSession();
  return essayer(async () => {
    const e = await estimerRetouche(videoId, planIds);
    return { centimes: e.total.centimes, dureeSec: e.dureeSec };
  });
}

export async function demanderRetoucheAction(videoId: string, planIds: string[], consigne: string, confirme: AccordPrix = false): Promise<Resultat<{ travailId: string }>> {
  await exigerSession();
  return essayer(async () => {
    const r = await demanderRetouche(videoId, planIds, consigne.trim(), { confirme });
    rafraichir(videoId);
    return { travailId: r.travailId };
  });
}

/* --- « Demander une modification » (lot M3) : rien ne part sans confirmation --- */

/** Traduit la demande et montre ce qui changerait (résumé, coût, plans). Ne lance rien. */
export async function proposerModificationAction(videoId: string, texte: string): Promise<Resultat<PropositionModification>> {
  await exigerSession();
  return essayer(() => proposerModification(videoId, texte));
}

/** Cas concret : relit une demande en cours de lecture (l'appel n'est jamais attendu par l'écran). */
export async function suivreModificationAction(videoId: string, propositionId: string): Promise<Resultat<PropositionModification>> {
  await exigerSession();
  return essayer(() => suivreModification(videoId, propositionId));
}

/** Will confirme la proposition : seuls les plans touchés sont refaits. */
export async function confirmerModificationAction(videoId: string, propositionId: string, confirme: AccordPrix = false): Promise<Resultat<{ travailId: string }>> {
  await exigerSession();
  return essayer(async () => {
    const r = await confirmerModification(videoId, propositionId, { confirme });
    rafraichir(videoId);
    return r;
  });
}

/** Will renonce : la proposition reste dans la conversation, marquée « abandonnée ». */
export async function abandonnerModificationAction(videoId: string, propositionId: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await abandonnerModification(videoId, propositionId);
    return undefined;
  });
}

export async function enregistrerCommeModeleAction(videoId: string, nom: string): Promise<Resultat<{ id: string }>> {
  await exigerSession();
  return essayer(async () => {
    const id = await enregistrerCommeModele(videoId, nom);
    revalidatePath("/modeles");
    return { id };
  });
}

export async function reexporterAction(videoId: string, ratio: Ratio, confirme: AccordPrix = false): Promise<Resultat<{ travailId: string }>> {
  await exigerSession();
  return essayer(async () => {
    const r = await reexporter(videoId, ratio, { confirme });
    rafraichir(videoId);
    return r;
  });
}

/* --- Kit de publication ------------------------------------------- */

export async function cocherAvantDePublierAction(videoId: string, cle: keyof KitPublication["avantDePublier"], valeur: boolean): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await cocherAvantDePublier(videoId, cle, valeur);
    rafraichir(videoId);
    return undefined;
  });
}

export async function modifierTexteKitAction(videoId: string, reseau: IdReseau, texte: string, motsDiese: string[], titre?: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await modifierTexteKit(videoId, reseau, texte, motsDiese, titre);
    rafraichir(videoId);
    return undefined;
  });
}

/** « Réécrire » : geste de Will (lot R2 : Claude s'il est choisi, prix affiché ; un texte retouché demande confirmation). */
export async function regenererTexteKitAction(videoId: string, reseau: IdReseau, remplacerRetouche = false): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await regenererTexteKit(videoId, reseau, { remplacerRetouche });
    rafraichir(videoId);
    return undefined;
  });
}

export async function envoyerVersBufferAction(
  videoId: string,
  reseaux: IdReseau[],
  dateIso: string,
  autreReseauConfirme = false,
  /** Lot R1b : comptes Buffer cochés, par réseau (réseaux à plusieurs comptes). */
  comptes: Partial<Record<IdReseau, string[]>> = {},
): Promise<Resultat<{ simulation: boolean; nombre: number; mode?: ModeEnvoiPublication; problemes: string[] }>> {
  await exigerSession();
  return essayer(async () => {
    const r = await envoyerVersBuffer(videoId, reseaux, dateIso, { autreReseauConfirme, comptes });
    rafraichir(videoId);
    revalidatePath("/calendrier");
    // Lot R1 : seuls les envois que Buffer a CONFIRMÉS sont comptés ; le reste est dit (à vérifier, refusé).
    const confirmes = r.simulation ? r.publications.length : r.publications.filter((p) => p.etatEnvoi === "envoye").length;
    return { simulation: r.simulation, nombre: confirmes, mode: r.mode, problemes: (r.problemes ?? []).map((p) => p.message) };
  });
}

export async function noterPublicationManuelleAction(videoId: string, reseau: IdReseau, dateIso: string, statut: "programmee" | "publiee"): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await noterPublicationManuelle(videoId, reseau, dateIso, statut);
    rafraichir(videoId);
    revalidatePath("/calendrier");
    return undefined;
  });
}

/* --- Partage ------------------------------------------------------- */

export async function creerPartageAction(videoId: string, options: { dureeJours: number | null; telechargementAutorise: boolean; sortieId?: string }): Promise<Resultat<{ chemin: string }>> {
  await exigerSession();
  return essayer(async () => {
    const p = await creerPartage(videoId, options);
    rafraichir(videoId);
    return { chemin: p.chemin };
  });
}

export async function revoquerPartageAction(videoId: string, partageId: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await revoquerPartage(partageId);
    rafraichir(videoId);
    return undefined;
  });
}

/* --- Équipe 7 : série et « Votre marque » (kit de la vidéo) ---------- */

export async function rattacherVideoAction(videoId: string, serieId: string | null): Promise<Resultat<{ episode?: number }>> {
  await exigerSession();
  return essayer(async () => {
    const r = await rattacherVideo(videoId, serieId);
    rafraichir(videoId);
    revalidatePath("/ecrire");
    return r;
  });
}

export async function definirVotreMarqueAction(videoId: string, valeur: boolean): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await definirVotreMarque(videoId, valeur);
    rafraichir(videoId);
    return undefined;
  });
}
