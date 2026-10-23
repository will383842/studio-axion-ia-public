"use server";

/**
 * Actions serveur de « Nouvelle vidéo · tableau animé ». Même modèle que les autres écrans : un Resultat
 * sérialisable, la session vérifiée par le service. La fabrication est REFUSÉE par le service sans un montant confirmé.
 * Aucune n'attend un appel à Claude : l'écriture et le découpage sont des tâches de fond (l'écran suit leur état).
 */
import { revalidatePath } from "next/cache";
import type { AccordPrix } from "@/domaine/accord";
import { essayer, type Resultat } from "@/services/_commun";
import type { CaseDejaVu } from "@/moteurs/montage-tableau/controles";
import type { PastilleControle } from "@/domaine/relecture-script";
import {
  cocherDejaVuTableau,
  controlerFicheTableau,
  controlerTexteTableau,
  corrigerFicheTableau,
  decouperScriptTableau,
  ecrireScriptTableau,
  fabriquerVideoTableau,
  reprendreMeilleureVersionTableau,
  relancerTableau,
  reprendreTacheTableau,
  rouvrirFicheTableau,
  suiviTacheTableau,
  type IssueCorrectionTableau,
  type IssueDecoupageTableau,
  type IssueEcritureTableau,
  type IssueFabricationTableau,
  type IssueRelanceTableau,
  type IssueRepriseTableau,
  type IssueRepriseTraceTableau,
} from "@/services/tableau-creation";
import type { VueTacheTableau } from "@/services/tableau-taches";

/**
 * « Découper en scènes » : `accord` = le coût affiché et confirmé (centimes d'euro), sinon rien ne part ; crée ou reprend
 * le brouillon et enregistre le découpage (tâche de fond, une relance au plus). Nouvelle vidéo (sans `videoId`) dont le texte
 * est d'un sujet déjà traité : le refus structuré `sujet-deja-traite` revient avant tout brouillon ; `sujet` = choix + jeton.
 */
export async function decouperScriptTableauAction(donnees: unknown, videoId?: string, accord?: AccordPrix, relu?: string, sujet?: { choix: "refaire" | "nouvel-angle"; jeton: string }): Promise<Resultat<IssueDecoupageTableau>> {
  return essayer(() => decouperScriptTableau(donnees, { videoId, accord, relu, ...(sujet ? { sujet } : {}) }));
}

/** « Reprendre la meilleure version » d'une écriture non livrée, depuis sa trace : aucun appel payant. */
export async function reprendreMeilleureVersionTableauAction(videoId: string): Promise<Resultat<IssueRepriseTraceTableau>> {
  return essayer(() => reprendreMeilleureVersionTableau(videoId));
}

/** Enregistre les corrections de la fiche comme une nouvelle version. */
export async function corrigerFicheTableauAction(videoId: string, corrections: unknown): Promise<Resultat<IssueCorrectionTableau>> {
  return essayer(() => corrigerFicheTableau(videoId, corrections));
}

/** Relire le script, avant « Découper en scènes » : contrôles en direct du texte relu. Gratuit, rien n'est écrit. */
export async function controlerTexteTableauAction(script: unknown, videoId?: string): Promise<Resultat<PastilleControle[]>> {
  return essayer(() => controlerTexteTableau(videoId, script));
}

/** Relire la fiche, avant « Enregistrer » ou « Fabriquer » : les règles de la fiche sur la relecture. Gratuit, rien n'est écrit. */
export async function controlerFicheTableauAction(videoId: string, script: unknown): Promise<Resultat<PastilleControle[]>> {
  return essayer(() => controlerFicheTableau(videoId, script));
}

/**
 * « Fabriquer la vidéo » : `accord` = le montant affiché et confirmé (centimes d'euro), sinon rien ne part ; `relu` = le
 * repère « script relu » (empreinte des lignes relues de la fiche), sinon refus.
 */
export async function fabriquerVideoTableauAction(videoId: string, accord?: AccordPrix, relu?: string): Promise<Resultat<IssueFabricationTableau>> {
  const r = await essayer(() => fabriquerVideoTableau(videoId, accord, {}, relu));
  if (r.ok && r.donnees.statut === "lancee") {
    revalidatePath("/videos");
    revalidatePath(`/videos/${videoId}`);
  }
  return r;
}

/**
 * « Écrire le script pour moi » : `accord` = le coût affiché et confirmé (centimes d'euro), sinon rien ne part ;
 * `accroche` : une autre accroche de la dernière écriture (seule l'écriture est refaite). Rend la main tout de suite.
 * Nouvelle vidéo (sans `videoId`) sur un sujet déjà traité : le refus structuré `sujet-deja-traite` (précédents avec liens, trois
 * suggestions, jeton) revient avant tout prix ; `sujet` = le choix et le jeton renvoyés tels quels pour passer.
 */
export async function ecrireScriptTableauAction(demande: unknown, options: { videoId?: string; accord?: AccordPrix; accroche?: number; sujet?: { choix: "refaire" | "nouvel-angle"; jeton: string } } = {}): Promise<Resultat<IssueEcritureTableau>> {
  return essayer(() => ecrireScriptTableau(demande, options));
}

/** Où en est la tâche de fond du brouillon (l'écran interroge toutes les 3 s). */
export async function suiviTacheTableauAction(videoId: string): Promise<Resultat<VueTacheTableau | null>> {
  return essayer(() => suiviTacheTableau(videoId));
}

/** « Réessayer » / « Reprendre » : les appels déjà payés sont gardés ; `accord` = le prix confirmé (écriture, découpage). */
export async function reprendreTacheTableauAction(videoId: string, accord?: AccordPrix): Promise<Resultat<IssueRepriseTableau>> {
  return essayer(() => reprendreTacheTableau(videoId, accord));
}

/** Case « Ce conseil n'est pas en première page d'une recherche » : cochée, datée du jour et gardée dans le brouillon. */
export async function cocherDejaVuTableauAction(videoId: string, coche: boolean): Promise<Resultat<{ dejaVu: CaseDejaVu | null }>> {
  return essayer(() => cocherDejaVuTableau(videoId, coche));
}

/**
 * « Relancer » après tout échec (page de la vidéo) : relecture et prix si l'arrêt est à la relecture ; sinon le même
 * travail reprend l'étape en échec et les suivantes, sans repayer la voix. `accord` : le prix confirmé, s'il en faut un.
 */
export async function relancerTableauAction(travailId: string, accord?: AccordPrix): Promise<Resultat<IssueRelanceTableau>> {
  const r = await essayer(() => relancerTableau(travailId, accord));
  if (r.ok && r.donnees.statut === "relancee") {
    revalidatePath("/videos");
    revalidatePath("/");
  }
  return r;
}

/** « Corriger la fiche » après tout arrêt : la vidéo redevient un brouillon (rien n'est perdu ; la voix payée est gardée). */
export async function rouvrirFicheTableauAction(videoId: string): Promise<Resultat<{ videoId: string }>> {
  const r = await essayer(() => rouvrirFicheTableau(videoId));
  if (r.ok) {
    revalidatePath("/videos");
    revalidatePath(`/videos/${videoId}`);
  }
  return r;
}
