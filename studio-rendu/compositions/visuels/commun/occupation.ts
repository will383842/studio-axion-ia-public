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

/** Attribut d'une LIAISON (flèche entre deux nœuds de T28) : un obstacle pour le texte, mais pas une « occupation » de la page. */
export const ATTRIBUT_LIAISON = "data-liaison";

/**
 * Dessins sous `racine` : enveloppes marquées `ATTRIBUT_DESSIN` et `<svg>` dessinés sur place (`dessinsSurveilles`). `pourVide` : sans les
 * liaisons (`ATTRIBUT_LIAISON`) ; une flèche étirée entre deux nœuds ne remplit pas la page (ART-1, T28), elle ne compte pas dans le vide.
 */
export function dessinsDe(racine: Element, { pourVide = false }: { pourVide?: boolean } = {}): Boite[] {
  return dessinsSurveilles(
    [...racine.querySelectorAll(`[${ATTRIBUT_DESSIN}], svg`)].filter((e) => !pourVide || !e.closest(`[${ATTRIBUT_LIAISON}]`)).map((e) => ({
      boite: boiteDe(e.getBoundingClientRect()),
      marque: e.hasAttribute(ATTRIBUT_DESSIN),
      svg: e.tagName.toLowerCase() === "svg",
      dansMarque: e.parentElement?.closest(`[${ATTRIBUT_DESSIN}]`) != null,
      avecTexte: (e.textContent ?? "").trim() !== "",
    })),
  );
}

/** Attribut posé par `Titre.tsx` sur un bloc de titre ajusté (corps en px). */
export const ATTRIBUT_TITRE = "data-titre-taille";

/**
 * Encre RÉELLE des lignes de chaque titre ajusté (ART-1) : ligne de base déduite de la boîte de ligne et des métriques de la police
 * (`fontBoundingBox*` : CSS centre la zone de contenu dans la hauteur de ligne), haut et bas de l'encre par `actualBoundingBox*` du canvas,
 * même police, même graisse, même corps. Une liste par titre, lignes de haut en bas.
 */
export function encreDesTitres(racine: Element): { haut: number; bas: number }[][] {
  const contexte = racine.ownerDocument.createElement("canvas").getContext("2d");
  if (!contexte) throw new Error("Canvas 2D indisponible : encre des titres non mesurable");
  return [...racine.querySelectorAll(`[${ATTRIBUT_TITRE}]`)].map((titre) =>
    [...titre.children].map((ligne) => {
      const st = getComputedStyle(ligne);
      contexte.font = `${st.fontWeight} ${st.fontSize} ${st.fontFamily}`;
      const m = contexte.measureText(ligne.textContent ?? "");
      const r = ligne.getBoundingClientRect();
      const base = r.top + (r.height - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent;
      return { haut: base - m.actualBoundingBoxAscent, bas: base + m.actualBoundingBoxDescent };
    }),
  );
}

/** Tolérance (px) de la mesure des textes trop larges : arrondis de flottants seulement (un texte qui dépasse d'un pixel peut toucher une zone réservée). */
const TOLERANCE_LARGEUR = 0.05;

/** Bord droit (px) du contenu d'un élément : sa boîte moins son remplissage et sa bordure droits. */
function droiteContenu(e: Element): number {
  const st = getComputedStyle(e);
  return e.getBoundingClientRect().right - parseFloat(st.paddingRight) - parseFloat(st.borderRightWidth);
}

/**
 * Blocs de texte plus larges que leur place sous `racine` (ART-1, tour 2) : une ligne de texte (mot insécable plus large que sa colonne,
 * « professionnalisation » dans un nœud de T28) dépasse le contenu de son élément, ou une boîte insécable (pastille d'outil en `nowrap`)
 * sort du contenu de son parent. Le cadre total peut tenir quand même : `Remplir` refuse alors le facteur, la mesure du rendu le compte en
 * débordement.
 */
export function textesTropLarges(racine: Element): number {
  let n = 0;
  const plage = racine.ownerDocument.createRange();
  for (const e of racine.querySelectorAll<HTMLElement>("*")) {
    const textes = [...e.childNodes].filter((c) => c.nodeType === Node.TEXT_NODE && (c.textContent ?? "").trim() !== "");
    const st = getComputedStyle(e);
    if (textes.length === 0 || st.display === "inline") continue;
    // Bloc tourné (annotation manuscrite) : ses boîtes à l'écran sont celles du dessin tourné ; on compare ses largeurs propres.
    if (st.transform !== "none") {
      if (e.scrollWidth > e.clientWidth) n++;
      continue;
    }
    const droite = droiteContenu(e) + TOLERANCE_LARGEUR;
    const ligneTropLarge = textes.some((t) => {
      plage.selectNodeContents(t);
      return [...plage.getClientRects()].some((r) => r.right > droite);
    });
    // Parent qui porte une boîte (un `display: contents` n'en a pas : on remonte au suivant).
    let parent = e.parentElement;
    while (parent && getComputedStyle(parent).display === "contents") parent = parent.parentElement;
    if (ligneTropLarge || (parent && e.getBoundingClientRect().right > droiteContenu(parent) + TOLERANCE_LARGEUR)) n++;
  }
  return n;
}
