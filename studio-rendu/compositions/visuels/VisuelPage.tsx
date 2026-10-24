import type { ReactElement } from "react";
import { espacerPage } from "../../../src/briques/visuels/typographie-francaise";
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
import { T21, varianteFin } from "./pages/T21";
import { T22 } from "./pages/T22";
import { T23 } from "./pages/T23";
import { T24 } from "./pages/T24";
import { T26 } from "./pages/T26";
import { T27 } from "./pages/T27";
import { T28 } from "./pages/T28";

function dessiner(page: PageSpec, index: number, spec: ProprietesVisuelPage["spec"]): ReactElement {
  const total = spec.pages.length;
  switch (page.type) {
    case "T01":
      return <T01 titre={page.titre} sousTitre={page.sousTitre} index={index} total={total} />;
    case "T01B":
      return <T01B titre={page.titre} sousTitre={page.sousTitre} index={index} total={total} />;
    case "T01C":
      return <T01C titre={page.titre} sousTitre={page.sousTitre} index={index} total={total} />;
    case "T02":
      return <T02 titre={page.titre} cartes={page.cartes} index={index} total={total} />;
    case "T06":
      return <T06 titre={page.titre} points={page.points} index={index} total={total} />;
    case "T08":
      return <T08 titre={page.titre} avant={page.avant} apres={page.apres} index={index} total={total} />;
    case "T10":
      return <T10 message={page.message} legende={page.legende} index={index} total={total} />;
    case "T20":
      return <T20 titre={page.titre} etapes={page.etapes} index={index} total={total} />;
    case "T21":
      return <T21 index={index} total={total} variante={varianteFin(spec)} />;
    case "T22":
      return <T22 titre={page.titre} mythe={page.mythe} realite={page.realite} index={index} total={total} />;
    case "T23":
      return <T23 titre={page.titre} questions={page.questions} annotation={page.annotation} index={index} total={total} />;
    case "T24":
      return <T24 titre={page.titre} lignes={page.lignes} index={index} total={total} />;
    case "T26":
      return <T26 titre={page.titre} avant={page.avant} avec={page.avec} outils={page.outils} vous={page.vous} index={index} total={total} />;
    case "T27":
      return <T27 titre={page.titre} lignes={page.lignes} index={index} total={total} />;
    case "T28":
      return <T28 titre={page.titre} noeuds={page.noeuds} index={index} total={total} />;
  }
}

/**
 * Composition VisuelPage (1080 × 1350) : dessine UNE page (`index`) d'un CarrouselSpec déjà validé par le schéma Zod
 * (`src/visuels/proprietes-page.ts`). Tout texte vient du spec, sauf les textes génériques de `textes-fixes.ts` ;
 * la composition n'ajoute ni adresse, ni couleur libre.
 */
export function VisuelPage({ spec, index }: ProprietesVisuelPage) {
  // Typographie française (espaces insécables) appliquée à TOUS les textes du spec, avant le dessin.
  return dessiner(espacerPage(pageDuSpec(spec, index)), index, spec);
}
