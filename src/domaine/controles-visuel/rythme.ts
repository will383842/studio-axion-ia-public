/** Contrôles de structure d'un carrousel (pages, rythme, variété, titres, série, densité) : purs. */
import { dessinsDuCarrousel, ILLUSTRATIONS_FIXES } from "../../briques/visuels/choix-illustration";
import { motLePlusLarge } from "../../briques/visuels/largeur-mot";
import { placesDesMots } from "../../briques/visuels/places-mots";
import { CAPACITE_COMPARAISON, capaciteMotCarte, PAGES, type TypePage } from "../../briques/visuels/registre-pages";
import type { ControlePorte } from "../visuels/contrats";
import type { CarrouselSpecType, PageSpec } from "../visuels/types";
import { mots, normaliser } from "./texte";
import { textesDe } from "./textes-de";

export const PAGES_MIN = 6;
export const TYPES_MIN = 4;
export const SERIE_MAX = 3;
export const MOTS_ORANGE = 200;
export const MOTS_ROUGE = 260;

const RANGS: Record<string, number> = { un: 1, premier: 1, premiere: 1, deux: 2, deuxieme: 2, second: 2, seconde: 2, trois: 3, troisieme: 3 };

/**
 * Rang écrit dans un titre : un ordinal (« Deuxième cas ») ou un nombre après un mot de rang (« Scénario 2 », « Cas n° 3 ») ; undefined
 * sinon. Un nombre seul n'est pas un rang (« Une relance oubliée », « Deux devis perdus »).
 */
function rangDuTitre(titre: string): number | undefined {
  const t = normaliser(titre);
  const m =
    /(?<![\p{L}\p{N}])(premiere?|deuxieme|seconde?|troisieme)(?![\p{L}\p{N}])/u.exec(t) ??
    /(?<![\p{L}\p{N}])(?:scenario|cas|exemple|situation)(?: type)?(?: n| no| numero)? (\d{1,2}|un|deux|trois)(?![\p{L}\p{N}])/u.exec(t);
  return m ? (RANGS[m[1]] ?? Number(m[1])) : undefined;
}

/**
 * Pages (index) d'une série T26 NUMÉROTÉE : des cas concrets qui se suivent, SERIE_MAX au plus, chacun portant son rang dans le titre
 * (1, 2, 3). Une telle série est permise à la suite (orange), pas une suite de cas sans rang.
 */
export function serieNumerotee(pages: readonly { type?: string; titre?: string }[]): Set<number> {
  const res = new Set<number>();
  for (let i = 0; i < pages.length; ) {
    let j = i;
    while (j < pages.length && pages[j].type === "T26") j++;
    const n = j - i;
    if (n >= 2 && n <= SERIE_MAX && pages.slice(i, j).every((p, k) => p.titre !== undefined && rangDuTitre(p.titre) === k + 1)) for (let k = i; k < j; k++) res.add(k);
    i = Math.max(j, i + 1);
  }
  return res;
}

const NOMBRES: Record<string, number> = { deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12 };
/**
 * Un nombre suivi d'un NOM DE COMPTE (« 3 QUESTIONS », « TROIS BONS GESTES ») : seule annonce du nombre d'éléments de la page. Un autre
 * nombre (« 1 seul outil », « 3 clients sur 4 », une durée) ne dit rien des éléments et n'est pas contrôlé.
 */
const NOMBRE_COMPTE =
  /(?<![\p{L}\p{N}])(\d{1,2}|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze)\s+(?:(?:bons|bonnes|grands|grandes|petits|petites|vrais|vraies)\s+)?(?:questions?|gestes?|[ée]tapes?|erreurs?|conseils?|points?|raisons?|signes?|r[ée]flexes?|astuces?|cl[ée]s|r[èe]gles?|pi[èe]ges?|leviers?|id[ée]es?|actions?|habitudes?|pratiques?|cas|sc[ée]narios?|mythes?|crit[èe]res?|le[çc]ons?|secrets?)(?![\p{L}])(?!\s+sur\s+\d)/iu;

/** Éléments réels d'une page ; undefined pour une page sans éléments à compter (couverture, message). */
function elementsDe(p: PageSpec): number | undefined {
  switch (p.type) {
    case "T02":
      return p.cartes.length;
    case "T06":
      return p.points.length;
    case "T20":
      return p.etapes.length;
    case "T23":
      return p.questions.length;
    case "T24":
    case "T27":
      return p.lignes.length;
    case "T28":
      return p.noeuds.length;
    case "T08":
    case "T22":
      return 2;
    default:
      return undefined;
  }
}

/** Famille de mise en page d'un type : celle du registre, seule source ; le type lui-même s'il n'y est pas. */
export const familleDePage = (type: string): string => (Object.hasOwn(PAGES, type) ? PAGES[type as TypePage].famille : type);

/**
 * Types dont chaque élément porte un rang dessiné en rangées (« 01 », « 02 », « 03 ») : liste, étapes, questions. Deux pages de ces types à
 * la suite se lisent comme une seule longue liste, quelle que soit leur famille au registre (T06 et T23 « liste », T20 « etapes ») : refusées.
 */
const TYPES_NUMEROTES: readonly string[] = ["T06", "T20", "T23"];
export const pageNumerotee = (p: { type?: string }): boolean => p.type !== undefined && TYPES_NUMEROTES.includes(p.type);

export function controlesStructure(spec: CarrouselSpecType): ControlePorte[] {
  const res: ControlePorte[] = [];
  const { pages } = spec;

  if (pages.length < PAGES_MIN) {
    res.push({ code: "PAGES", niveau: "orange", phrase: `Le carrousel n'a que ${pages.length} pages ; il en faut au moins ${PAGES_MIN} pour bien raconter le sujet.` });
  }
  if (!pages.some((p) => p.type === "T21")) {
    res.push({ code: "PAGES", niveau: "orange", phrase: "Il manque la dernière page (T21), qui invite à écrire en message privé." });
  }

  // Variété (L7) : deux pages de même FAMILLE (`PAGES[type].famille`) à la suite sont refusées ; le même type en est le cas particulier
  // (RYTHME). Seule une série T26 numérotée (SERIE_MAX pages au plus) passe, en orange ; la note (critère 7) l'exempte de même.
  const serie = serieNumerotee(pages.map((p) => ({ type: p.type, ...("titre" in p ? { titre: p.titre } : {}) })));
  pages.forEach((p, i) => {
    if (i === 0) return;
    const avant = pages[i - 1];
    if (serie.has(i - 1) && serie.has(i)) {
      res.push({ code: "SERIE_NUMEROTEE", niveau: "orange", page: i + 1, phrase: `Pages ${i} et ${i + 1} : deux cas concrets à la suite (série numérotée) ; permis jusqu'à ${SERIE_MAX}, mais le carrousel ralentit.` });
    } else if (avant.type === p.type) {
      res.push({ code: "RYTHME", niveau: "rouge", page: i + 1, phrase: `Pages ${i} et ${i + 1} : deux pages de suite de même type (${p.type}) ; alternez les mises en page.` });
    } else if (familleDePage(avant.type) === familleDePage(p.type)) {
      const famille = familleDePage(p.type);
      res.push({ code: "FAMILLE", niveau: "rouge", page: i + 1, phrase: `Pages ${i} et ${i + 1} : deux mises en page de même famille (« ${famille} » : ${avant.type} puis ${p.type}) à la suite ; intercalez une page d'une autre famille.` });
    } else if (pageNumerotee(avant) && pageNumerotee(p)) {
      res.push({ code: "FAMILLE", niveau: "rouge", page: i + 1, phrase: `Pages ${i} et ${i + 1} : deux listes numérotées (01, 02, 03 : ${avant.type} puis ${p.type}) à la suite ; intercalez une page d'une autre forme.` });
    }
  });

  // Un même dessin (illustration ou icône) jamais deux fois (L7). Les scènes fixes du gabarit T26 reviennent à chaque cas concret : entre
  // deux T26 elles ne comptent pas (le nombre de cas est borné par SERIE, leur suite par RYTHME / SERIE_NUMEROTEE).
  const fixes: readonly string[] = ILLUSTRATIONS_FIXES.T26;
  const dessins = new Map<string, number>();
  const signales = new Set<string>();
  for (const { page, dessin } of dessinsDuCarrousel(spec)) {
    const premiere = dessins.get(dessin);
    if (premiere === undefined) {
      dessins.set(dessin, page);
      continue;
    }
    if (fixes.includes(dessin) && pages[premiere - 1].type === "T26" && pages[page - 1].type === "T26") continue;
    if (signales.has(`${dessin}@${page}`)) continue;
    signales.add(`${dessin}@${page}`);
    const nom = dessin.startsWith("icone-") ? `l'icône « ${dessin.slice(6)} »` : dessin.startsWith("maquette-") ? `la mini-maquette « ${dessin.slice(9)} »` : `l'illustration ${dessin}`;
    res.push({ code: "DESSIN_DOUBLE", niveau: "rouge", page, phrase: `Page ${page} : ${nom} est déjà dessinée ${premiere === page ? "sur cette page" : `page ${premiere}`} ; un même dessin ne revient jamais dans un carrousel, choisissez-en un autre.` });
  }

  // Un nombre écrit dans un titre (« 3 QUESTIONS ») est celui des éléments réels de la page (L7).
  pages.forEach((p, i) => {
    if (!("titre" in p)) return;
    const m = NOMBRE_COMPTE.exec(p.titre);
    const reels = elementsDe(p);
    if (!m || reels === undefined) return;
    const annonce = NOMBRES[m[1].toLowerCase()] ?? Number(m[1]);
    if (annonce !== reels) {
      res.push({ code: "NOMBRE_TITRE", niveau: "rouge", page: i + 1, chemin: `pages.${i}.titre`, phrase: `Page ${i + 1} : le titre annonce « ${m[1]} » mais la page compte ${reels} éléments ; écrivez le nombre réel ou retirez-le.` });
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

  // Gabarits à colonnes (ART-1, tour 2) : un mot insécable plus large que sa colonne (chasses réelles d'Inter Bold) déborderait au rendu ;
  // refusé ici, avant. Une seule alerte par champ (le budget en signes ci-dessus a pu la donner déjà).
  pages.forEach((p, i) => {
    for (const place of placesDesMots(p)) {
      const chemin = `pages.${i}.${place.chemin}`;
      if (res.some((r) => r.code === "MOT_TROP_LONG" && r.chemin === chemin)) continue;
      const { mot, largeur } = motLePlusLarge(place.texte, place.corps);
      if (largeur > place.largeur) {
        const affiche = mot.replace(/[\u00a0\u202f]/g, " ");
        res.push({ code: "MOT_TROP_LONG", niveau: "rouge", page: i + 1, chemin, phrase: `Page ${i + 1} : « ${affiche} » est trop large pour ${place.lieu} (${Math.round(largeur)} px pour ${place.largeur} px de place) ; choisissez un mot plus court ou des lettres moins larges.` });
      }
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
