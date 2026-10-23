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
 * Le texte dit n'est JAMAIS retouché, ni aucun texte écrit ; aucun élément n'est retiré (sauf, au DÉCOUPAGE seulement et en dernier recours, l'allègement `allegerPage`). Bornes (`bornesFicheTableau`) : 14 scènes et 8 pages
 * au plus pour la page écrite au crayon, 10 pages pour « reference/2 » ; « reference/3 » : 18 scènes et 14 pages. En dernier recours, une page qu'aucune page de plus ne sauve est allégée au découpage (`allegerPage` : détail, dessin, visuel retirés, texte dit intact, retraits tracés). Ce qui ne se répare pas reste tel quel : la validation
 * le refuse alors avec un message qui dit quoi faire (`pourquoiPasDePageDePlus` donne la raison d'une page de plus impossible). Une fiche qui n'a rien à réparer est rendue telle quelle (même
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

/** Un essai de page de plus : son libellé (pour dire pourquoi il échoue) et sa fabrication (`null` : impossible). */
interface EssaiPageDePlus {
  libelle: string;
  faire: () => FicheTableau | null;
}

/** Les pages possibles, dans l'ordre : la dernière scène sur une page neuve, puis l'unique scène coupée à une fin de phrase. */
function essaisPageDePlus(fiche: FicheTableau, indices: number[]): EssaiPageDePlus[] {
  const essais: EssaiPageDePlus[] = [];
  if (indices.length >= 2) {
    const j = indices[indices.length - 1];
    essais.push({ libelle: `déplacer la scène ${fiche.scenes[j].id}`, faire: () => ({ ...fiche, scenes: fiche.scenes.map((s, i) => (i >= j ? { ...s, page: s.page + 1 } : s)) }) });
  } else {
    const scene = fiche.scenes[indices[0]];
    for (const c of coupes(scene.texteDit)) essais.push({ libelle: `couper ${scene.id} avant « ${mots(scene.texteDit)[c]} »`, faire: () => couperScene(fiche, indices[0], c, { nouvellePage: true }) });
  }
  return essais;
}

/** La page `page` passe à une page de plus : sa dernière scène (ou la seconde moitié de son unique scène) tourne la page. */
function pageDePlus(fiche: FicheTableau, page: number): FicheTableau | null {
  const bornes = bornesFicheTableau(fiche);
  if (Math.max(...fiche.scenes.map((s) => s.page)) >= bornes.pageMax) return null;
  const indices = fiche.scenes.flatMap((s, i) => (s.page === page ? [i] : []));
  if (!indices.length) return null;
  // Gabarits de page (« reference/2 », « reference/3 ») : la page de plus ne casse aucune règle du gabarit (une étape
  // qui garderait son numéro seul, une phrase écrite loin de ses mots) ; sinon on essaie la suivante.
  const avant = estGabarit(fiche) ? regleGabarit(fiche).length : 0;
  for (const essai of essaisPageDePlus(fiche, indices)) {
    const f = essai.faire();
    if (f && (!estGabarit(fiche) || regleGabarit(f).length <= avant)) return f;
  }
  return null;
}

/** Type de la raison : le message de refus en dépend (ce qu'il propose de faire). */
export type TypeRaisonPageDePlus = "une-phrase" | "scenes-max" | "pages-max" | "coupe-vide" | "coupe-impossible" | "regle-page" | "erreur";

/** Les détails sans leurs nombres : un ancien défaut dont le numéro a glissé n'est pas « nouveau ». */
const sansNombres = (detail: string) => detail.replace(/\d+/g, "#");

/**
 * POURQUOI la page `page` ne peut pas passer à une page de plus (pour le message de refus), avec le TYPE de raison ;
 * `null` si elle le peut ou s'il n'y a rien à dire. PURE, ne lève JAMAIS. Deux raisons au plus, séparées par « ; ».
 */
export function diagnosticPageDePlus(fiche: FicheTableau, page: number): { type: TypeRaisonPageDePlus; texte: string } | null {
  try {
    const bornes = bornesFicheTableau(fiche);
    if (Math.max(...fiche.scenes.map((s) => s.page)) >= bornes.pageMax) return { type: "pages-max", texte: `plus de page libre (${bornes.pageMax} pages au plus)` };
    const indices = fiche.scenes.flatMap((s, i) => (s.page === page ? [i] : []));
    if (!indices.length) return null;
    if (indices.length === 1) {
      const scene = fiche.scenes[indices[0]];
      if (fiche.scenes.length >= bornes.scenesMax) return { type: "scenes-max", texte: `${bornes.scenesMax} scènes au plus : la scène ne peut plus être coupée en deux` };
      if (scene.debutMs !== undefined || scene.finMs !== undefined) return { type: "coupe-impossible", texte: `la scène ${scene.id} est calée sur un temps fixé : elle ne peut pas être coupée` };
      if ((scene.ecrans ?? []).some((e) => e.moment === "appel")) return { type: "coupe-impossible", texte: `la scène ${scene.id} porte l'écran d'appel : elle ne peut pas être coupée` };
    }
    const essais = essaisPageDePlus(fiche, indices);
    if (!essais.length) return { type: "une-phrase", texte: `la scène ${fiche.scenes[indices[0]].id} ne dit qu'une phrase : aucune fin de phrase où la couper` };
    const gabarit = estGabarit(fiche);
    const detailsAvant = gabarit ? regleGabarit(fiche).map((m) => sansNombres(m.detail)) : [];
    const raisons: string[] = [];
    let type: TypeRaisonPageDePlus = "coupe-vide";
    for (const essai of essais) {
      const f = essai.faire();
      if (!f) {
        raisons.push(`${essai.libelle} laisse une moitié sans élément`);
        continue;
      }
      if (!gabarit) return null;
      const apres = regleGabarit(f);
      if (apres.length <= detailsAvant.length) return null;
      const nouveau = apres.find((m) => !detailsAvant.includes(sansNombres(m.detail)));
      type = "regle-page";
      raisons.push(`${essai.libelle} casse une règle de page${nouveau ? ` (${nouveau.sceneId ? `scène ${nouveau.sceneId} : ` : ""}${nouveau.detail.replace(/\.$/, "")})` : ""}`);
    }
    return raisons.length ? { type, texte: raisons.slice(0, 2).join(" ; ") } : null;
  } catch (e) {
    return { type: "erreur", texte: `la réparation s'est arrêtée sur une erreur : ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Le texte seul de `diagnosticPageDePlus`. */
export const pourquoiPasDePageDePlus = (fiche: FicheTableau, page: number): string | null => diagnosticPageDePlus(fiche, page)?.texte ?? null;

/** Ce qu'un allègement de dernier recours a retiré (pour le dire : rien n'est retiré en silence). */
export interface RetraitAllegement {
  page: number;
  sceneId: string;
  elementId: string;
  type: string;
}

/** Options de la réparation de densité. Par défaut : page de plus seulement, rien n'est jamais retiré. */
export interface OptionsDensite {
  /** Allègement de dernier recours (retire du contenu écrit) : AU DÉCOUPAGE seulement. */
  alleger?: boolean;
  /** Reçoit la liste des retraits faits par l'allègement. */
  retraits?: RetraitAllegement[];
  /** Nombre de problèmes de validation hors règle « page lisible » (injecté par le découpage : ce module n'importe pas `fiche.ts`). */
  verifier?: (fiche: FicheTableau) => number;
}

/** La page `page` échoue-t-elle à la MÊME mesure que la règle « page lisible » (vertical, sans format) ? */
function echoueEnVertical(fiche: FicheTableau, page: number): boolean {
  try {
    mettreEnPage(fiche);
    return false;
  } catch (e) {
    return e instanceof ErreurMiseEnPage && e.page === page;
  }
}

/** La mise en page (vertical) se termine sans exception, ou ne refuse qu'une AUTRE page : toute autre erreur est refusée. */
function tientEnVertical(fiche: FicheTableau, page: number): boolean {
  try {
    mettreEnPage(fiche);
    return true;
  } catch (e) {
    return e instanceof ErreurMiseEnPage && e.page !== page;
  }
}

/**
 * ALLÈGEMENT DE DERNIER RECOURS (essai réel du 23/10/2026) : la page `page` ne tient pas en vertical (la mesure de la
 * règle « page lisible »), aucune page de plus ne la sauve (page d'une seule phrase : rien à couper, bornes, règle de page).
 * On retire ce qui est écrit en trop, UN élément à la fois, dans l'ordre de priorité : le « détail » (de la dernière scène à
 * la première, sauf page d'appel), puis les dessins, puis le visuel de la scène. Un retrait n'est gardé que si la
 * mise en page se termine sans exception (hors une AUTRE page refusée), si la page garde du texte écrit, si la scène garde
 * un élément, si `regleGabarit` et la validation (hors règle de page, via `verifier`) n'empirent pas. Le premier retrait
 * (dans l'ordre de priorité) qui fait tenir la page est gardé ; sinon le premier retrait admissible, et on continue
 * (12 pas au plus). Texte dit jamais retouché, aucune scène supprimée. `null` : rien ne fait tenir la page.
 */
function allegerPage(fiche: FicheTableau, page: number, options: OptionsDensite): { fiche: FicheTableau; retraits: RetraitAllegement[] } | null {
  if (!echoueEnVertical(fiche, page)) return null;
  const gabarit = estGabarit(fiche);
  let courante = fiche;
  const retraits: RetraitAllegement[] = [];
  for (let pas = 0; pas < 12; pas++) {
    const regles = gabarit ? regleGabarit(courante).length : 0;
    const problemes = options.verifier ? options.verifier(courante) : 0;
    const candidats: { f: FicheTableau; retrait: RetraitAllegement }[] = [];
    const scenes = courante.scenes.flatMap((sc, i) => (sc.page === page ? [i] : [])).reverse();
    const sans = (i: number, e: { id: string; type: string }): void => {
      const sc = courante.scenes[i];
      const reste = sc.elements.filter((x) => x.id !== e.id && !(x.type === "geste" && x.cibleId === e.id));
      if (!reste.length) return;
      candidats.push({ f: { ...courante, scenes: courante.scenes.map((y, k) => (k === i ? { ...y, elements: reste } : y)) }, retrait: { page, sceneId: sc.id, elementId: e.id, type: e.type === "ligne" ? "détail" : e.type } });
    };
    for (const i of scenes) if (courante.scenes[i].gabarit?.role !== "appel") for (const e of courante.scenes[i].elements) if (e.type === "ligne" && e.bloc === "detail") sans(i, e);
    for (const i of scenes) for (const e of courante.scenes[i].elements) if (e.type === "dessin") sans(i, e);
    for (const i of scenes) {
      const g = courante.scenes[i].gabarit;
      if (!g?.visuel) continue;
      const { visuel, ...g2 } = g;
      candidats.push({ f: { ...courante, scenes: courante.scenes.map((y, k) => (k === i ? { ...y, gabarit: g2 } : y)) } as FicheTableau, retrait: { page, sceneId: courante.scenes[i].id, elementId: visuel.id, type: "visuel" } });
    }
    // La page garde toujours du texte écrit (jamais une page qui n'écrit plus rien).
    const ecrit = (c: FicheTableau) => c.scenes.some((sc) => sc.page === page && sc.elements.some((e) => e.type === "ligne" || (e.type === "preuve" && e.lignes.length)));
    const valides = candidats.filter((c) => ecrit(c.f) && (!gabarit || regleGabarit(c.f).length <= regles) && (!options.verifier || options.verifier(c.f) <= problemes));
    const tient = valides.find((c) => tientEnVertical(c.f, page));
    if (tient) return { fiche: tient.f, retraits: [...retraits, tient.retrait] };
    if (!valides.length) return null;
    courante = valides[0].f;
    retraits.push(valides[0].retrait);
  }
  return null;
}

/** La fiche (forme lisible) réparée ; elle-même si rien n'est à réparer ou si rien ne la répare. */
export function reparerDensiteFiche(fiche: FicheTableau, options: OptionsDensite = {}): FicheTableau {
  // Les retraits ne sont notés qu'au retour NORMAL : une exception à un tour suivant n'en laisse aucun.
  const locaux: RetraitAllegement[] = [];
  const f = reparerDensiteTours(fiche, options, locaux);
  options.retraits?.push(...locaux);
  return f;
}

/** La page où la mise en page VERTICALE (mesure de la règle « page lisible ») refuse, `null` si elle ne refuse rien. */
function pageVerticale(fiche: FicheTableau): number | null {
  try {
    mettreEnPage(fiche);
    return null;
  } catch (e) {
    return e instanceof ErreurMiseEnPage ? e.page : null;
  }
}

function reparerDensiteTours(fiche: FicheTableau, options: OptionsDensite, locaux: RetraitAllegement[]): FicheTableau {
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
    if (suite) {
      f = suite;
      continue;
    }
    // Dernier recours : la page de plus ne passe pas (une seule phrase, bornes, règle de page) ; on allège la page.
    // La page visée est celle du VERTICAL (la règle 4), pas forcément celle de `pageTropChargee` (carré, 16:9).
    if (!options.alleger || !estGabarit3(f)) return f; // « reference/3 » seulement
    const cible = pageVerticale(f);
    if (cible === null) return f;
    if (cible !== page) {
      const autre = pageDePlus(f, cible);
      if (autre) {
        f = autre;
        continue;
      }
    }
    const diag = diagnosticPageDePlus(f, cible);
    const allegee = diag && diag.type !== "erreur" ? allegerPage(f, cible, options) : null;
    if (!allegee) return f;
    f = allegee.fiche;
    locaux.push(...allegee.retraits);
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
export function reparerDensite<T>(brute: T, options: OptionsDensite = {}): T {
  if (!formeLisible(brute)) return brute;
  try {
    return reparerDensiteFiche(brute, options) as T;
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
