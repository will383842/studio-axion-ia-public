/**
 * Tableau — la boucle « regard → UNE page refaite → second regard » (S-12, variante A, plafond accepté 0,65 €). Module PUR,
 * sans importeur : rien ne le branche. Les trois actions sont INJECTÉES (regarder, décider la suite, refaire). Au plus 2 appels à
 * `regarder` et 1 à `refaire`, quel que soit le verdict ; mêmes mots ; ne lève jamais. Le compteur est ici, car un plafond propre
 * ne bloque pas en budget « indicatif ».
 */
import type { VerdictRegard } from "@/briques/regardeur";
import type { FicheTableau } from "./fiche";

/** Forme de ce que rend `suite` (même forme que `suiteDuRegard`, redéclarée : ce module n'importe pas la reprise). */
export type SuiteInjectee = { suite: "rien" } | { suite: "rendre"; raisons: string[] } | { suite: "refaire"; fiche: FicheTableau; pages: number[]; remarques: string[] };

export interface PortsBoucleRegard {
  /** Rang 1 : regard de la vidéo d'origine ; rang 2 : second regard après la page refaite. */
  regarder: (fiche: FicheTableau, rang: 1 | 2) => Promise<VerdictRegard>;
  suite: (fiche: FicheTableau, verdict: VerdictRegard, options: { tour: number }) => SuiteInjectee;
  refaire: (fiche: FicheTableau, pages: number[]) => Promise<FicheTableau>;
}

export type ArretBoucle = "rien" | "rendre" | "regard-en-panne" | "refaire-en-panne" | "mots-changes" | "second-regard-en-panne";

export interface IssueBoucle {
  /** La fiche à garder : celle d'avant, ou celle refaite si elle est saine. */
  fiche: FicheTableau;
  regards: 0 | 1 | 2;
  refaites: 0 | 1;
  arret: ArretBoucle;
  raisons: string[];
}

const dit = (f: FicheTableau) => f.scenes.map((s) => s.texteDit).join(" ");
const ARRET_DUR = new Set(["phrase-non-choisie", "fin-absente"]);

/** Ne lève jamais. */
export async function boucleDuRegard(fiche: FicheTableau, ports: PortsBoucleRegard): Promise<IssueBoucle> {
  let v1: VerdictRegard;
  try {
    v1 = await ports.regarder(fiche, 1);
  } catch {
    return { fiche, regards: 0, refaites: 0, arret: "regard-en-panne", raisons: ["Le regard sur la vidéo n'a pas pu se faire : la vidéo est gardée telle quelle."] };
  }
  try {
    if (v1.defauts.some((d) => ARRET_DUR.has(d.code))) {
      const s = ports.suite(fiche, v1, { tour: 0 });
      return { fiche, regards: 1, refaites: 0, arret: "rendre", raisons: s.suite === "rendre" ? s.raisons : [] };
    }
    const s = ports.suite(fiche, v1, { tour: 0 });
    if (s.suite === "rien") return { fiche, regards: 1, refaites: 0, arret: "rien", raisons: [] };
    if (s.suite === "rendre") return { fiche, regards: 1, refaites: 0, arret: "rendre", raisons: s.raisons };

    let nouvelle: FicheTableau;
    try {
      nouvelle = await ports.refaire(fiche, s.pages);
    } catch {
      return { fiche, regards: 1, refaites: 0, arret: "refaire-en-panne", raisons: ["La page n'a pas pu être refaite : la vidéo d'avant est gardée.", ...s.remarques] };
    }
    if (dit(nouvelle) !== dit(fiche)) return { fiche, regards: 1, refaites: 0, arret: "mots-changes", raisons: ["Réparation refusée : les mots auraient changé.", ...s.remarques] };

    try {
      const v2 = await ports.regarder(nouvelle, 2);
      const fin = ports.suite(nouvelle, v2, { tour: 1 });
      return { fiche: nouvelle, regards: 2, refaites: 1, arret: fin.suite === "rien" ? "rien" : "rendre", raisons: fin.suite === "rendre" ? fin.raisons : s.remarques };
    } catch {
      return { fiche: nouvelle, regards: 1, refaites: 1, arret: "second-regard-en-panne", raisons: ["Le second regard n'a pas pu se faire.", ...s.remarques] };
    }
  } catch {
    return { fiche, regards: 1, refaites: 0, arret: "rendre", raisons: ["Suite impossible : la vidéo est gardée telle quelle."] };
  }
}
