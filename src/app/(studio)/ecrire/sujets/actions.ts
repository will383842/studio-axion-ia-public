"use server";

/** Actions du générateur (lot G1b) : sujet, versions, ordre de publication, « À ranger ». Chacune commence par exigerSession(). */
import { revalidatePath } from "next/cache";
import { ordreValide } from "@/domaine/classement-generateur";
import type { Adresse, ModeDiction, ReseauDeclinaison, TypeMatiere, VarianteReseau } from "@/domaine/types";
import { exigerSession } from "@/services/auth";
import { ecrireParametre, ErreurStudio, essayer, type Resultat } from "@/services/_commun";
import { proposerTypeMatiere } from "@/domaine/derivations-generateur";
import {
  ajouterDeclinaison,
  choisirAccroches,
  choisirAngle,
  completerSujetParSaisie,
  donnerAccordEtReprendre,
  etatEcriture,
  lancerGeneration,
  regenererVariante,
  validerException,
  validerVariantes,
} from "@/services/boucle-generation";
import { archiverSujet, rangerVideo, rejeterVariante, restaurerSujet, revaliderVariantes, revenirVersionPrecedente, type BriefSujet } from "@/services/generateur";
import { ajouterIdee } from "@/services/idees";
import { confirmationPropre, ErreurSujetDejaTraite, type RefusSujetDejaTraite } from "@/services/sujet-central-controle";
import { confirmerFabricationComplete, fabriquerSecondeOuverture, monterJeLis, planFabricationSujet } from "@/services/fabrication-reseaux";
import type { Ratio } from "@/domaine/types";
import { listerVideosHeygen, rattacherFichierHeygen, rattacherVideoHeygen, type VideoHeygenAffichee } from "@/services/videos-heygen";
import { accordPropre, type AccordPrix } from "@/domaine/accord";
import type { LigneScript, PastilleControle } from "@/domaine/relecture-script";

function rafraichir(id?: string) {
  revalidatePath("/ecrire");
  if (id) revalidatePath(`/ecrire/sujets/${id}`);
  revalidatePath("/");
}

/** Écran Sujet (G4) : l'étape 0 gratuite, puis l'écriture part dans la boucle (rien n'est appelé dans cette requête). */
export async function creerSujetAction(brief: BriefSujet): Promise<Resultat<{ id: string; ecrit: boolean } | RefusSujetDejaTraite>> {
  await exigerSession();
  return essayer(async () => {
    // Lot L5 : la confirmation « Refaire quand même » est une donnée non sûre (choix connu + jeton, sinon rien).
    // `estDemo` ne vient jamais du navigateur : il ferait sauter tout le contrôle.
    const { confirmationSujet, ...reste } = brief;
    delete reste.estDemo;
    // `origineUsine` non plus : l'écran ne l'envoie jamais (l'Usine passe par `ecrireSujetDeLUsine`, côté serveur) et une clé forgée fausserait la comparaison.
    delete reste.origineUsine;
    const confirmation = confirmationPropre(confirmationSujet);
    try {
      const r = await lancerGeneration({ ...reste, ...(confirmation ? { confirmationSujet: confirmation } : {}) });
      rafraichir(r.scriptMaitreId);
      return { id: r.scriptMaitreId, ecrit: r.ok };
    } catch (e) {
      // Sujet déjà traité : rien n'est créé ni payé, l'écran reçoit le statut structuré (précédents, suggestions, jeton).
      if (e instanceof ErreurSujetDejaTraite) return e.refus;
      throw e;
    }
  });
}

export async function ajouterDeclinaisonAction(id: string, options: { formatId?: string; mode?: ModeDiction; adresse?: Adresse; reseaux?: ReseauDeclinaison[] }): Promise<Resultat<{ ecrit: boolean; message?: string }>> {
  await exigerSession();
  return essayer(async () => {
    const r = await ajouterDeclinaison(id, options);
    rafraichir(id);
    return r.ok ? { ecrit: true } : { ecrit: false, message: r.ceQuIlFaudrait };
  });
}

/**
 * Une matière dictée sur la fiche du sujet (E2E-2 parcours n° 13, données n° 4) : type choisi (ou proposé), accord pour
 * un cas client ; rangée comme dans « Mes matières ». Renvoie le type retenu et si elle attend un accord.
 */
export async function completerSujetAction(id: string, texte: string, choix: { type?: TypeMatiere; accord?: boolean } = {}): Promise<Resultat<{ ecrit: boolean; type: TypeMatiere; sansAccord: boolean }>> {
  await exigerSession();
  return essayer(async () => {
    const t = texte.trim();
    const { resultat, matiere } = await completerSujetParSaisie(id, { texte: t, type: choix.type ?? proposerTypeMatiere(t), accord: choix.accord });
    rafraichir(id);
    return { ecrit: resultat.ok, type: matiere.type, sansAccord: !!matiere.accord?.requis && !matiere.accord.obtenu };
  });
}

/** « J'ai son accord » sur une matière du sujet : l'accord est noté, l'écriture repart. */
export async function donnerAccordEtReprendreAction(id: string, matiereId: string): Promise<Resultat<{ ecrit: boolean }>> {
  await exigerSession();
  return essayer(async () => {
    const r = await donnerAccordEtReprendre(id, matiereId);
    rafraichir(id);
    revalidatePath("/ecrire/matieres");
    return { ecrit: r.ok };
  });
}

/**
 * « Garder en idée » (E2E-2 parcours n° 16) : une seule idée pour un même texte (deux touchers, ou deux passages, ne la
 * doublent pas) ; le sujet sans numéro d'où elle vient est RANGÉ (archivé, jamais effacé) : il ne reste pas dans Écrire.
 */
export async function garderEnIdeeAction(texte: string, sujetId?: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    const t = texte.trim();
    const { depots } = await import("@/services/_commun");
    const deja = (await depots().idees.lister((i) => i.texte.trim() === t && i.etat !== "archivee"))[0];
    if (!deja) await ajouterIdee(t);
    if (sujetId) {
      const m = await depots().scriptsMaitres.obtenir(sujetId);
      if (m && m.numero === undefined && !m.archiveLe) await archiverSujet(sujetId);
    }
    rafraichir(sujetId);
    revalidatePath("/ecrire");
    return undefined;
  });
}

export async function validerLimiteAction(id: string, texte?: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await validerException(id, texte?.trim() ? { texte } : "c-est-juste");
    rafraichir(id);
    return undefined;
  });
}

export async function validerVersionsAction(id: string, varianteIds: string[]): Promise<Resultat<number>> {
  await exigerSession();
  return essayer(async () => {
    const n = (await validerVariantes(varianteIds)) + (await revaliderVariantes(varianteIds));
    rafraichir(id);
    return n;
  });
}

export async function rejeterVersionAction(id: string, varianteId: string, motifs: NonNullable<NonNullable<VarianteReseau["avisWill"]>["motifs"]>): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await rejeterVariante(varianteId, motifs);
    rafraichir(id);
    return undefined;
  });
}

export async function versionAvantAction(id: string, varianteId: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await revenirVersionPrecedente(varianteId);
    rafraichir(id);
    return undefined;
  });
}

export async function archiverSujetAction(id: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await archiverSujet(id);
    rafraichir(id);
    return undefined;
  });
}

export async function restaurerSujetAction(id: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await restaurerSujet(id);
    rafraichir(id);
    return undefined;
  });
}

/** Ordre de publication proposé (`publication.ordreParDefaut`), modifiable d'un toucher. */
export async function enregistrerOrdrePublicationAction(ordre: string[]): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await ecrireParametre("publication.ordreParDefaut", ordreValide(ordre));
    return undefined;
  });
}

export async function rangerVideoAction(videoId: string, varianteId: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await rangerVideo(videoId, varianteId);
    revalidatePath("/videos");
    revalidatePath("/videos/a-ranger");
    rafraichir();
    return undefined;
  });
}

/* ---------- Lot G4 : écriture réelle, pause « je choisis », retouches, fabrication intérimaire ---------- */

export async function etatEcritureAction(id: string): Promise<Resultat<Awaited<ReturnType<typeof etatEcriture>>>> {
  await exigerSession();
  return essayer(() => etatEcriture(id));
}

export async function choisirAngleAction(id: string, index: number): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await choisirAngle(id, index);
    rafraichir(id);
    return undefined;
  });
}

export async function choisirAccrochesAction(id: string, accrocheIds: string[]): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await choisirAccroches(id, accrocheIds);
    rafraichir(id);
    return undefined;
  });
}

export async function regenererVarianteAction(id: string, varianteId: string, demande: "autre-accroche" | "plus-court" | "ameliorer"): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await regenererVariante(varianteId, demande);
    rafraichir(id);
    return undefined;
  });
}

/**
 * « Reprendre (≈ X €) » : relance, par un geste de Will, l'écriture de CE sujet bloquée (crédit, limite du mois, plafond).
 * `accord` : le prix (centimes d'euro) montré sur le bouton ; le serveur le refuse s'il est plus bas que le prix du jour.
 */
export async function reprendreEcrituresAction(id: string, accord?: number | true): Promise<Resultat<number>> {
  await exigerSession();
  return essayer(async () => {
    const { reprendreEcriture } = await import("@/services/boucle-generation");
    const n = await reprendreEcriture(id, accordPropre(accord));
    rafraichir(id);
    return n;
  });
}

/** E2E-2 argent n° 2 : « Reprendre l'écriture » arrêtée sur une panne (refus net, Claude muet trois fois). */
export async function reprendreEcritureArreteeAction(id: string, accord?: number | true): Promise<Resultat<boolean>> {
  await exigerSession();
  return essayer(async () => {
    const { reprendreEcritureArretee } = await import("@/services/boucle-generation");
    // Relecture finale G1 : le supplément possible est confirmé sur la feuille de prix (montant renvoyé ici).
    const ok = await reprendreEcritureArretee(id, accordPropre(accord));
    rafraichir(id);
    return ok;
  });
}

/** E2E-1 n° 5 : prix de « Fabriquer les N » avec les formats cochés (lecture seule, rien n'est créé). */
export async function planFabricationNAction(id: string, ratiosOption: Ratio[]): Promise<Resultat<{ versions: { varianteId: string; prix: string }[]; total: string; totalCentimes: number; sansDeclinaison: string; avatarParle?: string } | null>> {
  await exigerSession();
  return essayer(async () => {
    const { formaterMontant } = await import("@/lib/montants");
    const { phraseAvatarParle } = await import("@/domaine/double-reel");
    const p = await planFabricationSujet(id, { ratiosOption });
    if (!p) return null;
    return { versions: p.versions.map((x) => ({ varianteId: x.varianteId, prix: formaterMontant(x.cout) })), total: formaterMontant(p.total), totalCentimes: p.total.centimes, sansDeclinaison: formaterMontant(p.sansDeclinaison), avatarParle: p.avatarParle ? phraseAvatarParle(p.avatarParle, p.versions.filter((x) => !x.videoId).length) : undefined };
  });
}

/** G6 « 2e ouverture Reels ». */
export async function secondeOuvertureAction(id: string, varianteId: string, operationId: string, prixConfirme?: AccordPrix): Promise<Resultat<{ videoId: string }>> {
  await exigerSession();
  return essayer(async () => {
    const r = await fabriquerSecondeOuverture(varianteId, { operationId, lancer: true, prixConfirme: accordPropre(prixConfirme) });
    rafraichir(id);
    revalidatePath("/videos");
    return { videoId: r.videoId };
  });
}

/** G6 : raccord visible, Will confirme la fabrication complète au coût affiché. */
export async function fabriquerEnEntierAction(id: string, videoId: string, confirme?: AccordPrix): Promise<Resultat<undefined>> {
  await exigerSession();
  return essayer(async () => {
    await confirmerFabricationComplete(videoId, { confirme: accordPropre(confirme) });
    rafraichir(id);
    return undefined;
  });
}

/** G6b « Monter ma prise » (0 €). */
export async function monterJeLisAction(id: string, varianteId: string, confirme?: AccordPrix): Promise<Resultat<{ videoId: string }>> {
  await exigerSession();
  return essayer(async () => {
    const r = await monterJeLis(varianteId, { confirme: accordPropre(confirme) });
    rafraichir(id);
    revalidatePath("/videos");
    return { videoId: r.videoId };
  });
}

/** Lignes reçues de l'écran « Relire le script » : formes vérifiées, tailles bornées (rien d'autre ne passe). */
function lignesRecues(lignes: unknown): LigneScript[] {
  if (!Array.isArray(lignes) || lignes.length > 400) throw new ErreurStudio("SCRIPT_A_RELIRE", "Relisez le script avant de lancer la vidéo.");
  return lignes.map((l: Partial<LigneScript>) => {
    if (typeof l?.id !== "string" || typeof l.dit !== "string" || l.dit.length > 2000) throw new ErreurStudio("SCRIPT_A_RELIRE", "Une phrase est trop longue ou illisible.");
    const ecrits = Array.isArray(l.ecrits) ? l.ecrits.slice(0, 8).map((e) => ({ texte: String(e?.texte ?? "").slice(0, 300), modifiable: !!e?.modifiable })) : undefined;
    return { id: l.id, dit: l.dit, ...(ecrits ? { ecrits } : {}) };
  });
}

/** Relire le script : contrôle EN DIRECT du texte relu, GRATUIT (rien n'est enregistré ni payé). `varianteId` absent : les N. */
export async function controlerRelectureAction(id: string, varianteId: string | null, lignes: LigneScript[]): Promise<Resultat<PastilleControle[]>> {
  await exigerSession();
  return essayer(async () => {
    const { controlerRelecture } = await import("@/services/generateur-ecran");
    return controlerRelecture({ sujetId: id, ...(varianteId ? { varianteId } : {}) }, lignesRecues(lignes));
  });
}

/** Relire et modifier (0 €) : les modifications sont enregistrées en lot ; la version redevient « à relire ». */
export async function enregistrerRelectureAction(id: string, varianteId: string, lignes: LigneScript[]): Promise<Resultat<{ modifiees: number; phrase?: string }>> {
  await exigerSession();
  return essayer(async () => {
    const { enregistrerRelecture } = await import("@/services/generateur-ecran");
    const r = await enregistrerRelecture({ sujetId: id, varianteId }, lignesRecues(lignes));
    rafraichir(id);
    return { modifiees: r.modifiees, ...(r.phrase ? { phrase: r.phrase } : {}) };
  });
}

/**
 * « Fabriquer » et « Fabriquer les N » (`varianteId` absent) : SEULEMENT après « Relire le script ». Le repère « script
 * relu » (empreinte du texte relu) est exigé par le serveur ; `accord` = le montant confirmé à l'écran (centimes).
 */
export async function fabriquerApresRelectureAction(
  id: string,
  varianteId: string | null,
  o: { lignes: LigneScript[]; empreinte: string; operationId: string; accord?: AccordPrix; ratiosOption?: Ratio[]; malgreVoyant?: boolean },
): Promise<Resultat<{ videoId?: string; n?: number; enAttente?: string; phrase?: string }>> {
  await exigerSession();
  return essayer(async () => {
    const { fabriquerApresRelecture } = await import("@/services/generateur-ecran");
    const r = await fabriquerApresRelecture(
      { sujetId: id, ...(varianteId ? { varianteId } : {}) },
      {
        lignes: lignesRecues(o?.lignes),
        empreinte: typeof o?.empreinte === "string" ? o.empreinte : "",
        operationId: String(o?.operationId ?? "").slice(0, 120),
        accord: accordPropre(o?.accord),
        ratiosOption: Array.isArray(o?.ratiosOption) ? o.ratiosOption : undefined,
        malgreVoyant: o?.malgreVoyant === true,
      },
    );
    rafraichir(id);
    revalidatePath("/videos");
    return r;
  });
}

/** Vérification E2E n° 1, n° 3 : prix, total du jour, budget restant et crédits avant une fabrication payante (lecture seule). */
export async function resumeDepenseAction(prixCentimes: number, formatIds?: string[]): Promise<Resultat<Awaited<ReturnType<typeof import("@/services/generateur-depenses").lireResumeDepense>>>> {
  await exigerSession();
  return essayer(async () => {
    const { lireResumeDepense } = await import("@/services/generateur-depenses");
    const { centimes } = await import("@/lib/montants");
    return lireResumeDepense(centimes(Math.max(0, Math.round(prixCentimes))), Array.isArray(formatIds) ? formatIds.filter((f) => typeof f === "string").slice(0, 20) : undefined);
  });
}

/** Vérification E2E n° 1, n° 8 : « Déjà traité en n° X le JJ/MM » avant d'écrire (gratuit). */
export async function sujetsDejaTraitesAction(idee: string, formatId?: string): Promise<Resultat<{ id: string; numero: number; le: string; idee: string }[]>> {
  await exigerSession();
  return essayer(async () => {
    const { sujetsDejaTraites } = await import("@/services/generateur-ecran");
    return sujetsDejaTraites(idee, typeof formatId === "string" ? formatId : undefined);
  });
}

/* --- Lot R7 : « Ma vidéo HeyGen » (faite dans l'application HeyGen, rattachée à sa version ; gratuit) --- */

export async function listerVideosHeygenAction(): Promise<Resultat<{ branche: boolean; videos: VideoHeygenAffichee[] }>> {
  await exigerSession();
  return essayer(() => listerVideosHeygen());
}

export async function rattacherVideoHeygenAction(id: string, varianteId: string, idExterne: string): Promise<Resultat<{ videoId: string }>> {
  await exigerSession();
  return essayer(async () => {
    if (typeof idExterne !== "string" || !/^[A-Za-z0-9_-]{1,120}$/.test(idExterne)) throw new ErreurStudio("VIDEO", "Choisissez une vidéo.");
    const r = await rattacherVideoHeygen(String(varianteId), idExterne);
    rafraichir(id);
    return { videoId: r.videoId };
  });
}

export async function rattacherFichierHeygenAction(id: string, varianteId: string, fichierId: string): Promise<Resultat<{ videoId: string }>> {
  await exigerSession();
  return essayer(async () => {
    const r = await rattacherFichierHeygen(String(varianteId), String(fichierId));
    rafraichir(id);
    return { videoId: r.videoId };
  });
}
