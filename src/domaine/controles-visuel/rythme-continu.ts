/** Structure d'une toile continue (lot P4) : règles de variété et gabarits permis, PAR CODE. PUR. */
import { GABARITS, type DefinitionGabarit } from "../../briques/visuels/continu/registre-gabarits";
import type { ControlePorte } from "../visuels/contrats";

/** Pages de cas au plus dans une toile. */
export const CAS_MAX = 2;
/** À partir de ce nombre de pages, la toile compte au moins `FAMILLES_MIN` familles. */
export const PAGES_VARIETE = 5;
export const FAMILLES_MIN = 3;

/**
 * Contrôles de structure d'une toile dont les pages sont lues par leur `type` (les types inconnus du registre sont
 * laissés au schéma). Rouge : deux familles identiques à la suite hors parcours, gabarit éteint ou qui exige un fait
 * ou un accord, plus de 2 pages de cas, plus d'une page orange fort, plus d'une page sombre. Orange : moins de 3
 * familles pour 5 pages ou plus.
 */
export function controlesStructureToile(toile: { pages: readonly { type: string }[] }, gabarits: readonly DefinitionGabarit[] = GABARITS): ControlePorte[] {
  const parType = new Map(gabarits.map((g) => [g.type, g]));
  const pages = toile.pages.map((p) => parType.get(p.type));
  const res: ControlePorte[] = [];
  const rouge = (code: string, page: number, phrase: string) => res.push({ code, niveau: "rouge", page, phrase: `Page ${page} : ${phrase}` });

  pages.forEach((g, i) => {
    if (!g) return;
    const page = i + 1;
    const avant = pages[i - 1];
    if (avant && avant.famille === g.famille && g.famille !== "parcours") rouge("FAMILLE_SUITE", page, `deux pages de la famille « ${g.famille} » se suivent ; intercalez une autre famille.`);
    if (g.exigeFait) rouge("GABARIT_FAIT", page, `la plaquette ${g.type} exige un fait validé ; elle n'est pas permise.`);
    else if (g.exigeAccord) rouge("GABARIT_ACCORD", page, `la plaquette ${g.type} exige un accord écrit ; elle n'est pas permise.`);
    else if (!g.actif) rouge("GABARIT_ETEINT", page, `la plaquette ${g.type} est éteinte ; choisissez une plaquette active.`);
  });

  const auDela = (code: string, garde: (g: DefinitionGabarit) => boolean, max: number, phrase: string) => {
    let vus = 0;
    pages.forEach((g, i) => {
      if (g && garde(g) && ++vus > max) rouge(code, i + 1, phrase);
    });
  };
  auDela("CAS_MAX", (g) => g.famille === "cas", CAS_MAX, `une toile compte au plus ${CAS_MAX} pages de cas.`);
  auDela("ORANGE_FORT_MAX", (g) => g.orangeFort, 1, "une toile n'a qu'une seule page à fond orange.");
  auDela("SOMBRE_MAX", (g) => g.sombre, 1, "une toile n'a qu'une seule page sombre.");

  const familles = new Set(pages.filter((g) => g !== undefined).map((g) => g.famille));
  if (toile.pages.length >= PAGES_VARIETE && familles.size < FAMILLES_MIN) {
    res.push({ code: "VARIETE", niveau: "orange", phrase: `La toile n'emploie que ${familles.size} famille${familles.size > 1 ? "s" : ""} de plaquettes pour ${toile.pages.length} pages ; il en faut au moins ${FAMILLES_MIN}.` });
  }
  return res;
}
