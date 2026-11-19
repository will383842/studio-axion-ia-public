/**
 * BILAN DES REFUS D'UN DÉCOUPAGE (FIX-DECOUPAGE-RELANCES-b, CONCEPTION-DECOUPAGE-AUTOREPARE § 4). PUR : aucun import, aucune
 * lecture, aucune écriture. Donne le chiffre « combien de refus, de quelle règle, combien réparés sans IA, combien levés
 * par une relance » sans rien changer au résultat du découpage : `decouperEnScenes` l'offre à un rappel facultatif
 * (`noterBilan`).
 *
 * Clé d'un refus = la règle (`ProblemeFiche.regle`), plus, pour la règle 18 (gabarit de page) et la règle 4 (page lisible),
 * une sous-clé lue sur le message (`regle/sous-cle`). Refus propres au découpage (sans règle) : `champ-fixe`,
 * `dessin-non-fourni`, `preuve-non-fournie` ; lecture : `illisible` ; sinon `autre`.
 */

/** Issues d'un découpage. */
export type IssueDecoupage =
  | "accepte-1er-essai"
  | "accepte-par-reparation"
  | "accepte-apres-relance-1"
  | "accepte-apres-relance-2"
  | "accepte-apres-relance-3"
  | "refuse"
  | "refuse-sans-progres"
  | "tronque"
  | "illisible"
  | "budget"
  | "appel"
  | "simulation";

/** Un essai (un appel) : refus avant réparation sans IA, réparés sans IA, restés. Clé → nombre. */
export interface EssaiBilan {
  essai: number;
  refusAvant: Record<string, number>;
  reparesSansIA: Record<string, number>;
  restes: Record<string, number>;
}

export interface BilanDecoupage {
  videoId: string;
  versionId: string;
  issue: IssueDecoupage;
  /** Appels Claude RÉELLEMENT faits. */
  appels: number;
  essais: EssaiBilan[];
}

const REGLE_GABARIT = /^gabarit de page clair/i;
const REGLE_PAGE = /^page lisible/i;

/** Sous-clés du gabarit (règle 18), dans l'ordre d'essai : la première qui reconnaît le message gagne. */
const SOUS_CLES_GABARIT: readonly (readonly [string, RegExp])[] = [
  ["bloc-hors-partie", /n'a pas sa place sur une page|sur une scène « [^»]+ » : la douleur s'écrit/],
  ["liste-un-element", /une liste d'un seul élément/],
  ["code-orphelin", /« code » ne va que sur un élément/],
  ["blocs-max", /montre \d+ blocs/],
  ["chiffre", /que la voix ne dit pas/],
  ["texte-pas-dit", /ne reprend pas le texte dit/],
  ["phrases-cles", /phrases? clés?\b.*une seule|a \d+ phrases clés/],
  ["titres", /a \d+ titres|s'écrit(?:ent)? (?:dans la première scène|en premier)|vient en premier|le titre « .* » fait \d+ mots/],
  ["idee-recue", /idée reçue|est barrée|geste « barrer »/],
  ["bloc-orange", /blocs? orange/],
  ["visuel", /visuels?\b|page d'appel garde/],
  ["numero-etape", /numéro/],
  ["ordre-parties", /revient après une partie|une seule page d'accroche|la page 1 est l'ACCROCHE|dernière page/],
  ["appel", /page d'appel|un seul appel|« appel »/],
];

/** Clé d'un refus. Pure, ne lève jamais. */
export function cleRefus(p: { regle: string; message: string }): string {
  try {
    const regle = p.regle ?? "";
    const message = p.message ?? "";
    if (!regle) {
      if (/n'est pas un JSON lisible|La réponse est vide|La réponse n'est pas un objet|refusé de rendre/.test(message)) return "illisible";
      if (/dessin « [^»]*» n'est pas dans la liste/.test(message)) return "dessin-non-fourni";
      if (/preuve « [^»]*» n'est pas dans la liste/.test(message)) return "preuve-non-fournie";
      if (/Le champ « [^»]+ » vaut|La série doit être recopiée/.test(message)) return "champ-fixe";
      return "autre";
    }
    if (REGLE_GABARIT.test(regle)) return `${regle}/${SOUS_CLES_GABARIT.find(([, re]) => re.test(message))?.[0] ?? "autre"}`;
    if (REGLE_PAGE.test(regle)) return `${regle}/${/ne tient pas/.test(message) ? "page-ne-tient-pas" : "autre"}`;
    return regle;
  } catch {
    return "autre";
  }
}

/** Compte une liste de clés : clé → nombre d'occurrences. */
export function compterCles(cles: readonly string[]): Record<string, number> {
  const r: Record<string, number> = {};
  for (const c of cles) r[c] = (r[c] ?? 0) + 1;
  return r;
}

/** Ce qui a été réparé sans IA : les clés d'AVANT moins celles de RESTE (jamais négatif). */
export function reparesDe(avant: Record<string, number>, restes: Record<string, number>): Record<string, number> {
  const r: Record<string, number> = {};
  for (const [c, n] of Object.entries(avant)) {
    const d = n - (restes[c] ?? 0);
    if (d > 0) r[c] = d;
  }
  return r;
}
