/**
 * RÉPARATION AUTOMATIQUE DE LA DENSITÉ (14/10/2026). PURE et DÉTERMINISTE.
 *
 * Constat du 14/10 au matin : le studio a refusé deux fois de suite un découpage dense, pour deux motifs que la
 * machine sait réparer seule : « scène s07 : 9 éléments » (6 au plus) et « page 6 trop chargée ». La règle ne change
 * pas : c'est l'entrée qui est réparée, au même endroit que les autres remises en forme (`remettreEnForme`, à la lecture
 * de la réponse du découpage et à l'enregistrement d'une correction à la main), AVANT tout refus :
 *  1. une scène de plus de 6 éléments est COUPÉE en deux à une fin de phrase (`couperScene`, `rythme.ts`) : chaque
 *     élément va à la moitié où il est dit, ses gestes le suivent ; recommencé tant qu'une moitié dépasse ;
 *  2. une page trop chargée (plus de 40 mots ou de lignes écrites que permis, ou qui ne tient pas dans la zone sûre de
 *     sa mise en page : le vertical pour « reference/1 », les quatre sorties pour « reference/2 ») PASSE À UNE PAGE DE PLUS : sa dernière scène part sur une page neuve (les pages suivantes
 *     glissent d'un cran) ; une page d'une seule scène est d'abord coupée à une fin de phrase, la seconde moitié tourne
 *     la page. Au style « reference/2 », la page neuve est une page de SUITE (même rôle, pas de nouveau titre).
 * Le texte dit n'est JAMAIS retouché, ni aucun texte écrit ; aucun élément n'est retiré. Bornes : 14 scènes et 8 pages
 * au plus pour la page écrite au crayon, 10 pages pour « reference/2 » (`bornesFicheTableau`). Ce qui ne se répare pas reste tel quel : la validation
 * le refuse alors avec un message qui dit quoi faire. Une fiche qui n'a rien à réparer est rendue telle quelle (même
 * objet). Ne lève jamais.
 */
import { debutsDePhrase, mots } from "@/domaine/controles-script/texte";
import { bornesFicheTableau, estGabarit, estGabarit3, estPageEcriteCrayon, regleGabarit } from "./gabarit";
import { estStyleTableau, styleTableauDe } from "@/briques/tableau-scene/trois-styles/styles";
import type { FicheTableau } from "./fiche";
import { IDS_FORMATS_SORTIE } from "./formats-sortie";
import { ErreurMiseEnPage, mettreEnPage } from "./mise-en-page";
import { PAGE_LIGNES_MAX, PAGE_LIGNES_MAX_GABARIT, PAGE_MOTS_MAX, textesEcrits } from "./regles";
import { couperScene } from "./rythme";

/** Tours de réparation au plus. */
const TOURS_MAX = 24;

/** Débuts de phrase d'une scène, du plus proche du milieu au plus loin. */
function coupes(texteDit: string): number[] {
  const n = mots(texteDit).length;
  return debutsDePhrase(texteDit).sort((a, b) => Math.abs(a - n / 2) - Math.abs(b - n / 2) || a - b);
}

/** Coupe la première scène de plus de 6 éléments ; `null` si aucune (ou si aucune coupe n'est possible). */
function couperSceneChargee(fiche: FicheTableau): FicheTableau | null {
  const max = bornesFicheTableau(fiche).elementsMax;
  for (let i = 0; i < fiche.scenes.length; i++) {
    const s = fiche.scenes[i];
    if (s.elements.length <= max) continue;
    // La coupe la plus équilibrée en éléments, à égalité la plus proche du milieu du texte dit.
    let meilleure: { f: FicheTableau; ecart: number } | null = null;
    for (const c of coupes(s.texteDit)) {
      const f = couperScene(fiche, i, c);
      if (!f) continue;
      const a = f.scenes[i].elements.length;
      const b = f.scenes[i + 1].elements.length;
      const ecart = Math.abs(a - b);
      if (!meilleure || ecart < meilleure.ecart) meilleure = { f, ecart };
    }
    if (meilleure) return meilleure.f;
  }
  return null;
}

/** Première page trop chargée : trop de mots ou de lignes écrites, ou une page qui ne tient pas dans sa mise en page. */
export function pageTropChargee(fiche: FicheTableau): number | null {
  const lignesMax = estGabarit(fiche) ? PAGE_LIGNES_MAX_GABARIT : PAGE_LIGNES_MAX;
  const parPage = new Map<number, { mots: number; lignes: number }>();
  for (const s of fiche.scenes) {
    const p = parPage.get(s.page) ?? { mots: 0, lignes: 0 };
    for (const e of s.elements) {
      p.mots += textesEcrits(e).reduce((t, x) => t + mots(x).length, 0);
      p.lignes += e.type === "ligne" ? 1 : e.type === "preuve" ? e.lignes.length : 0;
    }
    parPage.set(s.page, p);
  }
  for (const [page, p] of [...parPage].sort((a, b) => a[0] - b[0])) if (p.mots > PAGE_MOTS_MAX || p.lignes > lignesMax) return page;
  // « reference/2 » : la page doit tenir dans les QUATRE sorties (vertical, portrait, carré, horizontal), la plus basse
  // décide ; « reference/1 » : le vertical, comme ses règles. « reference/3 » : dans le style du tableau de la fiche
  // quand il est posé (`pagesDuStyle`), sinon la page ivoire.
  const formats = estGabarit(fiche) ? IDS_FORMATS_SORTIE : (["vertical"] as const);
  let premiere: number | null = null;
  for (const format of formats) {
    try {
      mettreEnPage(fiche, format === "vertical" ? {} : { format });
    } catch (e) {
      if (!(e instanceof ErreurMiseEnPage)) return premiere;
      premiere = premiere === null ? e.page : Math.min(premiere, e.page);
    }
  }
  return premiere;
}

/** La page `page` passe à une page de plus : sa dernière scène (ou la seconde moitié de son unique scène) tourne la page. */
function pageDePlus(fiche: FicheTableau, page: number): FicheTableau | null {
  const bornes = bornesFicheTableau(fiche);
  if (Math.max(...fiche.scenes.map((s) => s.page)) >= bornes.pageMax) return null;
  const indices = fiche.scenes.flatMap((s, i) => (s.page === page ? [i] : []));
  if (!indices.length) return null;
  // Les pages possibles, dans l'ordre : la dernière scène sur une page neuve, puis l'unique scène coupée à une fin de phrase.
  const essais: (() => FicheTableau | null)[] = [];
  if (indices.length >= 2) {
    const j = indices[indices.length - 1];
    essais.push(() => ({ ...fiche, scenes: fiche.scenes.map((s, i) => (i >= j ? { ...s, page: s.page + 1 } : s)) }));
  } else for (const c of coupes(fiche.scenes[indices[0]].texteDit)) essais.push(() => couperScene(fiche, indices[0], c, { nouvellePage: true }));
  // Gabarits de page (« reference/2 », « reference/3 ») : la page de plus ne casse aucune règle du gabarit (une étape
  // qui garderait son numéro seul, une phrase écrite loin de ses mots) ; sinon on essaie la suivante.
  const avant = estGabarit(fiche) ? regleGabarit(fiche).length : 0;
  for (const essai of essais) {
    const f = essai();
    if (f && (!estGabarit(fiche) || regleGabarit(f).length <= avant)) return f;
  }
  return null;
}

/** La fiche (forme lisible) réparée ; elle-même si rien n'est à réparer ou si rien ne la répare. */
export function reparerDensiteFiche(fiche: FicheTableau): FicheTableau {
  let f = fiche;
  for (let tour = 0; tour < TOURS_MAX; tour++) {
    const coupee = couperSceneChargee(f);
    if (coupee) {
      f = coupee;
      continue;
    }
    // Pages : seulement pour la page écrite au crayon (les autres styles ont leurs propres écrans ou pages).
    if (!estPageEcriteCrayon(f)) return f;
    const page = pageTropChargee(f);
    if (page === null) return f;
    const suite = pageDePlus(f, page);
    if (!suite) return f;
    f = suite;
  }
  return f;
}

const estObjet = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);

/** Assez bien formée pour être coupée et mise en page (sinon la validation dira ce qui manque). */
function formeLisible(brute: unknown): brute is FicheTableau {
  if (!estObjet(brute) || typeof brute.habillage !== "string" || !Array.isArray(brute.scenes) || !brute.scenes.length) return false;
  return brute.scenes.every(
    (s) =>
      estObjet(s) &&
      typeof s.id === "string" &&
      typeof s.texteDit === "string" &&
      Number.isInteger(s.page) &&
      Array.isArray(s.elements) &&
      s.elements.every((e) => estObjet(e) && typeof e.id === "string" && typeof e.type === "string" && (e.type === "mention" || Number.isInteger(e.ancre)) && (e.type !== "ligne" || typeof e.texte === "string") && (e.type !== "preuve" || Array.isArray(e.lignes))),
  );
}

/** Réparation de la densité d'une fiche BRUTE : rendue telle quelle si elle n'est pas lisible ou si rien ne la répare. */
export function reparerDensite<T>(brute: T): T {
  if (!formeLisible(brute)) return brute;
  try {
    return reparerDensiteFiche(brute) as T;
  } catch {
    return brute;
  }
}

/**
 * Fiche « reference/3 » lue avant la fabrication (relecture de l'écran de création, étape « fiche » de la fabrication) :
 * son style du tableau posé (celui de la série), puis la réparation des pages DANS CE STYLE (vidéo v-6616b3800357 : la
 * page de l'exemple tenait sur la page ivoire, pas sur l'ardoise en 4:5, carré et 16:9, et la relecture refusait) : une
 * page qui ne tient pas passe d'elle-même à une page de plus. Toute autre fiche : telle quelle.
 */
export function pagesDuStyle(brute: unknown): unknown {
  if (!brute || typeof brute !== "object" || !estGabarit3(brute as FicheTableau) || !Array.isArray((brute as FicheTableau).scenes)) return brute;
  const f = brute as FicheTableau;
  // (Le style de la série, comme `avecStyleTableau` : `fiche.ts` n'est pas importé ici, il importe ce module.)
  return reparerDensite(estStyleTableau(f.styleTableau) ? f : { ...f, styleTableau: styleTableauDe(f) });
}
