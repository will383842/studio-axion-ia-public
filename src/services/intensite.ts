/**
 * COURBE D'INTENSITÉ DE L'APERÇU (lot du 02/10, D1). Avant toute fabrication, la petite courbe sous la bande de plans
 * montre comment le chef d'orchestre (brique commune `intensite`) répartit les effets sur la vidéo : les plans du
 * brouillon, les sous-titres estimés au débit du format, le réglage global et les sons validés. Rien n'est payé.
 * Après fabrication, la courbe vient de la version (`VersionVideo.rapportIntensite`), mesurée sur la vraie voix.
 */
import "server-only";
import { fabriquerSousTitres } from "@/briques/sous-titres";
import { orchestrerMontage } from "@/briques/intensite";
import { horodaterTexte } from "@/domaine/derivations";
import type { ChoixBruitagePlan, DeclencheurBruitage, Id, RapportIntensite } from "@/domaine/types";
import { trouverFormat } from "@/formats";
import type { PlanProduit } from "@/moteurs/types";
import { depots } from "./_commun";
import { exigerSession } from "./auth";
import { construireCommande } from "./fabrication";

export interface IntensiteApercu {
  rapport: RapportIntensite;
  /** Son posé (ou choisi) par plan du brouillon. */
  sonsParPlan: Record<Id, DeclencheurBruitage>;
  /** Choix de Will sur chaque plan. */
  choixParPlan: Record<Id, ChoixBruitagePlan>;
  /** Nombre de sons écoutés et validés (0 : aucun son ne sera posé). */
  sonsValides: number;
  bruitages: "discrets" | "aucun";
}

export async function intensiteDeLApercu(videoId: Id): Promise<IntensiteApercu | null> {
  await exigerSession();
  const c = await construireCommande(videoId);
  if (!c.intensite || !c.plans.length) return null;
  const format = trouverFormat(c.formatId);
  const texte = c.script.blocs.flatMap((b) => b.segments.map((s) => s.texte)).join(" ");
  const mots = horodaterTexte(texte, format?.recetteScript.motsParSeconde ?? 4.4);
  const plans = [...c.plans].sort((a, b) => a.ordre - b.ordre);
  const dureeSec = Math.max(plans.at(-1)?.finSec ?? 0, mots.at(-1)?.finSec ?? 0, 1);
  const produits: PlanProduit[] = plans.map((p) => ({ ...p, segmentId: p.segmentId ?? "", transition: "coupe", cadrage: p.cadrage ?? { pointInteret: { x: 0.5, y: 0.4 }, zoom: 1 } }) as PlanProduit);
  const segments = c.briques["sous-titres"] === false ? [] : fabriquerSousTitres({ texte, dureeSec, mots, emphase: c.script.blocs.flatMap((b) => b.segments.flatMap((s) => s.emphase ?? [])), intensite: c.intensite.niveau, coupesSec: plans.slice(1).map((p) => p.debutSec) });
  const o = orchestrerMontage({ niveau: c.intensite.niveau, dureeSec, plans: produits, segments, angleSecond: format?.recetteMontage?.angles.second, bruitages: { reglage: c.intensite.bruitages, disponibles: c.bruitagesDisponibles ?? [], graine: 1 } });
  const parOrdre = new Map(plans.map((p) => [`plan-${p.ordre}`, p.id]));
  const sonsParPlan: Record<Id, DeclencheurBruitage> = {};
  for (const b of o.bruitages) {
    const id = b.planId ? parOrdre.get(b.planId) : undefined;
    if (id) sonsParPlan[id] = b.declencheur;
  }
  const brouillon = await depots().plans.lister((p) => plans.some((x) => x.id === p.id));
  const choixParPlan: Record<Id, ChoixBruitagePlan> = {};
  for (const p of brouillon) if (p.bruitage) choixParPlan[p.id] = p.bruitage;
  return { rapport: o.rapport, sonsParPlan, choixParPlan, sonsValides: (c.bruitagesDisponibles ?? []).length, bruitages: c.intensite.bruitages };
}
