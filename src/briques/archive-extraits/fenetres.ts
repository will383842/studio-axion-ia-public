/**
 * Archive des vidéos livrées : fenêtres interdites (plaquettes, carte de fin, accroche, images de tiers)
 * et fenêtres avec visage, par format. Fonctions PURES : aucun accès disque, aucun réglage, aucun appel externe.
 * Import de types seulement (effacés à la compilation).
 */
import type { PlanFacecamAnimee } from "../../domaine/facecam-animee/plan";
import type { Plan } from "../../domaine/types";
import { EPS } from "../../lib/tolerance";

export type Intervalle = { debutSec: number; finSec: number; raison: string };
export type Fenetres = { interdits: Intervalle[]; avecVisage: Intervalle[]; inconnues: boolean };
export type PlanFenetre = Pick<Plan, "debutSec" | "finSec" | "sourceImage" | "illustration">;

export const MARGE_FENETRE_SEC = 0.3;
const ACCROCHE_FIN_SEC = 5;
const arrondi = (n: number) => Math.round(n * 1000) / 1000;

export function fenetresInconnues(): Fenetres {
  return { interdits: [], avecVisage: [], inconnues: true };
}

/** Trie et fusionne les intervalles qui se touchent ou se chevauchent (raisons réunies, ordre alphabétique). */
function fusionner(liste: Intervalle[]): Intervalle[] {
  const tries = liste
    .filter((i) => Number.isFinite(i.debutSec) && Number.isFinite(i.finSec) && i.finSec > i.debutSec)
    .map((i) => ({ ...i }))
    .sort((a, b) => a.debutSec - b.debutSec || a.finSec - b.finSec);
  const sortie: Intervalle[] = [];
  for (const i of tries) {
    const dernier = sortie[sortie.length - 1];
    if (dernier && i.debutSec <= dernier.finSec + EPS) {
      dernier.finSec = Math.max(dernier.finSec, i.finSec);
      const raisons = new Set([...dernier.raison.split("+"), ...i.raison.split("+")]);
      dernier.raison = [...raisons].sort().join("+");
    } else sortie.push(i);
  }
  return sortie;
}

export function fenetresV4(plan: PlanFacecamAnimee | null): Fenetres {
  if (!plan || !(plan.duree > 0)) return fenetresInconnues();
  const duree = plan.duree;
  const brut: Intervalle[] = [{ debutSec: 0, finSec: Math.min(ACCROCHE_FIN_SEC, duree), raison: "accroche" }];
  for (const e of plan.elementsV4 ?? []) {
    brut.push({
      debutSec: arrondi(Math.max(0, e.debut - MARGE_FENETRE_SEC)),
      finSec: arrondi(Math.min(duree, e.fin + MARGE_FENETRE_SEC)),
      raison: "plaquette",
    });
  }
  if (plan.fin && Number.isFinite(plan.fin.debut)) brut.push({ debutSec: Math.max(0, plan.fin.debut), finSec: duree, raison: "carte-fin" });
  const interdits = fusionner(brut);
  const avecVisage: Intervalle[] = [];
  let curseur = 0;
  for (const i of interdits) {
    if (i.debutSec > curseur + EPS) avecVisage.push({ debutSec: curseur, finSec: i.debutSec, raison: "visage" });
    curseur = Math.max(curseur, i.finSec);
  }
  if (duree > curseur + EPS) avecVisage.push({ debutSec: curseur, finSec: duree, raison: "visage" });
  return { interdits, avecVisage, inconnues: false };
}

export function fenetresParPlans(plans: PlanFenetre[]): Fenetres {
  const interdits: Intervalle[] = [];
  const visage: Intervalle[] = [];
  for (const p of plans) {
    const src = p.illustration?.source;
    if (src === "banque" || src === "generee-ia") interdits.push({ debutSec: p.debutSec, finSec: p.finSec, raison: "tiers" });
    if (p.sourceImage === "double" || p.sourceImage === "rush") visage.push({ debutSec: p.debutSec, finSec: p.finSec, raison: "visage" });
  }
  return { interdits: fusionner(interdits), avecVisage: fusionner(visage), inconnues: false };
}

export const LECTEUR_FENETRES: Readonly<Record<string, (donnees: unknown) => Fenetres>> = Object.freeze({
  "facecam-animee": (d: unknown) => fenetresV4((d ?? null) as PlanFacecamAnimee | null),
  avocat: (d: unknown) => (Array.isArray(d) ? fenetresParPlans(d as PlanFenetre[]) : fenetresInconnues()),
  facecam: (d: unknown) => (Array.isArray(d) ? fenetresParPlans(d as PlanFenetre[]) : fenetresInconnues()),
});

/** Ne lève jamais : format inconnu, données absentes ou mal formées → fenêtres inconnues. */
export function fenetresDuFormat(formatId: string, donnees: unknown): Fenetres {
  try {
    const lecteur = Object.prototype.hasOwnProperty.call(LECTEUR_FENETRES, formatId) ? LECTEUR_FENETRES[formatId] : undefined;
    return lecteur ? lecteur(donnees) : fenetresInconnues();
  } catch {
    return fenetresInconnues();
  }
}
