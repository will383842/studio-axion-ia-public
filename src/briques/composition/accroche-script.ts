/**
 * ACCROCHE TIRÉE DU SCRIPT (C10-01) : choisit UN fait dit dans les 2 premières secondes
 * (nombre hors argent, passage, question), sinon « rien ».
 * Pur : aucun service, aucun réglage, aucune dépendance au rendu. Lue par `plan-scenes/generateur.ts` (C10-15-b1).
 * Honnêteté : le texte rendu est celui des mots dits, jamais reformulé ni inventé.
 * Argent exclu (D4-17) : aucun montant ni prix à l'écran.
 */
import { faitsDuScript } from "../faits-script/extraire";
import { familleUnite, type Fait, type MotFait } from "../faits-script/types";

/** ALLUMER-ACCROCHE-SCRIPT-v21r (décisions du 21/11 07:20 et 17:40 : fini, vérifié, dans les plafonds) : allumée par défaut ; un appelant l'éteint en passant `accroche: false`. */
export const ACCROCHE_SCRIPT_ACTIVE = true;
/** Fenêtre d'accroche : le premier mot du fait doit commencer avant 2 s. */
export const FENETRE_ACCROCHE_MS = 2000;

export type AccrocheScript =
  | { type: "rien" }
  | { type: "nombre" | "passage" | "question"; fait: Fait; texte: string; debutMs: number; finMs: number };

const RANG = { passage: 0, nombre: 1, question: 2 } as const;
const MOTS_ARGENT = /€|euro|prix|tarif/;

const normaliser = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const estArgent = (unite: string | undefined) => unite !== undefined && familleUnite(unite) === "argent";

function argent(fait: Fait): boolean {
  if (fait.type === "nombre" && estArgent(fait.unite)) return true;
  if (fait.type === "passage" && (estArgent(fait.avant.unite) || estArgent(fait.apres.unite))) return true;
  return MOTS_ARGENT.test(normaliser(fait.texte));
}

export function accrocheDuScript(mots: readonly MotFait[], faits?: readonly Fait[]): AccrocheScript {
  try {
    if (mots.length === 0) return { type: "rien" };
    const liste = faits ?? faitsDuScript(mots);
    let meilleur: { fait: Fait; type: keyof typeof RANG; debut: number; fin: number } | null = null;
    for (const fait of liste) {
      if (fait.type !== "nombre" && fait.type !== "passage" && fait.type !== "question") continue;
      const premier = mots[fait.mots.premier];
      const dernier = mots[fait.mots.dernier];
      if (!premier || !dernier) continue;
      if (!(premier.debutMs < FENETRE_ACCROCHE_MS)) continue;
      if (argent(fait)) continue;
      const m = meilleur;
      if (!m || premier.debutMs < m.debut || (premier.debutMs === m.debut && RANG[fait.type] < RANG[m.type])) {
        meilleur = { fait, type: fait.type, debut: premier.debutMs, fin: dernier.finMs };
      }
    }
    if (!meilleur) return { type: "rien" };
    return { type: meilleur.type, fait: meilleur.fait, texte: meilleur.fait.texte, debutMs: meilleur.debut, finMs: meilleur.fin };
  } catch {
    return { type: "rien" };
  }
}
