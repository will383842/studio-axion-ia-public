import type { ReactElement } from "react";
import { pageDuSpec } from "./commun/page";
import type { PageSpec, ProprietesVisuelPage } from "./commun/types";
import { T01 } from "./pages/T01";
import { T01B } from "./pages/T01B";
import { T01C } from "./pages/T01C";
import { T02 } from "./pages/T02";
import { T06 } from "./pages/T06";
import { T08 } from "./pages/T08";
import { T10 } from "./pages/T10";
import { T20 } from "./pages/T20";
import { T21 } from "./pages/T21";

function dessiner(page: PageSpec, index: number, total: number): ReactElement {
  switch (page.type) {
    case "T01":
      return <T01 titre={page.titre} sousTitre={page.sousTitre} index={index} total={total} />;
    case "T01B":
      return <T01B titre={page.titre} sousTitre={page.sousTitre} deco={page.deco} index={index} total={total} />;
    case "T01C":
      return <T01C titre={page.titre} sousTitre={page.sousTitre} deco={page.deco} index={index} total={total} />;
    case "T02":
      return <T02 titre={page.titre} cartes={page.cartes} index={index} total={total} />;
    case "T06":
      return <T06 titre={page.titre} points={page.points} index={index} total={total} />;
    case "T08":
      return <T08 titre={page.titre} avant={page.avant} apres={page.apres} index={index} total={total} />;
    case "T10":
      return <T10 message={page.message} legende={page.legende} deco={page.deco} index={index} total={total} />;
    case "T20":
      return <T20 titre={page.titre} etapes={page.etapes} index={index} total={total} />;
    case "T21":
      return <T21 index={index} total={total} />;
  }
}

/**
 * Composition VisuelPage (1080 × 1350) : dessine UNE page (`index`) d'un CarrouselSpec déjà validé par le schéma Zod
 * (`src/visuels/proprietes-page.ts`). Tout texte vient du spec, sauf les textes génériques de `textes-fixes.ts` ;
 * la composition n'ajoute ni adresse, ni couleur libre.
 */
export function VisuelPage({ spec, index }: ProprietesVisuelPage) {
  return dessiner(pageDuSpec(spec, index), index, spec.pages.length);
}
