/**
 * Planning d'un lot d'épingles (PUR, horloge passée en paramètre) : heures lues dans la cadence, jours exclus, créneaux occupés
 * sautés (même compte, tous tableaux), jamais à moins de 3 h de « maintenant », tourniquet des tableaux, espacement vérifié.
 */
import { REGLES_PAR_DEFAUT, verifierEspacement, type PostPlanifie } from "../cadence/verifier";
import { ajouterJoursParis, resoudreHeureParis } from "../../lib/horloge-paris";

export const MARGE_CREATION_EPINGLE_MS = 3 * 3_600_000;
const JOURS_MAX = 400;

export interface EpinglePlanifiable {
  cle: string;
  tableau: string;
}
export interface CreneauOccupe {
  jour: string;
  heure: string;
}
export interface EntreePlanification {
  epingles: readonly EpinglePlanifiable[];
  /** AAAA-MM-JJ (Paris), premier jour possible. */
  jourDepart: string;
  /** HH:MM (Paris), lues dans la cadence Pinterest et modifiables pour ce lot. */
  heures: readonly string[];
  /** Jours AAAA-MM-JJ où rien n'est posé. */
  joursExclus?: readonly string[];
  alternerTableaux?: boolean;
  /** Créneaux déjà pris par ce compte. */
  occupes?: readonly CreneauOccupe[];
  /** Instant courant, en millisecondes. */
  maintenant: number;
  /** Écart conseillé entre deux épingles, en minutes (cadence). */
  ecartMinMinutes?: number;
}
export interface Placement {
  cle: string;
  tableau: string;
  jour: string;
  heure: string;
  instant: string;
}
export interface ResultatPlanification {
  planning: Placement[];
  avertissements: string[];
}

/** Tourniquet : une épingle de chaque tableau à tour de rôle, l'ordre du fichier gardé dans chaque tableau. */
export function alterner<T extends { tableau: string }>(liste: readonly T[]): T[] {
  const files = new Map<string, T[]>();
  for (const e of liste) files.set(e.tableau, [...(files.get(e.tableau) ?? []), e]);
  const sortie: T[] = [];
  while (sortie.length < liste.length) for (const f of files.values()) if (f.length) sortie.push(f.shift()!);
  return sortie;
}

export function planifierEpingles(e: EntreePlanification): ResultatPlanification {
  const avertissements: string[] = [];
  const heures = [...new Set(e.heures)].sort();
  if (!heures.length) return { planning: [], avertissements: ["Aucune heure de publication : rien n'est planifié."] };
  const exclus = new Set(e.joursExclus ?? []);
  const occupes = new Set((e.occupes ?? []).map((o) => `${o.jour} ${o.heure}`));
  const ordre = e.alternerTableaux ? alterner(e.epingles) : [...e.epingles];
  const planning: Placement[] = [];
  let jour = e.jourDepart;
  for (let n = 0; n < JOURS_MAX && planning.length < ordre.length; n++, jour = ajouterJoursParis(jour, 1)) {
    if (exclus.has(jour)) continue;
    for (const heure of heures) {
      if (planning.length >= ordre.length) break;
      if (occupes.has(`${jour} ${heure}`)) continue;
      const r = resoudreHeureParis(jour, heure);
      if (Date.parse(r.instant) < e.maintenant + MARGE_CREATION_EPINGLE_MS) continue;
      if (r.avertissement) avertissements.push(r.avertissement);
      const p = ordre[planning.length];
      planning.push({ cle: p.cle, tableau: p.tableau, jour, heure, instant: r.instant });
    }
  }
  if (planning.length < ordre.length) avertissements.push(`${ordre.length - planning.length} épingle(s) sans créneau : le calendrier est trop chargé sur la période.`);
  const posts: PostPlanifie[] = planning.map((p) => ({ id: p.cle, reseau: "pinterest", jour: p.jour, heure: p.heure, pilier: "epingle", cible: p.tableau }));
  const regles = { ...REGLES_PAR_DEFAUT, ecartMinH: (e.ecartMinMinutes ?? 210) / 60, quotaParJour: Math.max(heures.length, 1), repetitionJours: 0 };
  for (const c of verifierEspacement(posts, regles)) if (c.code === "ecart") avertissements.push(c.message);
  return { planning, avertissements };
}
