/** Relevé, dans le DOM réel, de ce qui OCCUPE une page : lignes de texte et dessins (mesure du rendu, remplissage du corps de page). */
import { ATTRIBUT_DESSIN, dessinsSurveilles, type Boite } from "./zones";

const boiteDe = (r: DOMRect): Boite => ({ gauche: r.left, haut: r.top, droite: r.right, bas: r.bottom });

/** Lignes de texte sous `racine` : une boîte par ligne de chaque nœud texte non vide (pas la boîte de l'élément, plus large que son texte). */
export function lignesDeTexte(racine: Element): Boite[] {
  const lignes: Boite[] = [];
  const marcheur = racine.ownerDocument.createTreeWalker(racine, NodeFilter.SHOW_TEXT);
  const plage = racine.ownerDocument.createRange();
  for (let n = marcheur.nextNode(); n; n = marcheur.nextNode()) {
    if ((n.textContent ?? "").trim() === "") continue;
    plage.selectNodeContents(n);
    for (const l of plage.getClientRects()) lignes.push(boiteDe(l));
  }
  return lignes;
}

/** Dessins sous `racine` : enveloppes marquées `ATTRIBUT_DESSIN` et `<svg>` dessinés sur place (`dessinsSurveilles`). */
export function dessinsDe(racine: Element): Boite[] {
  return dessinsSurveilles(
    [...racine.querySelectorAll(`[${ATTRIBUT_DESSIN}], svg`)].map((e) => ({
      boite: boiteDe(e.getBoundingClientRect()),
      marque: e.hasAttribute(ATTRIBUT_DESSIN),
      svg: e.tagName.toLowerCase() === "svg",
      dansMarque: e.parentElement?.closest(`[${ATTRIBUT_DESSIN}]`) != null,
      avecTexte: (e.textContent ?? "").trim() !== "",
    })),
  );
}
