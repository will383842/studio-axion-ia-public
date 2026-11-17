/**
 * Cartes (E2, fiche X2-13a) : mémoire d'aujourd'hui enrichie des cartes déjà posées sur les vidéos voisines du réseau.
 * Fonction PURE, côté Studio seulement : aucun appelant (X2-13b l'appellera), aucune date du jour, aucun hasard, aucun réseau.
 * Éteint par construction : rien ne l'importe en production. Ne modifie jamais ses entrées.
 */
import type { EmpreinteVideo } from "@/briques/variete-commune/types";
import { TABLES_CORRESPONDANCE } from "@/briques/variete-commune/vocabulaire";

export interface MemoireCartes { dejaServis: string[]; ouverturePrecedente?: string }

const PLAFOND = 40;
const PREFIXE = "autre:cartes:";

/** Modèle local d'une valeur commune de cartes (`autre:cartes:<modele>` ou table inverse), sinon undefined. */
function modeleDe(axe: "ouverture" | "objets", valeur: string): string | undefined {
  if (valeur.startsWith(PREFIXE)) return valeur.slice(PREFIXE.length) || undefined;
  const table = TABLES_CORRESPONDANCE.cartes[axe];
  if (table) for (const [code, commun] of Object.entries(table)) if (commun === valeur) return code;
  return undefined;
}

export function memoireAvecVoisines(memoire: MemoireCartes, voisines: readonly EmpreinteVideo[], ouvertureDuJourLe?: string): MemoireCartes {
  const recentes = [...voisines].sort((a, b) => (b.le ?? "").localeCompare(a.le ?? ""));
  const dejaServis = [...memoire.dejaServis];
  const vus = new Set(dejaServis);
  let ouverture: { modele: string; le: string } | undefined;
  for (const v of recentes) {
    const modeles = (v.axes?.objets ?? []).map((x) => modeleDe("objets", x)).filter((m): m is string => !!m);
    const premiere = (v.axes?.ouverture ?? []).map((x) => modeleDe("ouverture", x)).find((m): m is string => !!m);
    if (!ouverture && premiere) ouverture = { modele: premiere, le: v.le };
    for (const m of modeles) if (!vus.has(m)) { vus.add(m); dejaServis.push(m); }
  }
  let ouverturePrecedente = memoire.ouverturePrecedente;
  if (ouverture && (ouverturePrecedente === undefined || (ouvertureDuJourLe !== undefined && ouverture.le > ouvertureDuJourLe))) {
    ouverturePrecedente = ouverture.modele;
  }
  return { dejaServis: dejaServis.slice(0, PLAFOND), ...(ouverturePrecedente !== undefined ? { ouverturePrecedente } : {}) };
}
