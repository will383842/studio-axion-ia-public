/**
 * BRUITAGES — service (lot du 02/10, D1 ; `docs/LOT-INTENSITE-CREDITS-EXECUTION.md` §4).
 * - `bruitagesDeLaCommande` : appelé par `services/fabrication.ts#construireCommande` (inchangé pour ce lot) ;
 * - la BANQUE soignée (`donnees/bruitages.ts`), écoutée et validée par Will (Bibliothèque › Bruitages) ;
 * - « retirer / ajouter le son » d'un plan, à l'Aperçu (plans du brouillon) ou après fabrication (plans de la
 *   version choisie, puis « Appliquer » : seul le mixage est refait, gratuit — `services/recalque.ts`).
 *
 * Règle absolue (consigne §2) : un son n'est JAMAIS posé tant que Will ne l'a pas écouté et validé
 * (`ValeurElement.bruitage.ecoute === "validee"`), et seulement ceux qui ont un déclencheur À L'IMAGE.
 */
import "server-only";
import type { BruitageDisponible, ChoixBruitagePlan, DeclencheurBruitage, ElementBibliotheque, Id, Licence, MediaCommande, ReglageBruitages } from "@/domaine/types";
import { LIBELLES_DECLENCHEURS } from "@/donnees/bruitages";
import { depots, ErreurStudio, journaliser, maintenant } from "./_commun";
import { exigerSession } from "./auth";
import { urlsFichiers } from "./fichiers";
import { etape16Bruitages } from "./migrations/etape-16-bruitages";

export async function bruitagesDeLaCommande(reglage: ReglageBruitages, formatId: string): Promise<BruitageDisponible[]> {
  // Les sons de la banque valent pour tous les formats ; un son réservé à certains formats (`formatsParDefaut`) ne sert qu'à eux.
  if (reglage === "aucun") return [];
  const elements = await depots().elements.lister((e) => e.type === "bruitage" && !e.archiveLe && (!e.formatsParDefaut.length || e.formatsParDefaut.includes(formatId)));
  return elements.flatMap((e) => {
    const v = e.valeur;
    if (v.type !== "bruitage" || v.ecoute !== "validee" || !v.declencheur) return [];
    return [{ elementId: e.id, declencheur: v.declencheur, variante: v.variante ?? 1, dureeSec: v.dureeSec, ...(v.sonieLufs !== undefined ? { sonieLufs: v.sonieLufs } : {}) }];
  });
}

/** Fichiers des sons disponibles (pour une commande refaite au remixage). */
export async function mediasDesBruitages(disponibles: BruitageDisponible[]): Promise<Record<Id, MediaCommande>> {
  const d = depots();
  const medias: Record<Id, MediaCommande> = {};
  for (const b of disponibles) {
    const e = await d.elements.obtenir(b.elementId);
    const f = e?.fichierId ? await d.fichiers.obtenir(e.fichierId) : null;
    if (f && f.statut === "pret") medias[b.elementId] = { cle: f.cleStockage, mime: f.mime, dureeSec: f.dureeSec };
  }
  return medias;
}

/* ------------------------------ Banque : écoute et validation par Will ------------------------------ */

export interface VueBruitage {
  id: Id;
  nom: string;
  declencheur: DeclencheurBruitage;
  quand: string;
  variante: number;
  dureeMs: number;
  url: string | null;
  ecoute: "a_verifier" | "validee";
  licence: Pick<Licence, "type" | "usageCommercial" | "source">;
}

/** La banque, rangée par déclencheur (elle est ajoutée si elle manque : même étape que la migration, idempotente). */
export async function banqueBruitages(): Promise<{ groupes: { declencheur: DeclencheurBruitage; nom: string; quand: string; sons: VueBruitage[] }[]; valides: number; total: number }> {
  await exigerSession();
  const d = depots();
  await etape16Bruitages(d, maintenant());
  const elements = (await d.elements.lister((e) => e.type === "bruitage" && !e.archiveLe)).filter((e): e is ElementBibliotheque & { valeur: { type: "bruitage" } } => e.valeur.type === "bruitage" && !!e.valeur.declencheur);
  const urls = await urlsFichiers(elements.map((e) => e.fichierId));
  const vues: VueBruitage[] = elements.map((e) => {
    const v = e.valeur as Extract<ElementBibliotheque["valeur"], { type: "bruitage" }>;
    const declencheur = v.declencheur!;
    return {
      id: e.id,
      nom: e.nom,
      declencheur,
      quand: LIBELLES_DECLENCHEURS[declencheur].quand,
      variante: v.variante ?? 1,
      dureeMs: Math.round(v.dureeSec * 1000),
      url: e.fichierId ? (urls[e.fichierId] ?? null) : null,
      ecoute: v.ecoute === "validee" ? "validee" : "a_verifier",
      licence: { type: e.licence.type, usageCommercial: e.licence.usageCommercial, source: e.licence.source },
    };
  });
  const ordre = Object.keys(LIBELLES_DECLENCHEURS) as DeclencheurBruitage[];
  const groupes = ordre
    .map((declencheur) => ({ declencheur, nom: LIBELLES_DECLENCHEURS[declencheur].nom, quand: LIBELLES_DECLENCHEURS[declencheur].quand, sons: vues.filter((x) => x.declencheur === declencheur).sort((a, b) => a.variante - b.variante) }))
    .filter((g) => g.sons.length);
  return { groupes, valides: vues.filter((x) => x.ecoute === "validee").length, total: vues.length };
}

/** Will a écouté : « Valider » (le son peut être posé) ou « Retirer » (il redevient « à vérifier », jamais effacé). */
export async function changerEcouteBruitage(elementId: Id, ecoute: "validee" | "a_verifier"): Promise<void> {
  await exigerSession();
  const d = depots();
  const e = await d.elements.obtenir(elementId);
  if (!e || e.valeur.type !== "bruitage") throw new ErreurStudio("INTROUVABLE", "Ce son n'existe plus.");
  if (!e.licence.usageCommercial) throw new ErreurStudio("LICENCE", "Ce son n'est pas utilisable pour une vidéo publiée.");
  await d.elements.modifier(elementId, { valeur: { ...e.valeur, ecoute }, modifieLe: maintenant() } as Partial<ElementBibliotheque>);
  await journaliser("bibliotheque", ecoute === "validee" ? `Bruitage validé à l'écoute : ${e.nom}` : `Bruitage remis à vérifier : ${e.nom}`, { type: "element", id: elementId });
}

/* ------------------------------ Son d'un plan : retirer / ajouter ------------------------------ */

/**
 * « Retirer le son » / « Ajouter un son » / « Automatique » (null) sur UN plan (du brouillon à l'Aperçu, ou de la
 * version après fabrication). Aucun coût : seul le mixage changera.
 */
export async function choisirSonDuPlan(planId: Id, choix: ChoixBruitagePlan | null): Promise<void> {
  await exigerSession();
  const d = depots();
  const plan = await d.plans.obtenir(planId);
  if (!plan) throw new ErreurStudio("INTROUVABLE", "Ce plan n'existe plus.");
  if (choix?.mode === "ajoute" && !LIBELLES_DECLENCHEURS[choix.declencheur]) throw new ErreurStudio("SON_INCONNU", "Ce son n'existe pas.");
  const { bruitage: _ancien, ...reste } = plan;
  void _ancien;
  await d.plans.enregistrer(choix ? { ...reste, bruitage: choix, modifieLe: maintenant() } : { ...reste, modifieLe: maintenant() });
}

/** Un plan (pour retrouver sa vidéo après un choix de son). */
export async function planDuStudio(planId: Id) {
  await exigerSession();
  return depots().plans.obtenir(planId);
}

export interface SonsDeLaVersion {
  versionId: Id;
  rapport: import("@/domaine/types").RapportIntensite | null;
  plans: { id: Id; ordre: number; debutSec: number; finSec: number; texte: string; choix: ChoixBruitagePlan | null; pose?: DeclencheurBruitage }[];
  enAttente: boolean;
  bruitages: ReglageBruitages;
}

/** Fiche vidéo (après fabrication) : la courbe de la version, le son posé et le choix de chaque plan. */
export async function sonsDeLaVersion(videoId: Id): Promise<SonsDeLaVersion | null> {
  await exigerSession();
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  const version = video?.versionChoisieId ? await d.versions.obtenir(video.versionChoisieId) : null;
  if (!version || !version.commande?.intensite) return null;
  const poses = ((version.projetMontage as { bruitages?: { planId?: string; declencheur: DeclencheurBruitage }[] } | undefined)?.bruitages ?? []).filter((b) => b.planId);
  const plans = (await d.plans.lister((p) => p.versionId === version.id)).sort((a, b) => a.ordre - b.ordre);
  const { sonsEnAttente } = await import("./recalque");
  return {
    versionId: version.id,
    rapport: version.rapportIntensite ?? null,
    plans: plans.map((p) => ({ id: p.id, ordre: p.ordre, debutSec: p.debutSec, finSec: p.finSec, texte: p.texte, choix: p.bruitage ?? null, ...(poses.find((b) => b.planId === `plan-${p.ordre}`) ? { pose: poses.find((b) => b.planId === `plan-${p.ordre}`)!.declencheur } : {}) })),
    enAttente: await sonsEnAttente(version.id),
    bruitages: version.commande.intensite.bruitages,
  };
}

/** La vidéo (statut), pour savoir si le son des plans peut changer. */
export async function obtenirVideoBrute(videoId: Id) {
  await exigerSession();
  return depots().videos.obtenir(videoId);
}
