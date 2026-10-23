/**
 * CONTRÔLES DE L'IMAGE PROPRES AU STYLE « reference/1 » (page blanche écrite au crayon). Ni cadre, ni carte, ni
 * étiquette à contrôler : la page est faite de blocs de texte et de petits dessins. PUR, sur la mise en page seule.
 *
 *  - rien ne dépasse : chaque bloc, chaque dessin et chaque marque du crayon restent dans la zone sûre ;
 *  - aucun chevauchement : deux blocs, deux dessins ou un bloc et un dessin ne se touchent jamais (marques comprises) ;
 *  - un dessin par idée : un bloc porte au plus un dessin, chaque dessin est à côté d'un bloc (ou seul sur sa rangée) ;
 *  - couleurs du style : le texte n'est écrit qu'en encre, terracotta ou sauge ; les dessins ne prennent que la palette ;
 *  - texte écrit une fois : un même texte n'apparaît qu'une fois sur une page ;
 *  - blocs courts : 1 à 3 lignes par bloc (une preuve : par ligne « Avant » / « Après ») ;
 *  - page non vide : chaque page porte au moins un bloc écrit (aucune page blanche, aucune page de dessins seuls) ;
 *  - page remplie : une page de 2 blocs écrits ou plus remplit au moins 80 % de sa hauteur utile, à partir du
 *    haut (aucune page à moitié vide) ; texte jamais sous 44 px de référence.
 * La taille minimale, le contraste et la première image restent ceux de la brique commune, à ses seuils
 * (`seuilsImageReference`).
 */
import { SEUILS_CONTROLE_IMAGE, type SeuilsControleImage } from "@/briques/controle-image";
import { COULEURS_TEXTE_REFERENCE, COULEURS_DESSINS, TAILLES_REFERENCE, couleurDuTon } from "@/briques/tableau-scene/reference/charte";
import { couleursClipart } from "@/briques/tableau-scene/reference/cliparts";
import { cleMot } from "./fiche";
import { ACCROCHE_MOTS_MAX_3 } from "./regles";
import type { ElementPlace, MiseEnPageTableau, RectPx } from "./mise-en-page";

/** Lignes au plus par bloc. */
export const LIGNES_BLOC_MAX = 3;
/** Contraste minimal du texte (on le garde à 4,5 pour 1, même si 44 px et plus sont du « grand texte »). */
export const CONTRASTE_TEXTE_REFERENCE = 4.5;

/** Une faute, et la scène où elle se voit. */
export interface FauteReference {
  sceneId: string;
  message: string;
}

/** Seuils de la brique commune pour ce style : jamais sous `texteMin` (44 px de référence), 4,5 pour 1, aucune bande (« reference/3 » : la bande des sous-titres). */
export function seuilsImageReference(mise: MiseEnPageTableau, injectes?: Partial<SeuilsControleImage>): SeuilsControleImage {
  const k = mise.styleReference?.k ?? 1;
  // « reference/3 » : l'accroche est la phrase entière de la douleur, écrite en très grand dès la première image.
  const accroche = mise.styleReference?.style === "reference/3" ? { accrocheMotsMax: ACCROCHE_MOTS_MAX_3 } : {};
  // « reference/3 » : la bande basse de la zone sûre est réservée aux sous-titres communs (charte Axion, 15/10/2026).
  const bande = mise.styleReference?.style === "reference/3" ? mise.bandeSousTitres.px.hauteur / mise.hauteurPx : 0;
  return { ...SEUILS_CONTROLE_IMAGE, ...injectes, ...accroche, tailleTexteMin: (TAILLES_REFERENCE.texteMin * k) / mise.hauteurPx - 1e-6, contrasteTexteMin: CONTRASTE_TEXTE_REFERENCE, bandeSousTitres: bande };
}

const touche = (a: RectPx, b: RectPx) => Math.min(a.x + a.largeur, b.x + b.largeur) > Math.max(a.x, b.x) && Math.min(a.y + a.hauteur, b.y + b.hauteur) > Math.max(a.y, b.y);
const nom = (e: ElementPlace) => (e.type === "dessin" ? `le dessin « ${e.dessinId} »` : `« ${e.lignes.map((l) => l.texte).join(" ")} »`);
const encombrement = (e: ElementPlace) => (e.encombrement ?? e).px;

/** Rien ne dépasse de la zone sûre (blocs, dessins, marques et gestes). */
export function horsZoneReference(mise: MiseEnPageTableau): FauteReference[] {
  const z = mise.zoneSure.px;
  const dedans = (r: RectPx) => r.x >= z.x - 0.5 && r.y >= z.y - 0.5 && r.x + r.largeur <= z.x + z.largeur + 0.5 && r.y + r.hauteur <= z.y + z.hauteur + 0.5;
  return mise.pages.flatMap((p) => [
    ...p.elements.filter((e) => !dedans(encombrement(e))).map((e) => ({ sceneId: e.sceneId, message: `page ${p.page} : ${nom(e)} sort de la zone sûre` })),
    ...p.gestes.filter((g) => g.zone && !dedans(g.zone.px)).map((g) => ({ sceneId: g.sceneId, message: `page ${p.page} : le geste « ${g.elementId} » sort de la zone sûre` })),
  ]);
}

/** Aucun chevauchement entre deux éléments d'une page (marques comprises). */
export function chevauchementsReference(mise: MiseEnPageTableau): FauteReference[] {
  const res: FauteReference[] = [];
  for (const p of mise.pages) {
    const es = p.elements;
    for (let i = 0; i < es.length; i++)
      for (let j = i + 1; j < es.length; j++)
        if (touche(encombrement(es[i]), encombrement(es[j]))) res.push({ sceneId: es[j].sceneId, message: `page ${p.page} : ${nom(es[i])} touche ${nom(es[j])}` });
  }
  return res;
}

/** Un dessin par idée : au plus un dessin par bloc ; un dessin est rattaché à un bloc, ou seul au centre. */
export function dessinsParIdeeReference(mise: MiseEnPageTableau): FauteReference[] {
  const res: FauteReference[] = [];
  for (const p of mise.pages) {
    const parBloc = new Map<string, number>();
    for (const e of p.elements.filter((x) => x.type === "dessin")) {
      if (!e.rattache) {
        if (e.cote !== "centre") res.push({ sceneId: e.sceneId, message: `page ${p.page} : le dessin « ${e.dessinId} » n'est à côté d'aucune idée` });
        continue;
      }
      if (!p.elements.some((x) => x.elementId === e.rattache && x.type !== "dessin")) res.push({ sceneId: e.sceneId, message: `page ${p.page} : le dessin « ${e.dessinId} » vise un bloc absent` });
      parBloc.set(e.rattache, (parBloc.get(e.rattache) ?? 0) + 1);
    }
    for (const [id, n] of parBloc) if (n > 1) res.push({ sceneId: p.elements.find((x) => x.elementId === id)?.sceneId ?? "", message: `page ${p.page} : ${n} dessins pour la même idée (« ${id} »)` });
  }
  return res;
}

/** Couleurs du style : encre, terracotta, sauge pour le texte ; la palette pour les dessins. */
export function couleursHorsStyleReference(mise: MiseEnPageTableau): FauteReference[] {
  const res: FauteReference[] = [];
  for (const p of mise.pages)
    for (const e of p.elements) {
      if (e.type === "dessin") {
        const hors = couleursClipart(e.dessinId ?? "").filter((c) => !COULEURS_DESSINS.includes(c));
        if (hors.length) res.push({ sceneId: e.sceneId, message: `page ${p.page} : le dessin « ${e.dessinId} » prend ${hors.join(", ")}` });
        continue;
      }
      for (const l of e.lignes) {
        const c = l.ton ? couleurDuTon(l.ton) : e.couleurTexte;
        if (!c || !COULEURS_TEXTE_REFERENCE.includes(c)) res.push({ sceneId: e.sceneId, message: `page ${p.page} : « ${l.texte} » est écrit en ${c ?? "couleur inconnue"}` });
      }
    }
  return res;
}

/** Un même texte n'est écrit qu'une fois par page. */
export function textesEnDoubleReference(mise: MiseEnPageTableau): FauteReference[] {
  const res: FauteReference[] = [];
  for (const p of mise.pages) {
    const vus = new Set<string>();
    for (const e of p.elements.filter((x) => x.type !== "dessin")) {
      const cle = e.lignes.map((l) => l.texte).join(" ").split(/\s+/).map(cleMot).filter(Boolean).join(" ");
      // Un élément sans texte (dessin tracé des trois styles du tableau) n'est jamais un texte en double.
      if (!cle) continue;
      if (vus.has(cle)) res.push({ sceneId: e.sceneId, message: `page ${p.page} : ${nom(e)} est écrit deux fois` });
      vus.add(cle);
    }
  }
  return res;
}

/** Blocs de 1 à 3 lignes (une preuve : par ligne « Avant » / « Après »). */
export function blocsTropLongsReference(mise: MiseEnPageTableau): FauteReference[] {
  return mise.pages.flatMap((p) =>
    p.elements
      .filter((e) => e.type !== "dessin")
      .flatMap((e) => {
        // Les lignes d'un même bloc se suivent sans écart ; une preuve a un écart entre ses lignes « Avant » / « Après ».
        let n = 0;
        let max = 0;
        e.lignes.forEach((l, i) => {
          const prec = e.lignes[i - 1]?.px;
          n = prec && Math.abs(l.px.y - (prec.y + prec.hauteur)) <= 1 ? n + 1 : 1;
          max = Math.max(max, n);
        });
        return max > LIGNES_BLOC_MAX ? [{ sceneId: e.sceneId, message: `page ${p.page} : ${nom(e)} fait plus de ${LIGNES_BLOC_MAX} lignes` }] : [];
      }),
  );
}

/** Chaque page porte au moins un bloc écrit. */
export function pagesVidesReference(mise: MiseEnPageTableau): FauteReference[] {
  return mise.pages.flatMap((p) => (p.elements.some((e) => e.type !== "dessin") ? [] : [{ sceneId: p.elements.at(-1)?.sceneId ?? "", message: `page ${p.page} : aucun texte écrit` }]));
}

/** Blocs écrits à partir desquels une page doit être remplie (14/10 : dès 2, « jamais de grand vide en bas »). */
export const BLOCS_PAGE_REMPLIE = 2;
/** Part de la hauteur utile qu'une page de 2 blocs ou plus remplit au moins (14/10 : 80 %, au lieu des 2/3). */
export const REMPLISSAGE_MIN = 0.8;

/** Une page de 2 blocs écrits ou plus remplit au moins 80 % de sa hauteur utile. */
export function pagesTropVidesReference(mise: MiseEnPageTableau): FauteReference[] {
  return mise.pages.flatMap((p) => {
    const textes = p.elements.filter((e) => e.type !== "dessin");
    if (textes.length < BLOCS_PAGE_REMPLIE || p.occupation + 1e-6 >= REMPLISSAGE_MIN) return [];
    return [{ sceneId: textes.at(-1)!.sceneId, message: `page ${p.page} : la page n'est remplie qu'à ${Math.round(p.occupation * 100)} % (au moins ${Math.round(REMPLISSAGE_MIN * 100)} %)` }];
  });
}
