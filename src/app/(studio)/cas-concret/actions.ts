"use server";

/**
 * Actions serveur de l'écran « Cas concret MD ». Même modèle que les autres écrans : un Resultat sérialisable, la session
 * vérifiée par le service. La fabrication est REFUSÉE par le service sans un montant confirmé au moins égal au prix.
 */
import type { ModificationEcran } from "@/moteurs/montage-cas-concret/modifier-script";
import { revalidatePath } from "next/cache";
import { ErreurStudio, essayer, type Resultat } from "@/services/_commun";
import { confirmerCas, estimerCas, preparerEtLancer, type ChoixAvantPrix, type DemandeCasConcret, type EstimationCas, type IssueCasConcret } from "@/services/cas-concret";
import { trouverCasAutorise } from "@/services/cas-concret-stock-acces";
import { remettreEnStock } from "@/services/cas-concret-traites";
import { avecConsigneVoix } from "@/services/cas-concret-voix";
import { confirmerFaitPorteB, demarrerPorteB, suivrePorteB, type EtatPorteB } from "@/services/cas-concret-porte-b";
import { versVueCasPorteB, type VueCas } from "@/components/formats/cas-concret/entree/vue";
import type { PastilleControle } from "@/domaine/relecture-script";
import { controlerScriptAValiderCasConcret, controlerScriptValideCasConcret, modifierScriptValideCasConcret, validerScriptCasConcret } from "@/services/cas-concret-scripts";

const RESEAUX = ["facebook", "instagram", "tiktok", "linkedin"];

/** Stock de cas : un cas du stock est inconnu tant que le réglage est éteint (refus propre, sans aucun effet). */
async function exigerCasDisponible(casId: string): Promise<void> {
  if (!(await trouverCasAutorise(casId))) throw new ErreurStudio("CAS_INCONNU", "Ce cas n'est pas disponible.");
}

/**
 * « Remettre en stock » : un cas traité redevient disponible (décision de Will, session exigée par le service, journalisée).
 * Rien n'est fabriqué, rien n'est dépensé, aucune vidéo n'est supprimée.
 */
export async function remettreEnStockAction(casId: string): Promise<Resultat<{ remisLe: string }>> {
  const r = await essayer(async () => {
    if (typeof casId !== "string" || !casId.trim()) throw new ErreurStudio("CAS_INCONNU", "Ce cas n'existe plus.");
    return remettreEnStock(casId.trim());
  });
  if (r.ok) revalidatePath("/cas-concret");
  return r;
}

/** « Je valide ce cas » : garde l'empreinte du cas et la date. */
export async function confirmerCasAction(casId: string): Promise<Resultat<{ casId: string }>> {
  const r = await essayer(async () => ({ casId: (await confirmerCas(casId)).casId }));
  if (r.ok) revalidatePath("/cas-concret");
  return r;
}

/** Le montant du bouton « Fabriquer la vidéo », pour ce choix, et le refus avant le prix (même phrase que le lancement). */
export async function estimerCasAction(casId: string, reseaux: string[], avecMot: boolean, choix: Omit<ChoixAvantPrix, "reseaux" | "avecMot"> = {}): Promise<Resultat<EstimationCas>> {
  return essayer(async () => {
    const e = await estimerCas(casId, reseaux, avecMot, choix);
    const refus = e.refus ? avecConsigneVoix({ statut: "refusee", phrase: e.refus }) : null;
    return refus?.statut === "refusee" ? { ...e, refus: refus.phrase } : e;
  });
}

/** « Fabriquer la vidéo » : `accordCentimes` = le montant affiché et confirmé, sinon rien ne part. */
export async function preparerEtLancerAction(demande: DemandeCasConcret): Promise<Resultat<IssueCasConcret>> {
  const r = await essayer(async () => avecConsigneVoix(await preparerEtLancer(demande)));
  if (r.ok && r.donnees.statut === "lancee") {
    revalidatePath("/videos");
    revalidatePath(`/videos/${r.donnees.videoId}`);
  }
  return r;
}

/** V4-3 · « Valider ce script » : le script écrit qui attend devient le script validé du cas (rejoué ensuite). */
export async function validerScriptAction(videoId: string, modifications: ModificationEcran[] = []): Promise<Resultat<{ casId: string }>> {
  const r = await essayer(async () => ({ casId: (await validerScriptCasConcret(videoId, { modifications })).casId }));
  if (r.ok) revalidatePath(`/videos/${videoId}`);
  return r;
}

/** Brique 3 · contrôle GRATUIT, pendant la relecture, des modifications du script qui attend la validation. */
export async function controlerScriptAValiderAction(videoId: string, modifications: ModificationEcran[] = []): Promise<Resultat<PastilleControle[]>> {
  return essayer(() => controlerScriptAValiderCasConcret(videoId, modifications));
}

/** Brique 3 · contrôle GRATUIT, pendant la relecture, des modifications du script validé d'un cas. */
export async function controlerScriptValideAction(casId: string, modifications: ModificationEcran[] = []): Promise<Resultat<PastilleControle[]>> {
  return essayer(async () => {
    await exigerCasDisponible(casId);
    return controlerScriptValideCasConcret(casId, modifications);
  });
}

/** Brique 3 · le script validé modifié avant le lancement : une NOUVELLE version validée (jamais en place). */
export async function modifierScriptValideAction(casId: string, modifications: ModificationEcran[]): Promise<Resultat<{ empreinte: string; numero: number; modifie: boolean }>> {
  const r = await essayer(async () => {
    await exigerCasDisponible(casId);
    const m = await modifierScriptValideCasConcret(casId, modifications);
    return { empreinte: m.empreinte, numero: m.numero, modifie: m.modifie };
  });
  if (r.ok && r.donnees.modifie) revalidatePath("/cas-concret");
  return r;
}

/* ------------------------------------------------------------------ */
/* Porte B (P2S) : réglage `casConcret.porteB`, éteint par défaut         */
/* ------------------------------------------------------------------ */

/** Ce que la case montre : une phrase d'aide, l'attente, l'échec, ou la feuille du cas prêt (montant et refus avant le prix). */
export type VuePorteB =
  | { statut: "refusee" | "en-cours" | "echec"; phrase: string; videoId?: string }
  | { statut: "pret"; cas: VueCas; montant: number; refus: string | null };

async function vueDe(etat: EtatPorteB): Promise<VuePorteB> {
  if (etat.statut !== "pret") return { statut: etat.statut, phrase: etat.phrase, ...("videoId" in etat ? { videoId: etat.videoId } : {}) };
  const e = await estimerCas(etat.cas.id, RESEAUX, false, { porteB: etat.videoId, empreinteVue: etat.empreinte });
  const refus = e.refus ? avecConsigneVoix({ statut: "refusee", phrase: e.refus }) : null;
  return { statut: "pret", cas: versVueCasPorteB(etat.cas, etat.empreinte, etat.videoId, etat.aConfirmer), montant: e.centimes, refus: refus?.statut === "refusee" ? refus.phrase : null };
}

/** « Faire la vidéo de ce cas » : texte trop court ou hors sujet, ou réglage éteint → une phrase, aucun appel ; sinon l'appel part, détaché. */
export async function demarrerPorteBAction(texte: string): Promise<Resultat<VuePorteB>> {
  return essayer(async () => vueDe(await demarrerPorteB(texte)));
}

/** L'écran relit la préparation du cas (jamais d'attente d'un appel). */
export async function suivrePorteBAction(videoId: string): Promise<Resultat<VuePorteB>> {
  return essayer(async () => vueDe(await suivrePorteB(videoId)));
}

/** « Confirmer » ou « Retirer » un chiffre à confirmer. */
export async function confirmerFaitPorteBAction(videoId: string, faitId: string, decision: "confirmer" | "retirer"): Promise<Resultat<VuePorteB>> {
  return essayer(async () => vueDe(await confirmerFaitPorteB(videoId, faitId, decision)));
}
