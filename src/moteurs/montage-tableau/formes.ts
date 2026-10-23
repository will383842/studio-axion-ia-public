/**
 * RÉPARATION DES FORMES DE LA FICHE DU TABLEAU ANIMÉ (règle « références internes » et contrôles de forme). PURE et
 * DÉTERMINISTE, sur une fiche BRUTE (réponse du découpage, ou fiche corrigée à la main).
 *
 * Constat du 12/10 (essai réel n° 4) : une fiche refusée pour UN motif, « l'élément « e38 » part du mot 30, mais le
 * texte dit n'a que 27 mots » ; à l'écran, « Corriger » puis « Enregistrer » ne pouvait rien y faire (une ancre ne se
 * corrige pas à la main) et il fallait repayer un découpage. Les règles ne changent pas : c'est l'entrée qui est
 * réparée, quand la réparation est SÛRE (aucun texte inventé, aucun chiffre, le sens gardé), AVANT la réparation du
 * rythme (`rythme.ts`, qui répartit ensuite les ancres). Ce qui est réparé :
 *  - identifiants de scène : renumérotés dans l'ordre (« s01 »…), l'ordre des scènes n'est jamais changé ;
 *  - pages : un nombre non entier est arrondi ; la suite est remise en ordre (première page 1, puis la même page ou la
 *    suivante, 6 au plus) en changeant le moins de pages possible ; une suite déjà juste est gardée ;
 *  - identifiants d'élément en double ou mal formés : renumérotés (« s04r1 »…) ; un geste de la même scène qui visait
 *    l'ancien identifiant suit l'élément renommé ;
 *  - ancres (éléments, écrans, éléments de liste) : ramenées dans [0, nombre de mots dits − 1] ; non entière : arrondie ;
 *    négative : 0 ; absente là où elle est obligatoire : une valeur sûre (une ligne : le mot où ses mots sont dits ; un
 *    geste : l'ancre de sa cible ; un élément de liste : celle de son écran ; sinon celle de l'élément qui précède) ;
 *    une mention n'a pas d'ancre (retirée) ; le premier écran part avec la scène (ancre retirée), le second après lui ;
 *  - geste qui vise un élément absent de la scène (ou un geste, ou lui-même) : rattaché à la ligne la plus proche de la
 *    scène (la dernière déjà écrite à son ancre, sinon la première) ; un geste « barrer » est RETIRÉ (barrer une autre
 *    ligne changerait le sens), sauf s'il est le seul élément de la scène ;
 *  - listes vides (`ecrans`, `liste`) : retirées (un champ absent n'est jamais un refus).
 * Ce qui reste refusé (il faudrait inventer ou trancher) : mot du commentaire absent des lignes, étape `n` plus grande
 * que le total, champ inconnu, nombre de scènes ou d'éléments hors bornes, plus de 2 écrans ou de 6 éléments de liste,
 * textes trop longs ou vides, valeurs hors des listes permises, horaires de scène, texte dit vide.
 *
 * Une fiche qui n'a rien à réparer est rendue telle quelle (même objet) ; réparer une fiche réparée ne change rien
 * (idempotent). Une entrée illisible est rendue telle quelle : la validation dira ce qui manque. Ne lève jamais.
 */
import { BORNES_FICHE, idSceneAttendu } from "@/briques/fiche-scenes";
import { mots } from "@/domaine/controles-script/texte";
import { ancreParlee } from "./rythme";
import { bornesFicheTableau } from "./gabarit";

type Objet = Record<string, unknown>;
const estObjet = (x: unknown): x is Objet => !!x && typeof x === "object" && !Array.isArray(x);

/** Même forme que `identifiantSur` (fiche commune). */
const ID_SUR = /^[A-Za-z0-9_-]{1,120}$/;

/** Nombre lu (un nombre fini, ou un texte qui en écrit un) ; `undefined` sinon. */
function nombreLu(x: unknown): number | undefined {
  if (typeof x === "number") return Number.isFinite(x) ? x : undefined;
  if (typeof x === "string" && x.trim() && Number.isFinite(Number(x))) return Number(x);
  return undefined;
}

/** Ancre ramenée dans [0, n − 1] (entière) ; `secours` si elle n'est pas lisible. */
const borner = (x: unknown, n: number, secours: number) => {
  const v = nombreLu(x);
  return Math.min(Math.max(0, n - 1), Math.max(0, Math.round(v ?? secours)));
};

/**
 * Pages remises en ordre : 1 d'abord, puis la même ou la suivante (6 au plus), en changeant le MOINS de pages possible
 * (à égalité, les plus proches de celles posées ; puis la plus petite). Une suite déjà juste est rendue telle quelle.
 * `null` : une page illisible.
 */
function pagesEnOrdre(brutes: readonly unknown[], pageMax: number = BORNES_FICHE.pageMax): number[] | null {
  const lues = brutes.map(nombreLu);
  if (lues.some((p) => p === undefined)) return null;
  const voulues = lues.map((p) => Math.round(p!));
  const { pageMin } = BORNES_FICHE;
  // cout[i][p] : [pages changées, écart total] pour finir la scène i sur la page p ; venu : page de la scène i − 1.
  const cout: [number, number][][] = [];
  const venu: number[][] = [];
  voulues.forEach((v, i) => {
    cout.push([]);
    venu.push([]);
    for (let p = pageMin; p <= pageMax; p++) {
      const propre: [number, number] = [p === v ? 0 : 1, Math.abs(p - v)];
      if (i === 0) {
        if (p === pageMin) cout[0][p] = propre;
        continue;
      }
      for (const q of [p, p - 1]) {
        const avant = cout[i - 1][q];
        if (!avant) continue;
        const c: [number, number] = [avant[0] + propre[0], avant[1] + propre[1]];
        const actuel = cout[i][p];
        if (!actuel || c[0] < actuel[0] || (c[0] === actuel[0] && c[1] < actuel[1])) {
          cout[i][p] = c;
          venu[i][p] = q;
        }
      }
    }
  });
  const dernier = voulues.length - 1;
  let fin = -1;
  for (let p = pageMin; p <= pageMax; p++) {
    const c = cout[dernier][p];
    if (c && (fin < 0 || c[0] < cout[dernier][fin][0] || (c[0] === cout[dernier][fin][0] && c[1] < cout[dernier][fin][1]))) fin = p;
  }
  const sortie = new Array<number>(voulues.length);
  sortie[dernier] = fin;
  for (let i = dernier; i > 0; i--) sortie[i - 1] = venu[i][sortie[i]];
  return sortie;
}

/** Les éléments d'une scène réparés (identifiants déjà rendus uniques). */
function reparerElements(elements: readonly unknown[], n: number, motsScene: readonly string[]): unknown[] {
  // 1. Ancres bornées (la mention n'en a pas).
  let precedente = 0;
  const bornes = elements.map((e) => {
    if (!estObjet(e) || typeof e.type !== "string") return e;
    if (e.type === "mention") {
      if (!("ancre" in e)) return e;
      const { ancre: _a, ...reste } = e;
      void _a;
      return reste;
    }
    if (!n) return e;
    let secours = precedente;
    if (e.type === "ligne" && typeof e.texte === "string") secours = ancreParlee(motsScene, e.texte) ?? precedente;
    if (e.type === "geste") {
      const cible = elements.find((x) => estObjet(x) && x.id === e.cibleId);
      const c = estObjet(cible) ? nombreLu(cible.ancre) : undefined;
      if (c !== undefined) secours = c;
    }
    const ancre = borner(e.ancre, n, secours);
    precedente = ancre;
    return ancre === e.ancre ? e : { ...e, ancre };
  });

  // 2. Gestes orphelins : rattachés à la ligne la plus proche, ou retirés (« barrer »).
  const cibleValide = (g: Objet) => bornes.some((x) => estObjet(x) && x !== g && x.id === g.cibleId && typeof x.type === "string" && x.type !== "geste");
  const lignes = bornes.filter((x): x is Objet => estObjet(x) && x.type === "ligne" && typeof x.id === "string");
  const sortie: unknown[] = [];
  for (const e of bornes) {
    if (!estObjet(e) || e.type !== "geste" || cibleValide(e)) {
      sortie.push(e);
      continue;
    }
    if (!lignes.length) {
      sortie.push(e);
      continue;
    }
    if (e.geste === "barrer") {
      if (bornes.length > BORNES_FICHE.elementsMin) continue;
      sortie.push(e);
      continue;
    }
    const a = nombreLu(e.ancre) ?? 0;
    const avant = lignes.filter((l) => (nombreLu(l.ancre) ?? 0) <= a);
    const cible = avant.length ? avant[avant.length - 1] : lignes[0];
    sortie.push({ ...e, cibleId: cible.id });
  }
  return sortie;
}

/** Les écrans d'une scène réparés ; `undefined` : champ à retirer (liste vide). */
function reparerEcrans(ecrans: readonly unknown[], n: number): unknown[] | undefined {
  if (!ecrans.length) return undefined;
  let ancrePrecedente = 0;
  return ecrans.map((ec, k) => {
    if (!estObjet(ec)) return ec;
    let sortie: Objet = ec;
    const poser = (cle: string, valeur: unknown) => {
      if (sortie[cle] === valeur) return;
      sortie = { ...sortie, [cle]: valeur };
    };
    const retirer = (cle: string) => {
      if (!(cle in sortie)) return;
      const { [cle]: _x, ...reste } = sortie;
      void _x;
      sortie = reste;
    };
    // Ancre de l'écran : le premier part avec la scène ; le second après le précédent, dans le texte dit.
    if (k === 0) {
      const v = nombreLu(ec.ancre);
      if (ec.ancre !== undefined && v !== 0) retirer("ancre");
      else if (ec.ancre !== undefined && ec.ancre !== 0) poser("ancre", 0);
    } else if (n >= 2) {
      const premierItem = Array.isArray(ec.liste) ? ec.liste.map((it) => (estObjet(it) ? nombreLu(it.ancre) : undefined)).find((x) => x !== undefined) : undefined;
      const lue = nombreLu(ec.ancre);
      let ancre = Math.min(n - 1, Math.max(0, Math.round(lue ?? premierItem ?? Math.floor(n / 2))));
      if (ancre <= ancrePrecedente) ancre = Math.min(n - 1, ancrePrecedente + 1);
      if (ancre > ancrePrecedente) poser("ancre", ancre);
    }
    const ancreEcran = k === 0 ? 0 : (nombreLu(sortie.ancre) ?? 0);
    ancrePrecedente = ancreEcran;
    // Éléments de liste : ancres bornées ; liste vide retirée.
    if (Array.isArray(ec.liste)) {
      if (!ec.liste.length) retirer("liste");
      else if (n) {
        let change = false;
        const liste = ec.liste.map((it) => {
          if (!estObjet(it)) return it;
          const ancre = borner(it.ancre, n, ancreEcran);
          if (ancre === it.ancre) return it;
          change = true;
          return { ...it, ancre };
        });
        if (change) poser("liste", liste);
      }
    }
    return sortie;
  });
}

/** Rend les identifiants d'élément uniques et bien formés dans la fiche ; les gestes de la scène suivent. */
function identifiantsUniques(scenes: readonly Objet[]): Objet[] {
  const pris = new Set<string>();
  for (const s of scenes) if (Array.isArray(s.elements)) for (const e of s.elements) if (estObjet(e) && typeof e.id === "string" && ID_SUR.test(e.id)) pris.add(e.id);
  const vus = new Set<string>();
  return scenes.map((s) => {
    if (!Array.isArray(s.elements)) return s;
    const sceneId = typeof s.id === "string" ? s.id : "s";
    const renommes = new Map<string, string>();
    const dejaDansScene = new Set<string>();
    let change = false;
    const elements = s.elements.map((e) => {
      if (!estObjet(e)) return e;
      const id = e.id;
      const bon = typeof id === "string" && ID_SUR.test(id) && !vus.has(id);
      if (bon) {
        vus.add(id as string);
        dejaDansScene.add(id as string);
        return e;
      }
      let k = 1;
      while (pris.has(`${sceneId}r${k}`)) k++;
      const neuf = `${sceneId}r${k}`;
      pris.add(neuf);
      vus.add(neuf);
      // Un geste de cette scène visait cet identifiant : s'il n'y désignait pas déjà un élément plus haut, il suit.
      if (typeof id === "string" && !dejaDansScene.has(id) && !renommes.has(id)) renommes.set(id, neuf);
      change = true;
      return { ...e, id: neuf };
    });
    if (!change) return s;
    const suivis = elements.map((e) => (estObjet(e) && e.type === "geste" && typeof e.cibleId === "string" && renommes.has(e.cibleId) && !dejaDansScene.has(e.cibleId) ? { ...e, cibleId: renommes.get(e.cibleId) } : e));
    return { ...s, elements: suivis };
  });
}

/** Égalité profonde de deux valeurs JSON. */
const memes = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Répare les formes d'une fiche BRUTE (voir l'en-tête) : rendue telle quelle (même objet) si rien n'est à réparer ou
 * si elle n'est pas lisible. Ne lève jamais.
 */
export function reparerFormes<T>(brute: T): T {
  try {
    if (!estObjet(brute) || !Array.isArray(brute.scenes) || !brute.scenes.length || !brute.scenes.every(estObjet)) return brute;
    const scenes0 = brute.scenes as Objet[];
    const pages = pagesEnOrdre(scenes0.map((s) => s.page), bornesFicheTableau({ habillage: typeof brute.habillage === "string" ? brute.habillage : "" }).pageMax);
    const numerotees = scenes0.map((s, i) => {
      let x = s;
      if (s.id !== idSceneAttendu(i)) x = { ...x, id: idSceneAttendu(i) };
      if (pages && s.page !== pages[i]) x = { ...x, page: pages[i] };
      return x;
    });
    const scenes = identifiantsUniques(numerotees).map((s) => {
      if (typeof s.texteDit !== "string") return s;
      const motsScene = mots(s.texteDit);
      const n = motsScene.length;
      let x = s;
      if (Array.isArray(s.elements)) {
        const elements = reparerElements(s.elements, n, motsScene);
        if (!memes(elements, s.elements)) x = { ...x, elements };
      }
      // Style « reference/2 » : le numéro d'une étape part d'un mot du texte dit.
      const g = s.gabarit;
      if (estObjet(g) && estObjet(g.numero) && n) {
        const ancre = borner(g.numero.ancre, n, 0);
        if (ancre !== g.numero.ancre) x = { ...x, gabarit: { ...g, numero: { ...g.numero, ancre } } };
      }
      if (Array.isArray(s.ecrans)) {
        const ecrans = reparerEcrans(s.ecrans, n);
        if (ecrans === undefined) {
          const { ecrans: _e, ...reste } = x;
          void _e;
          x = reste;
        } else if (!memes(ecrans, s.ecrans)) x = { ...x, ecrans };
      }
      return x;
    });
    return memes(scenes, scenes0) ? brute : ({ ...brute, scenes } as T);
  } catch {
    return brute;
  }
}
