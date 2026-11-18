/**
 * L8-03 : classement par créneau (jour × tranche de 2 h, heure de Paris). Fonctions PURES : aucune lecture de réglage,
 * aucun réseau, aucune écriture. Simple indication ; branché nulle part.
 * La position (0 à 1, 1 = le meilleur de sa fenêtre) est calculée par l'appelant.
 */
import { formateurDate } from "@/lib/intl";

export type TypeContenu = "video" | "carrousel";
export type Jour = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type Tranche = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export interface ContenuPlace {
  reseau: string;
  type: TypeContenu;
  date: string;
  /** Entre 0 et 1 (1 = le meilleur de sa fenêtre) ; null = donnée absente. */
  position: number | null;
}

/** Hypothèse en attente de validation du fondateur ; ce n'est PAS un réglage. */
export const SEUIL_CASE = { statut: "hypothese", valeur: 3 } as const;

export interface CaseCreneau {
  jour: Jour;
  tranche: Tranche;
  nombre: number;
  mediane: number | null;
  etat: "lu" | "trop-tot";
}

export interface GroupeCreneaux {
  reseau: string;
  type: TypeContenu;
  cases: CaseCreneau[];
  nonMesures: number;
}

const JOURS: Readonly<Record<string, Jour>> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
const NOMS_JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"] as const;

export function jourEtTrancheParis(dateIso: string): { jour: Jour; tranche: Tranche } {
  const t = new Date(dateIso).getTime();
  if (Number.isNaN(t)) throw new RangeError(`Date illisible : ${dateIso}`);
  const p = Object.fromEntries(
    formateurDate("en-US", { timeZone: "Europe/Paris", hourCycle: "h23", weekday: "short", hour: "2-digit" })
      .formatToParts(new Date(t))
      .map((x) => [x.type, x.value]),
  );
  const heure = Number(p.hour) % 24;
  return { jour: JOURS[p.weekday], tranche: Math.floor(heure / 2) as Tranche };
}

function mediane(valeurs: number[]): number {
  const v = [...valeurs].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export function classerCreneaux(contenus: readonly ContenuPlace[]): GroupeCreneaux[] {
  const groupes = new Map<string, { reseau: string; type: TypeContenu; nonMesures: number; cases: Map<string, { jour: Jour; tranche: Tranche; positions: number[] }> }>();
  for (const ct of contenus) {
    const cle = `${ct.reseau}|${ct.type}`;
    let g = groupes.get(cle);
    if (!g) {
      g = { reseau: ct.reseau, type: ct.type, nonMesures: 0, cases: new Map() };
      groupes.set(cle, g);
    }
    if (ct.position === null || !Number.isFinite(ct.position)) {
      g.nonMesures += 1;
      continue;
    }
    const { jour, tranche } = jourEtTrancheParis(ct.date);
    const ck = `${jour}-${tranche}`;
    const cs = g.cases.get(ck) ?? { jour, tranche, positions: [] };
    cs.positions.push(ct.position);
    g.cases.set(ck, cs);
  }
  return [...groupes.values()].map((g) => {
    const cases: CaseCreneau[] = [...g.cases.values()].map((cs) => {
      const lu = cs.positions.length >= SEUIL_CASE.valeur;
      return { jour: cs.jour, tranche: cs.tranche, nombre: cs.positions.length, mediane: lu ? mediane(cs.positions) : null, etat: lu ? "lu" : "trop-tot" };
    });
    cases.sort((a, b) => {
      if (a.etat !== b.etat) return a.etat === "lu" ? -1 : 1;
      if (a.etat === "lu" && b.mediane !== a.mediane) return (b.mediane ?? 0) - (a.mediane ?? 0);
      return a.jour - b.jour || a.tranche - b.tranche;
    });
    return { reseau: g.reseau, type: g.type, cases, nonMesures: g.nonMesures };
  });
}

export function libelleCase(jour: Jour, tranche: Tranche): string {
  const h = (n: number) => String(n).padStart(2, "0");
  return `${NOMS_JOURS[jour - 1]}, ${h(tranche * 2)} h – ${h(tranche * 2 + 2)} h (heure de Paris)`;
}
