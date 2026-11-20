/**
 * Tableau — de ce que Claude a vu à « la page à refaire » (S-12-TABLEAU-REPRISE-v19c). Calcul PUR, sans IA, sans rendu,
 * sans appelant : rien ne le branche. Donne une page de plus à la page fautive (mêmes mots, jamais un mot changé), ou
 * rend la vidéo avec la liste exacte. Un seul tour. Ne lève jamais.
 */
import type { VerdictRegard } from "@/briques/regardeur";
import type { FicheTableau } from "./fiche";
import { relectureDuVerdict } from "./regard-tableau";
import { textesEcransScene, textesEcrits } from "./regles";
import { texteDitDe } from "./variantes-fin";
// Après les modules ci-dessus : `densite` et `fiche` se tiennent en cycle, l'ordre d'entrée compte.
import { pageDePlus } from "./densite";

export type SuiteRegard =
  | { suite: "rien" }
  | { suite: "rendre"; raisons: string[] }
  | { suite: "refaire"; fiche: FicheTableau; pages: number[]; remarques: string[] };

const numeroDe = (partieId: string | null) => {
  const n = partieId ? /^page-(\d+)$/.exec(partieId)?.[1] : undefined;
  return n ? Number(n) : undefined;
};
const ecritsTries = (f: FicheTableau) => f.scenes.flatMap((s) => [...s.elements.flatMap(textesEcrits), ...textesEcransScene(s)]).sort();

export function suiteDuRegard(fiche: FicheTableau, verdict: VerdictRegard, options: { tour: number }): SuiteRegard {
  try {
    const defauts = verdict.defauts.filter((d) => d.code !== "non-relue");
    if (defauts.length === 0) return { suite: "rien" };
    const raisons = relectureDuVerdict(verdict).remarques.map((r) => r.raison);
    if (defauts.some((d) => d.code === "phrase-non-choisie" || d.code === "fin-absente")) return { suite: "rendre", raisons };
    if (options.tour >= 1) return { suite: "rendre", raisons };

    const demandees = [...new Set(defauts.filter((d) => d.code === "texte-coupe" || d.code === "hors-cadre").flatMap((d) => numeroDe(d.partieId) ?? []))].sort((a, b) => b - a);
    let courante = fiche;
    const pages: number[] = [];
    const remarques: string[] = [];
    for (const page of demandees) {
      const f = pageDePlus(courante, page);
      if (f) { courante = f; pages.push(page); } else remarques.push(`page ${page} : pas de page de plus possible`);
    }
    if (pages.length === 0) return { suite: "rendre", raisons: [...raisons, ...remarques] };

    if (texteDitDe(courante) !== texteDitDe(fiche) || JSON.stringify(ecritsTries(courante)) !== JSON.stringify(ecritsTries(fiche))) {
      return { suite: "rendre", raisons: ["réparation refusée : les mots auraient changé", ...raisons] };
    }
    const reparees = new Set(["texte-coupe", "hors-cadre"]);
    const restes = relectureDuVerdict({ ...verdict, defauts: defauts.filter((d) => !reparees.has(d.code) || numeroDe(d.partieId) === undefined || !pages.includes(numeroDe(d.partieId)!)) as VerdictRegard["defauts"], nonRelues: 0 }).remarques.map((r) => r.raison);
    return { suite: "refaire", fiche: courante, pages, remarques: [...restes, ...remarques.filter((r) => !restes.includes(r))] };
  } catch {
    return { suite: "rendre", raisons: ["reprise impossible"] };
  }
}
