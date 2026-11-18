/**
 * COURTS TIRÉS D'UNE VIDÉO LONGUE (fiche VL-09, générateur « Vidéo longue », ÉTEINT). PUR et AUTONOME : aucun import du moteur,
 * aucun réseau, aucun appel à Claude, aucun rendu réel ; 0 €.
 *
 * Un chapitre déjà planifié (`plan.ts`) devient un court en 9:16, 4:5 ou 1:1 : les scènes du chapitre sont REFAITES au format
 * choisi à partir du plan existant (temps recalés sur 0, format changé) — le plan du chapitre est réutilisé tel quel, il n'y a
 * donc aucun nouveau coût de plan ni de voix. Seules les phrases d'ouverture et de fin sont ajoutables, et UNIQUEMENT si
 * l'utilisateur les a écrites ou choisies : jamais une phrase inventée ici.
 *
 *  - rien n'est choisi par défaut (chaque court est décoché) ;
 *  - un seul accord pour le lot : sans `accordLot`, rien n'est fabriqué ;
 *  - de 3 à 5 courts proposés ; 45 à 70 s par court conseillés, hors zone = une remarque, jamais un refus.
 */
import type { PlanValide } from "@/briques/plan-scenes/schema";
import type { PlanChapitre } from "./plan";

export type RatioCourt = "9:16" | "4:5" | "1:1";
export const RATIOS_COURT: readonly RatioCourt[] = ["9:16", "4:5", "1:1"];
export const DIMENSIONS_COURT: Record<RatioCourt, { largeur: number; hauteur: number; fps: 25 }> = {
  "9:16": { largeur: 1080, hauteur: 1920, fps: 25 },
  "4:5": { largeur: 1080, hauteur: 1350, fps: 25 },
  "1:1": { largeur: 1080, hauteur: 1080, fps: 25 },
};

export const COURTS_MIN = 3;
export const COURTS_MAX = 5;
export const DUREE_COURT_CONSEILLEE_SEC = { min: 45, max: 70 } as const;

export interface PhrasesChoisies {
  /** Phrase d'ouverture ÉCRITE OU CHOISIE par l'utilisateur (absente = pas de phrase). */
  ouverture?: string;
  /** Phrase de fin ÉCRITE OU CHOISIE par l'utilisateur (absente = pas de phrase). */
  fin?: string;
}

export interface CourtPropose {
  chapitreId: string;
  dureeSec: number;
  /** Faux par défaut : l'utilisateur coche lui-même. */
  choisi: false;
  /** Faux : le chapitre n'a aucune scène à reprendre. */
  possible: boolean;
  remarques: string[];
}

const arrondi = (n: number) => Math.round(n * 10) / 10;
const nette = (p: string | undefined): string | undefined => (typeof p === "string" && p.trim() ? p.trim() : undefined);

/** Courts proposés (PUR) : un par chapitre qui a un plan, tous décochés, 5 au plus ; remarques non bloquantes. */
export function proposerCourts(chapitres: PlanChapitre[]): { courts: CourtPropose[]; remarques: string[] } {
  const courts: CourtPropose[] = chapitres.map((c) => {
    const dureeSec = arrondi((c.finMs - c.debutMs) / 1000);
    const remarques: string[] = [];
    const possible = c.plan !== null && c.plan.scenes.length > 0;
    if (!possible) remarques.push("Ce chapitre n'a pas de scènes à reprendre : il ne peut pas devenir un court.");
    else if (dureeSec < DUREE_COURT_CONSEILLEE_SEC.min) remarques.push(`Ce chapitre dure ${dureeSec} s : il sera court (de ${DUREE_COURT_CONSEILLEE_SEC.min} à ${DUREE_COURT_CONSEILLEE_SEC.max} s conseillés).`);
    else if (dureeSec > DUREE_COURT_CONSEILLEE_SEC.max) remarques.push(`Ce chapitre dure ${dureeSec} s : il sera long pour un court (de ${DUREE_COURT_CONSEILLEE_SEC.min} à ${DUREE_COURT_CONSEILLEE_SEC.max} s conseillés).`);
    return { chapitreId: c.id, dureeSec, choisi: false as const, possible, remarques };
  });
  const remarques: string[] = [];
  const possibles = courts.filter((c) => c.possible).length;
  if (possibles < COURTS_MIN) remarques.push(`Seuls ${possibles} chapitre(s) peuvent devenir un court (de ${COURTS_MIN} à ${COURTS_MAX} sont conseillés).`);
  return { courts, remarques };
}

export interface CourtFabriquable {
  chapitreId: string;
  ratio: RatioCourt;
  plan: PlanValide;
  dureeSec: number;
  /** Phrases de l'utilisateur seulement ; `undefined` si non choisies. */
  ouverture?: string;
  fin?: string;
}

export interface DemandeCourts {
  chapitres: PlanChapitre[];
  /** Chapitres COCHÉS par l'utilisateur (ids). Vide = rien à faire. */
  choisis: string[];
  ratio: RatioCourt;
  /** Un seul accord pour tout le lot : sans lui, rien n'est fabriqué. */
  accordLot: boolean;
  /** Phrases choisies par l'utilisateur, par chapitre. */
  phrases?: Record<string, PhrasesChoisies>;
}

export interface ResultatCourts {
  courts: CourtFabriquable[];
  remarques: string[];
  /** Nombre de courts à fabriquer (quantité annoncée à l'accord ; aucun montant). */
  quantite: number;
}

/** Plan d'un chapitre refait au format du court : scènes recalées sur 0, format changé, contenu inchangé. PUR. */
export function planDuCourt(chapitre: PlanChapitre, ratio: RatioCourt): PlanValide | null {
  if (!chapitre.plan) return null;
  const decalage = chapitre.debutMs;
  const duree = chapitre.finMs - chapitre.debutMs;
  const plan = structuredClone(chapitre.plan);
  plan.format = { ...DIMENSIONS_COURT[ratio] };
  plan.dureeMs = duree;
  plan.scenes = plan.scenes.map((s) => ({ ...s, debutMs: Math.max(0, s.debutMs - decalage), finMs: Math.min(duree, s.finMs - decalage) })).filter((s) => s.finMs > s.debutMs);
  plan.mots = plan.mots.map((m) => ({ ...m, debutMs: Math.max(0, m.debutMs - decalage), finMs: Math.max(0, m.finMs - decalage) }));
  return plan.scenes.length ? plan : null;
}

/**
 * Courts à fabriquer (PUR). Sans accord du lot, ou sans chapitre coché : liste vide (jamais une exception, jamais un coût).
 * Les phrases d'ouverture et de fin ne viennent que de `phrases` (choix de l'utilisateur) ; une phrase vide est ignorée.
 */
export function preparerCourts(d: DemandeCourts): ResultatCourts {
  const remarques: string[] = [];
  if (!RATIOS_COURT.includes(d.ratio)) return { courts: [], remarques: ["Format de court inconnu : rien n'est fabriqué."], quantite: 0 };
  if (!d.choisis.length) return { courts: [], remarques: [], quantite: 0 };
  if (!d.accordLot) return { courts: [], remarques: ["Votre accord pour le lot de courts est nécessaire : rien n'est fabriqué."], quantite: 0 };
  const ids = [...new Set(d.choisis)];
  if (ids.length > COURTS_MAX) {
    remarques.push(`Au plus ${COURTS_MAX} courts à la fois : les ${ids.length - COURTS_MAX} derniers cochés sont laissés de côté.`);
    ids.length = COURTS_MAX;
  }
  const courts: CourtFabriquable[] = [];
  for (const id of ids) {
    const chapitre = d.chapitres.find((c) => c.id === id);
    const plan = chapitre ? planDuCourt(chapitre, d.ratio) : null;
    if (!chapitre || !plan) {
      remarques.push(`Le chapitre « ${id} » ne peut pas devenir un court : il est laissé de côté.`);
      continue;
    }
    const ouverture = nette(d.phrases?.[id]?.ouverture);
    const fin = nette(d.phrases?.[id]?.fin);
    courts.push({ chapitreId: id, ratio: d.ratio, plan, dureeSec: arrondi((chapitre.finMs - chapitre.debutMs) / 1000), ...(ouverture ? { ouverture } : {}), ...(fin ? { fin } : {}) });
  }
  return { courts, remarques, quantite: courts.length };
}
