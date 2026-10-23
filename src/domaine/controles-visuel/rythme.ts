/** Contrôles de structure d'un carrousel (pages, rythme, variété, titres, série, densité) : purs. */
import { CAPACITE_COMPARAISON, capaciteMotCarte } from "../../briques/visuels/registre-pages";
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

  pages.forEach((p, i) => {
    if (p.type !== "T02") return;
    const max = capaciteMotCarte(p.cartes.length);
    p.cartes.forEach((c, k) => {
      // Choix prudent : seuls l'espace ordinaire, les tirets ASCII/U+2010 et les blancs de contrôle coupent un mot ; les tirets demi-cadratin et cadratin et U+200B ne coupent pas (le mot reste long, donc refusé plus facilement).
      const long = c.titre.split(/[ \t\n\r\f\-\u2010]+/u).reduce((a, m) => (m.length > a.length ? m : a), "");
      if (long.length > max) {
        res.push({ code: "MOT_TROP_LONG", niveau: "rouge", page: i + 1, chemin: `pages.${i}.cartes.${k}.titre`, phrase: `Page ${i + 1} : le mot « ${long} » (${long.length} signes) est trop long pour un titre de carte (${max} signes au plus avec ${p.cartes.length} cartes) ; choisissez un mot plus court.` });
      }
    });
  });

  // T24 : une case est étroite ; un mot ne se coupe pas, il doit y tenir seul.
  pages.forEach((p, i) => {
    if (p.type !== "T24") return;
    p.lignes.forEach((l, k) => {
      for (const cote of ["sans", "avec"] as const) {
        const long = l[cote].split(/[ \t\n\r\f\-\u2010]+/u).reduce((a, m) => (m.length > a.length ? m : a), "");
        if (long.length > CAPACITE_COMPARAISON.mot) {
          res.push({ code: "MOT_TROP_LONG", niveau: "rouge", page: i + 1, chemin: `pages.${i}.lignes.${k}.${cote}`, phrase: `Page ${i + 1} : le mot « ${long} » (${long.length} signes) est trop long pour une case de comparaison (${CAPACITE_COMPARAISON.mot} signes au plus) ; choisissez un mot plus court.` });
        }
      }
    });
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

  // Un cas concret T26 porte toujours l'étiquette « Scénario type » (posée par le code) : il compte dans la série.
  const scenarios = pages.flatMap((p, i) => (p.type === "T26" || ("titre" in p && normaliser(p.titre).startsWith("scenario type")) ? [i + 1] : []));
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
