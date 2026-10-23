/** Contrôles de structure d'un carrousel (pages, rythme, variété, titres, série, densité) : purs. */
import type { ControlePorte } from "../visuels/contrats";
import type { CarrouselSpecType } from "../visuels/types";
import { mots, normaliser } from "./texte";
import { textesDe } from "./textes-de";

export const PAGES_MIN = 6;
export const TYPES_MIN = 4;
export const SERIE_MAX = 3;
export const MOTS_ORANGE = 200;
export const MOTS_ROUGE = 260;

export function controlesStructure(spec: CarrouselSpecType): ControlePorte[] {
  const res: ControlePorte[] = [];
  const { pages } = spec;

  if (pages.length < PAGES_MIN) {
    res.push({ code: "PAGES", niveau: "orange", phrase: `Le carrousel n'a que ${pages.length} pages ; il en faut au moins ${PAGES_MIN} pour bien raconter le sujet.` });
  }
  if (!pages.some((p) => p.type === "T21")) {
    res.push({ code: "PAGES", niveau: "orange", phrase: "Il manque la dernière page (T21), qui invite à écrire en message privé." });
  }

  pages.forEach((p, i) => {
    if (i > 0 && pages[i - 1].type === p.type) {
      res.push({ code: "RYTHME", niveau: "rouge", page: i + 1, phrase: `Pages ${i} et ${i + 1} : deux pages de suite de même type (${p.type}) ; alternez les mises en page.` });
    }
  });

  const types = new Set(pages.map((p) => p.type));
  if (types.size < TYPES_MIN) {
    res.push({ code: "VARIETE", niveau: "orange", phrase: `Le carrousel n'utilise que ${types.size} types de pages différents ; il en faut au moins ${TYPES_MIN} pour qu'il reste vivant.` });
  }

  const titres = pages.flatMap((p, i) => ("titre" in p ? [{ page: i + 1, titre: p.titre }] : []));
  const vus = new Map<string, number>();
  for (const t of titres) {
    const cle = normaliser(t.titre);
    const avant = vus.get(cle);
    if (avant === undefined) vus.set(cle, t.page);
    else res.push({ code: "TITRE_DOUBLE", niveau: "rouge", page: t.page, phrase: `Page ${t.page} : le titre (« ${t.titre} ») est le même qu'à la page ${avant}.` });
  }

  const scenarios = titres.filter((t) => normaliser(t.titre).startsWith("scenario type"));
  if (scenarios.length > SERIE_MAX) {
    res.push({ code: "SERIE", niveau: "orange", phrase: `${scenarios.length} pages « Scénario type » : ${SERIE_MAX} au plus, sinon le carrousel se répète.` });
  }

  pages.forEach((_, i) => {
    const n = textesDe({ pages: [spec.pages[i]] }).reduce((somme, t) => somme + mots(t.texte).length, 0);
    if (n > MOTS_ORANGE) {
      const rouge = n > MOTS_ROUGE;
      res.push({
        code: "DENSITE",
        niveau: rouge ? "rouge" : "orange",
        page: i + 1,
        phrase: `Page ${i + 1} : ${n} mots, c'est ${rouge ? "beaucoup trop" : "trop"} dense (${rouge ? MOTS_ROUGE : MOTS_ORANGE} au plus) ; allégez le texte.`,
      });
    }
  });

  return res;
}
