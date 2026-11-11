// Choix d'une formulation parmi plusieurs (messages privés). PUR : `node:crypto` seulement, aucun hasard, aucune horloge.
// Même entrée = même sortie : c'est ce qui garantit qu'un renvoi garde le même texte et que les personnes se répartissent.
import { createHash } from "node:crypto";
import { GROUPES_MP, TEXTES_MP, type GroupeMp, type IdTexteMp } from "./textes-mp";

/** Rang (0 … n-1) de départ pour une conversation. `cleConversation` = clé opaque propre à la conversation, jamais un identifiant brut. */
export function rangFormulation(groupe: GroupeMp, cleConversation: string, n: number): number {
  if (n <= 0) return 0;
  const h = createHash("sha256").update(`formulation/v1\n${groupe}\n${cleConversation}`, "utf8").digest("hex");
  return parseInt(h.slice(0, 8), 16) % n;
}

export interface ChoixFormulation {
  version: IdTexteMp;
  texte: string;
  /** Vrai si la version figée de la conversation n'a pas pu être gardée (plus validée, retirée ou non rendue) : une autre a été prise. */
  figeeAbandonnee: boolean;
}

/**
 * 1. la version figée dans l'état, si elle est du groupe, active, validée et rendue ;
 * 2. sinon, en partant du rang de la conversation, la première active + validée + rendue (non nulle) + conforme ;
 * 3. sinon `null` (rien ne part).
 * `conforme` (facultatif) vérifie le texte rendu (longueur, forme du dictionnaire).
 */
export function choisirFormulation(o: {
  groupe: GroupeMp;
  cleConversation: string;
  figee?: string | null;
  validees: ReadonlySet<string>;
  rendre: (version: IdTexteMp) => string | null;
  conforme?: (texte: string) => boolean;
}): ChoixFormulation | null {
  const liste = GROUPES_MP[o.groupe];
  const essayer = (v: IdTexteMp): string | null => {
    if (TEXTES_MP[v]?.statut !== "actif" || !o.validees.has(v)) return null;
    const t = o.rendre(v);
    return t !== null && (!o.conforme || o.conforme(t)) ? t : null;
  };
  const figee = o.figee ? liste.find((v) => v === o.figee) : undefined;
  if (figee) {
    const t = essayer(figee);
    if (t !== null) return { version: figee, texte: t, figeeAbandonnee: false };
  }
  const depart = rangFormulation(o.groupe, o.cleConversation, liste.length);
  for (let i = 0; i < liste.length; i++) {
    const v = liste[(depart + i) % liste.length];
    const t = essayer(v);
    if (t !== null) return { version: v, texte: t, figeeAbandonnee: !!figee };
  }
  return null;
}
