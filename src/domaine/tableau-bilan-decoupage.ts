/**
 * BILAN DURABLE D'UN DÉCOUPAGE DU TABLEAU (FIX-DECOUPAGE-COMPTEUR-c) — partie pure (aucun accès aux dépôts, aucun montant).
 * Chaque découpage laisse un événement du journal existant (type `tableau-bilan-decoupage`) qui porte le bilan pur de
 * `bilan-refus.ts` ; `chiffreRefusDecoupage` en tire LE chiffre : combien de découpages, combien acceptés du premier coup,
 * réparés sans IA, après relance, refusés, et, règle par règle, combien de refus ont été réparés, levés ou sont restés.
 */
import type { BilanDecoupage } from "@/moteurs/montage-tableau/bilan-refus";
import type { Evenement } from "./types";

export const TYPE_EVENEMENT_BILAN_DECOUPAGE = "tableau-bilan-decoupage";

/** Événement du journal d'activité qui porte un bilan de découpage. */
export interface EvenementBilanDecoupage extends Evenement {
  bilan: BilanDecoupage;
}

/** Identifiant stable par (vidéo, tâche, version du découpage) : rejouer n'écrit pas deux fois, un découpage neuf après « Réessayer » a le sien. */
export function idBilan(videoId: string, tacheId: string, versionId: string): string {
  return `ev-tbbilan-${videoId}-${tacheId}-${versionId}`;
}

export interface LigneRegleRefus {
  /** Clé de la règle (`bilan-refus.ts`). */
  cle: string;
  /** Refus vus (tous les essais). */
  refus: number;
  reparesSansIA: number;
  levesParRelance: number;
  restes: number;
}

export interface ChiffreRefusDecoupage {
  decoupages: number;
  premierCoup: number;
  parReparation: number;
  apresRelance: number;
  refuses: number;
  parRegle: LigneRegleRefus[];
}

/** Part entière en pourcent (0 si rien à compter). */
export function pourcentage(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

const nombre = (n: unknown): number => (typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0);
const table = (t: unknown): Record<string, number> => (t && typeof t === "object" ? (t as Record<string, number>) : {});

/** Le chiffre des refus sur une liste de bilans. PUR ; un bilan abîmé compte comme découpage sans refus. */
export function chiffreRefusDecoupage(bilans: readonly BilanDecoupage[]): ChiffreRefusDecoupage {
  const total: ChiffreRefusDecoupage = { decoupages: 0, premierCoup: 0, parReparation: 0, apresRelance: 0, refuses: 0, parRegle: [] };
  const regles = new Map<string, LigneRegleRefus>();
  const ligne = (cle: string): LigneRegleRefus => {
    let l = regles.get(cle);
    if (!l) regles.set(cle, (l = { cle, refus: 0, reparesSansIA: 0, levesParRelance: 0, restes: 0 }));
    return l;
  };
  for (const b of bilans) {
    total.decoupages++;
    const issue = String(b?.issue ?? "");
    if (issue === "accepte-1er-essai") total.premierCoup++;
    else if (issue === "accepte-par-reparation") total.parReparation++;
    else if (issue.startsWith("accepte-apres-relance")) total.apresRelance++;
    else total.refuses++;
    const essais = Array.isArray(b?.essais) ? b.essais : [];
    essais.forEach((e, i) => {
      for (const [c, n] of Object.entries(table(e?.refusAvant))) ligne(c).refus += nombre(n);
      for (const [c, n] of Object.entries(table(e?.reparesSansIA))) ligne(c).reparesSansIA += nombre(n);
      const suivant = essais[i + 1];
      if (suivant) {
        // Ce qui restait après cet essai et que l'essai suivant ne refuse plus : levé par la relance.
        for (const [c, n] of Object.entries(table(e?.restes))) ligne(c).levesParRelance += Math.max(0, nombre(n) - nombre(table(suivant.refusAvant)[c]));
      } else if (!issue.startsWith("accepte")) {
        for (const [c, n] of Object.entries(table(e?.restes))) ligne(c).restes += nombre(n);
      }
    });
  }
  total.parRegle = [...regles.values()].sort((a, b) => b.refus - a.refus || a.cle.localeCompare(b.cle));
  return total;
}
