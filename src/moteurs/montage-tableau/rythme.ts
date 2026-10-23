/**
 * RÉPARATION AUTOMATIQUE DU RYTHME (règle 16 : un événement visuel au moins toutes les 4 s). PURE et DÉTERMINISTE.
 *
 * Constat du 12/10 (essai réel n° 3) : une fiche de 10 scènes refusée au découpage pour deux trous de 4 s (scènes s04
 * et s07), alors que les événements existaient presque en nombre suffisant : ils étaient mal RÉPARTIS dans le temps
 * (ancres posées par le modèle), et Will ne pouvait pas corriger une ancre à l'écran. La règle ne change pas, ni son
 * seuil : c'est l'entrée qui est réparée, à la lecture de la réponse du découpage et à l'enregistrement d'une
 * correction à la main (même endroit que `normaliserEcrans`). Pour chaque scène qui porte un trou, dans l'ordre :
 *  1. les ancres de ses événements (lignes, dessins, chiffres, preuves, gestes, éléments de liste, second écran) sont
 *     redistribuées sur les mots dits, l'ordre gardé, chaque ligne au plus près du mot où ses mots sont dits, pour
 *     qu'aucun intervalle ne dépasse le seuil (3 s visées, pour garder une marge au calage sur la voix réelle ; 4 s
 *     sinon) ;
 *  2. s'il n'y a pas assez d'événements pour la durée, des gestes SÛRS sont ajoutés (« souligner », ou « entourer » une
 *     ligne déjà soulignée), sur une ligne existante, dans la limite de 6 éléments : aucun texte inventé ;
 *  3. sinon la scène est coupée en deux à une fin de phrase (10 scènes au plus), ses éléments répartis par leur ancre,
 *     sur la même page.
 * Le texte dit n'est JAMAIS retouché, ni aucun texte écrit. Une fiche qui passe déjà la règle est rendue telle quelle
 * (même objet) ; réparer une fiche réparée ne change rien (idempotent). Une entrée mal formée est rendue telle quelle :
 * la validation dira ce qui manque.
 */
import { debutsDePhrase, mots, motsPleins, racine } from "@/domaine/controles-script/texte";
import { STYLE_BLOCS_2, STYLE_REFERENCE_1, STYLE_REFERENCE_2, STYLE_REFERENCE_3, bornesFicheTableau, type EcranTableau, type ElementTableau, type FicheTableau, type SceneTableau } from "./fiche";
import { CARACTERES_PAR_SECONDE, DEBUT_DOULEUR_MS, ECART_EVENEMENT_MAX_MS, GESTES_FORTS, MARQUES_FORTES, cleSimple, motsClesDouleur, instantAncre, momentsDuStylo, tempsScenes, trousRythme, type TempsScene } from "./regles";

/** Écart visé par la réparation (marge pour le calage sur la voix réelle), puis l'écart de la règle. */
export const ECART_VISE_MS = 3_000;
const ECARTS_ESSAYES = [ECART_VISE_MS, ECART_EVENEMENT_MAX_MS] as const;
/** Réglages de la réparation : débit de la voix, racines des mots de la douleur (gardés en tête de la première scène). */
interface Reglages {
  debit: number;
  douleur: ReadonlySet<string>;
}

/** Tours de réparation au plus (une scène réparée par tour). */
const TOURS_MAX = 30;

/* ------------------------------------------------------------------ */
/* Où une ligne est dite                                                 */
/* ------------------------------------------------------------------ */

/** Racines des mots pleins de chaque mot dit (un mot à trait d'union ou apostrophe en donne plusieurs). */
const racinesDits = (motsScene: readonly string[]) => motsScene.map((m) => new Set(motsPleins(m).map(racine)));

/**
 * Index du mot dit où commencent les mots d'une ligne écrite (le plus de mots pleins de la ligne dits ensemble, le plus
 * tôt) ; `undefined` si la ligne n'est pas reconnue dans ce qui est dit (deux mots pleins au moins, un seul pour une
 * ligne d'un seul mot plein).
 */
export function ancreParlee(motsScene: readonly string[], texteLigne: string): number | undefined {
  const cles = [...new Set(motsPleins(texteLigne).map(racine))];
  if (!cles.length) return undefined;
  const dits = racinesDits(motsScene);
  const portee = Math.max(4, cles.length * 3);
  let meilleur: number | undefined;
  let score = 0;
  dits.forEach((r, j) => {
    if (!cles.some((c) => r.has(c))) return;
    const vus = new Set(cles.filter((c) => dits.slice(j, j + portee).some((x) => x.has(c))));
    if (vus.size > score) {
      score = vus.size;
      meilleur = j;
    }
  });
  return score >= Math.min(2, cles.length) ? meilleur : undefined;
}

/* ------------------------------------------------------------------ */
/* Événements d'une scène                                                */
/* ------------------------------------------------------------------ */

type Mobile = { quoi: "element"; index: number } | { quoi: "ecran"; k: number } | { quoi: "item"; k: number; i: number };

interface Evenement {
  mobile: Mobile;
  /** Nature, pour le poids de l'écart et l'ordre à ancre égale. */
  type: ElementTableau["type"] | "ecran" | "item";
  ancre: number;
  ideal: number;
  /** Ancre la plus petite permise (second écran : 1). */
  min: number;
  /** Rang de l'événement dont celui-ci dépend (geste après sa cible, élément de liste après son écran). */
  apres?: number;
  rang: number;
}

/** Styles où chaque ligne écrite est un événement visuel (« blocs/2 » : elle entre ; « reference/1 » : le crayon l'écrit). */
const estV2 = (fiche: FicheTableau) => fiche.habillage === STYLE_BLOCS_2 || fiche.habillage === STYLE_REFERENCE_1 || fiche.habillage === STYLE_REFERENCE_2 || fiche.habillage === STYLE_REFERENCE_3;
const aUneAncre = (e: ElementTableau): e is Exclude<ElementTableau, { type: "mention" }> => e.type !== "mention";

/** Les événements DÉPLAÇABLES de la scène `i` (la première scène garde ce qui part avant 3 s : douleur et accroche). */
function evenementsMobiles(fiche: FicheTableau, i: number, t: TempsScene, o: Reglages): Evenement[] {
  const s = fiche.scenes[i];
  const v2 = estV2(fiche);
  // Première scène : ce qui porte l'accroche et la douleur dans les 3 premières secondes reste où il est (accroche au
  // premier mot, ligne qui écrit un mot de la douleur, geste ou marque forte) ; le reste se répartit comme ailleurs.
  const tot = (ancre: number) => i === 0 && instantAncre(t, ancre) < DEBUT_DOULEUR_MS;
  const bloque = (ancre: number) => i === 0 && ancre === 0;
  const fixe = (e: Exclude<ElementTableau, { type: "mention" }>) =>
    bloque(e.ancre) ||
    (tot(e.ancre) &&
      ((e.type === "ligne" && ((!!e.marque && MARQUES_FORTES.includes(e.marque)) || motsPleins(e.texte).some((m) => o.douleur.has(racine(m))))) ||
        (e.type === "geste" && GESTES_FORTS.includes(e.geste))));
  const evs: Omit<Evenement, "rang">[] = [];
  const idealElement = (e: ElementTableau): number => (e.type === "ligne" ? (ancreParlee(t.mots, e.texte) ?? e.ancre) : aUneAncre(e) ? e.ancre : 0);
  const indexElement = new Map<string, number>();
  s.elements.forEach((e, index) => {
    if (!aUneAncre(e) || fixe(e)) return;
    if (!(v2 || e.type !== "ligne" || !!e.marque)) return;
    indexElement.set(e.id, evs.length);
    evs.push({ mobile: { quoi: "element", index }, type: e.type, ancre: e.ancre, ideal: idealElement(e), min: 0 });
  });
  // Un geste suit sa cible : jamais avant le mot où elle est écrite.
  s.elements.forEach((e) => {
    if (e.type !== "geste") return;
    const j = indexElement.get(e.id);
    if (j === undefined) return;
    const cible = s.elements.find((x) => x.id === e.cibleId);
    if (!cible) return;
    const c = indexElement.get(cible.id);
    if (c !== undefined) evs[j].apres = c;
    else evs[j].min = Math.max(evs[j].min, aUneAncre(cible) ? cible.ancre : 0);
    evs[j].ideal = Math.max(evs[j].ideal, aUneAncre(cible) ? idealElement(cible) : 0);
  });
  (s.ecrans ?? []).forEach((ec, k) => {
    let ecranRang: number | undefined;
    if (k > 0 && !bloque(ec.ancre ?? 0)) {
      ecranRang = evs.length;
      evs.push({ mobile: { quoi: "ecran", k }, type: "ecran", ancre: ec.ancre ?? 1, ideal: ec.ancre ?? 1, min: 1 });
    }
    (ec.liste ?? []).forEach((it, n) => {
      if (bloque(it.ancre)) return;
      evs.push({ mobile: { quoi: "item", k, i: n }, type: "item", ancre: it.ancre, ideal: it.ancre, min: 0, ...(ecranRang !== undefined ? { apres: ecranRang } : {}) });
    });
  });
  // L'ordre gardé : celui des ancres posées. À ancre égale, le dessin (ou l'écran) avant la ligne, le geste après sa
  // cible ; puis l'ordre de la fiche. Les dépendances suivent les rangs.
  const rangType = (e: Omit<Evenement, "rang">) => (e.type === "geste" ? 2 : e.type === "ligne" || e.type === "item" ? 1 : 0);
  const ordre = evs.map((e, j) => ({ e, j })).sort((a, b) => a.e.ancre - b.e.ancre || rangType(a.e) - rangType(b.e) || a.j - b.j);
  const rangDe = new Map(ordre.map((x, r) => [x.j, r]));
  return ordre.map(({ e }, r) => ({ ...e, rang: r, ...(e.apres !== undefined ? { apres: rangDe.get(e.apres) } : {}) }));
}

/** La scène `i` privée de ses événements déplaçables (pour lire les événements fixes autour d'elle). */
function sansMobiles(fiche: FicheTableau, i: number, evs: readonly Evenement[]): FicheTableau {
  const s = fiche.scenes[i];
  const elements = new Set(evs.flatMap((e) => (e.mobile.quoi === "element" ? [e.mobile.index] : [])));
  const ecrans = new Set(evs.flatMap((e) => (e.mobile.quoi === "ecran" ? [e.mobile.k] : [])));
  const items = new Set(evs.flatMap((e) => (e.mobile.quoi === "item" ? [`${e.mobile.k}:${e.mobile.i}`] : [])));
  const scene: SceneTableau = {
    ...s,
    elements: s.elements.filter((_, j) => !elements.has(j)),
    ...(s.ecrans ? { ecrans: s.ecrans.filter((_, k) => !ecrans.has(k)).map((ec) => ({ ...ec, liste: ec.liste?.filter((_, n) => !items.has(`${s.ecrans!.indexOf(ec)}:${n}`)) })) } : {}),
  };
  return { ...fiche, scenes: fiche.scenes.map((x, j) => (j === i ? scene : x)) };
}

/* ------------------------------------------------------------------ */
/* 1. Redistribuer les ancres                                            */
/* ------------------------------------------------------------------ */

/** Poids d'un écart à l'idéal : une ligne loin de ses mots se voit plus qu'un dessin ou un geste déplacé. */
const poids = (e: Evenement) => (e.type === "ligne" ? 3 : e.type === "item" || e.type === "ecran" ? 2 : 1);

/**
 * Ancres des événements (dans l'ordre des rangs, gardé) telles qu'aucun intervalle ne dépasse `ecart`, entre `avant`
 * (dernier événement fixe avant) et `apres` (premier événement fixe après, ou la fin) ; la somme des écarts à l'idéal,
 * pondérée, est la plus petite possible (programmation dynamique, à égalité l'ancre la plus tôt). `null` : impossible
 * avec ces événements. L'ordre gardé tient aussi les dépendances (un geste après sa cible, placée avant lui).
 */
function placer(t: TempsScene, evs: readonly Evenement[], avant: number, apres: number, ecart: number): number[] | null {
  const n = t.mots.length;
  const k = evs.length;
  const g = ecart - 1;
  if (!k) return apres - avant <= g ? [] : null;
  if (!n) return null;
  const T = Array.from({ length: n }, (_, a) => instantAncre(t, a));
  const cout: number[][] = [];
  const venu: number[][] = [];
  for (let j = 0; j < k; j++) {
    const e = evs[j];
    cout.push(new Array<number>(n).fill(Infinity));
    venu.push(new Array<number>(n).fill(-1));
    for (let a = e.min; a < n; a++) {
      const propre = poids(e) * Math.abs(a - e.ideal);
      if (j === 0) {
        if (T[a] - avant <= g) cout[0][a] = propre;
        continue;
      }
      for (let b = 0; b <= a; b++) {
        if (cout[j - 1][b] === Infinity || T[a] - Math.max(avant, T[b]) > g) continue;
        const c = cout[j - 1][b] + propre;
        if (c < cout[j][a]) {
          cout[j][a] = c;
          venu[j][a] = b;
        }
      }
    }
  }
  let fin = -1;
  for (let a = 0; a < n; a++) if (cout[k - 1][a] < Infinity && apres - Math.max(avant, T[a]) <= g && (fin < 0 || cout[k - 1][a] < cout[k - 1][fin])) fin = a;
  if (fin < 0) return null;
  const ancres = new Array<number>(k);
  ancres[k - 1] = fin;
  for (let j = k - 1; j > 0; j--) ancres[j - 1] = venu[j][ancres[j]];
  return ancres;
}

/** La scène avec les ancres données (dans l'ordre des rangs de `evs`). */
function avecAncres(s: SceneTableau, evs: readonly Evenement[], ancres: readonly number[]): SceneTableau {
  const parElement = new Map<number, number>();
  const parEcran = new Map<number, number>();
  const parItem = new Map<string, number>();
  evs.forEach((e, j) => {
    if (e.mobile.quoi === "element") parElement.set(e.mobile.index, ancres[j]);
    else if (e.mobile.quoi === "ecran") parEcran.set(e.mobile.k, ancres[j]);
    else parItem.set(`${e.mobile.k}:${e.mobile.i}`, ancres[j]);
  });
  return {
    ...s,
    elements: s.elements.map((e, j) => (parElement.has(j) && aUneAncre(e) ? { ...e, ancre: parElement.get(j)! } : e)),
    ...(s.ecrans
      ? {
          ecrans: s.ecrans.map((ec, k) => ({
            ...ec,
            ...(parEcran.has(k) ? { ancre: parEcran.get(k)! } : {}),
            ...(ec.liste ? { liste: ec.liste.map((it, n) => (parItem.has(`${k}:${n}`) ? { ...it, ancre: parItem.get(`${k}:${n}`)! } : it)) } : {}),
          })),
        }
      : {}),
  };
}

/** Bornes fixes autour de la scène `i` : dernier événement fixe avant sa fin, premier après (ou la fin de la vidéo). */
function bornes(fiche: FicheTableau, i: number, evs: readonly Evenement[], o: Reglages): { avant: number; apres: number } {
  const t = tempsScenes(fiche, o.debit)[i];
  const { moments, finMs } = momentsDuStylo(sansMobiles(fiche, i, evs), o.debit);
  const fixes = moments.filter((m) => m.evenement).map((m) => m.ms);
  const avant = Math.max(0, ...fixes.filter((ms) => ms < t.finMs));
  const apres = Math.min(finMs, ...fixes.filter((ms) => ms >= t.finMs));
  return { avant, apres };
}

/** Redistribue les ancres de la scène `i` ; `null` si ses événements n'y suffisent pas. */
function redistribuer(fiche: FicheTableau, i: number, o: Reglages): FicheTableau | null {
  const t = tempsScenes(fiche, o.debit)[i];
  const evs = evenementsMobiles(fiche, i, t, o);
  const { avant, apres } = bornes(fiche, i, evs, o);
  // D'abord jusqu'au prochain événement fixe ; sinon jusqu'à la fin de la scène seulement (un silence qui court sur la
  // scène suivante y sera réparé à son tour).
  for (const jusqua of apres > t.finMs ? [apres, t.finMs] : [apres]) {
    for (const ecart of ECARTS_ESSAYES) {
      const ancres = placer(t, evs, avant, jusqua, ecart);
      if (ancres) return remplacerScene(fiche, i, avecAncres(fiche.scenes[i], evs, ancres));
    }
  }
  return null;
}

const remplacerScene = (fiche: FicheTableau, i: number, s: SceneTableau): FicheTableau => ({ ...fiche, scenes: fiche.scenes.map((x, j) => (j === i ? s : x)) });

/* ------------------------------------------------------------------ */
/* 2. Ajouter des gestes sûrs                                            */
/* ------------------------------------------------------------------ */

/** Un identifiant d'élément libre dans la fiche, dérivé de la scène (« s04g1 », « s04g2 »…). */
function idLibre(fiche: FicheTableau, sceneId: string): string {
  const pris = new Set(fiche.scenes.flatMap((s) => s.elements.map((e) => e.id)));
  let n = 1;
  while (pris.has(`${sceneId}g${n}`)) n++;
  return `${sceneId}g${n}`;
}

/**
 * Ajoute à la scène `i` UN geste sûr au milieu de son plus long silence : « souligner » la dernière ligne déjà écrite
 * (« entourer » si elle est déjà soulignée). `null` : scène pleine (6 éléments) ou sans ligne.
 */
function ajouterGeste(fiche: FicheTableau, i: number, o: Reglages): FicheTableau | null {
  const s = fiche.scenes[i];
  if (s.elements.length >= bornesFicheTableau(fiche).elementsMax) return null;
  const t = tempsScenes(fiche, o.debit)[i];
  const n = t.mots.length;
  const lignes = s.elements.filter((e): e is Extract<ElementTableau, { type: "ligne" }> => e.type === "ligne");
  if (!lignes.length || n < 2) return null;
  const evs = evenementsMobiles(fiche, i, t, o);
  const { avant, apres } = bornes(fiche, i, evs, o);
  const points = [avant, ...evs.map((e) => instantAncre(t, e.ideal)), apres].sort((a, b) => a - b);
  let milieu = (avant + apres) / 2;
  let plusLong = -1;
  for (let j = 1; j < points.length; j++) {
    if (points[j] - points[j - 1] > plusLong) {
      plusLong = points[j] - points[j - 1];
      milieu = (points[j] + points[j - 1]) / 2;
    }
  }
  let ancre = 0;
  for (let a = 0; a < n; a++) if (instantAncre(t, a) <= milieu) ancre = a;
  const cible = [...lignes].reverse().find((l) => l.ancre <= ancre) ?? lignes[0];
  const geste: ElementTableau = { id: idLibre(fiche, s.id), type: "geste", geste: cible.marque === "souligne" ? "entourer" : "souligner", cibleId: cible.id, ancre: Math.max(ancre, cible.ancre) };
  return remplacerScene(fiche, i, { ...s, elements: [...s.elements, geste] });
}

/**
 * Style « page écrite » : une ligne sans marque n'est pas un événement, mais un geste ne peut viser qu'une ligne déjà
 * écrite. Avant d'ajouter des gestes, chaque ligne de la scène est remise au mot où ses mots sont dits (s'il est
 * reconnu ; la première scène garde ses 3 premières secondes).
 */
function lignesAuxMots(fiche: FicheTableau, i: number, o: Reglages): FicheTableau {
  if (estV2(fiche)) return fiche;
  const t = tempsScenes(fiche, o.debit)[i];
  const s = fiche.scenes[i];
  let change = false;
  const elements = s.elements.map((e) => {
    if (e.type !== "ligne" || e.marque || (i === 0 && instantAncre(t, e.ancre) < DEBUT_DOULEUR_MS)) return e;
    const ancre = ancreParlee(t.mots, e.texte);
    if (ancre === undefined || ancre === e.ancre) return e;
    change = true;
    return { ...e, ancre };
  });
  return change ? remplacerScene(fiche, i, { ...s, elements }) : fiche;
}

/** Redistribue, en ajoutant des gestes sûrs tant qu'il le faut et qu'il y a de la place. */
function redistribuerAvecGestes(fiche: FicheTableau, i: number, o: Reglages): FicheTableau | null {
  let f = lignesAuxMots(fiche, i, o);
  for (;;) {
    const r = redistribuer(f, i, o);
    if (r) return r;
    const g = ajouterGeste(f, i, o);
    if (!g) return null;
    f = g;
  }
}

/* ------------------------------------------------------------------ */
/* 3. Couper une scène en deux à une fin de phrase                       */
/* ------------------------------------------------------------------ */

/** Les mots forts et le mot du commentaire d'un écran, gardés seulement s'ils sont écrits dans une ligne de la scène. */
function ecranPour(ec: EcranTableau, elements: readonly ElementTableau[]): EcranTableau {
  const ecrits = new Set(elements.flatMap((e) => (e.type === "ligne" ? e.texte.split(/\s+/).map(cleSimple) : [])));
  const { motsForts, motCommentaire, liste, ...reste } = ec;
  const forts = (motsForts ?? []).filter((m) => ecrits.has(cleSimple(m)));
  return {
    ...reste,
    ...(forts.length ? { motsForts: forts } : {}),
    ...(motCommentaire && ecrits.has(cleSimple(motCommentaire)) ? { motCommentaire } : {}),
    ...(liste?.length ? { liste } : {}),
  };
}

/** Identifiants des scènes remis dans l'ordre (« s01 »…). */
const renumeroter = (scenes: SceneTableau[]): SceneTableau[] => scenes.map((s, j) => ({ ...s, id: `s${String(j + 1).padStart(2, "0")}` }));

/**
 * Coupe la scène `i` en deux juste avant le mot `coupe` (un début de phrase, `debutsDePhrase`) : le texte dit est
 * partagé entre les deux (rien d'ajouté ni de retiré) ; chaque élément va à la moitié où il est dit (une ligne : où ses
 * mots sont dits ; sinon son ancre), un geste suit sa cible, la mention reste dans la première ; une moitié sans
 * élément reçoit le dernier (ou le premier) de l'autre. Même page, sinon (`nouvellePage`) la seconde moitié tourne la
 * page. Les écrans et leurs listes suivent leurs ancres (la seconde moitié reprend le moment et le gabarit de l'écran
 * en cours). Identifiants des scènes renumérotés. `null` : coupe impossible (10 scènes déjà, scène calée ou d'appel,
 * coupe hors d'un début de phrase, plus de page libre).
 */
export function couperScene(fiche: FicheTableau, i: number, coupe: number, options: { nouvellePage?: boolean } = {}): FicheTableau | null {
  const s = fiche.scenes[i];
  const bornesFiche = bornesFicheTableau(fiche);
  if (!s || fiche.scenes.length >= bornesFiche.scenesMax || s.debutMs !== undefined || s.finMs !== undefined) return null;
  if ((s.ecrans ?? []).some((e) => e.moment === "appel")) return null;
  if (!debutsDePhrase(s.texteDit).includes(coupe)) return null;
  if (options.nouvellePage && Math.max(...fiche.scenes.map((x) => x.page)) >= bornesFiche.pageMax) return null;
  // Le texte dit coupé au morceau du mot `coupe` (même découpe que l'ancre : les morceaux sans lettre ne comptent pas).
  const morceaux = s.texteDit.split(/\s+/).filter(Boolean);
  let rangMorceau = 0;
  for (let m = 0, n = 0; m < morceaux.length; m++) {
    if (!/[\p{L}\p{N}]/u.test(morceaux[m])) continue;
    if (n === coupe) {
      rangMorceau = m;
      break;
    }
    n++;
  }
  const texteA = morceaux.slice(0, rangMorceau).join(" ");
  const texteB = morceaux.slice(rangMorceau).join(" ");
  const nA = mots(texteA).length;
  const nB = mots(texteB).length;
  if (!nA || !nB) return null;

  const motsScene = mots(s.texteDit);
  const dit = (e: ElementTableau) => (e.type === "ligne" ? (ancreParlee(motsScene, e.texte) ?? e.ancre) : aUneAncre(e) ? e.ancre : 0);
  const cote = new Map<string, "A" | "B">();
  for (const e of s.elements) cote.set(e.id, e.type === "mention" || dit(e) < coupe ? "A" : "B");
  // Une moitié vide reçoit l'élément le plus proche de la coupe (ni geste ni mention : ses gestes le suivent).
  const porteurs = s.elements.filter((e) => e.type !== "geste" && e.type !== "mention");
  const deCote = (c: "A" | "B") => porteurs.filter((e) => cote.get(e.id) === c);
  if (!deCote("B").length && deCote("A").length > 1) cote.set([...deCote("A")].sort((x, y) => dit(y) - dit(x))[0].id, "B");
  if (!deCote("A").length && deCote("B").length > 1) cote.set([...deCote("B")].sort((x, y) => dit(x) - dit(y))[0].id, "A");
  for (const e of s.elements) if (e.type === "geste" && cote.has(e.cibleId)) cote.set(e.id, cote.get(e.cibleId)!);
  const pose = (e: ElementTableau, c: "A" | "B"): ElementTableau => {
    if (!aUneAncre(e)) return e;
    return { ...e, ancre: c === "A" ? Math.min(e.ancre, nA - 1) : Math.min(nB - 1, Math.max(0, Math.max(e.ancre, dit(e)) - coupe)) };
  };
  const elementsA = s.elements.filter((e) => cote.get(e.id) === "A").map((e) => pose(e, "A"));
  const elementsB = s.elements.filter((e) => cote.get(e.id) === "B").map((e) => pose(e, "B"));
  if (!elementsA.length || !elementsB.length) return null;

  // Style « reference/2 » : le numéro d'étape suit le mot où il est dit (la moitié qui ne le dit pas n'en a pas).
  // Style « reference/3 » (peps) : le visuel et le bloc orange aussi (le visuel sans mot suit la dernière ligne dite).
  const gabaritDe = (c: "A" | "B") => {
    const g = s.gabarit;
    if (!g) return undefined;
    const { numero, visuel, bloc, ...reste } = g;
    if (!numero && !visuel && !bloc) return g;
    const ici = (a: number) => (a < coupe) === (c === "A");
    const decale = (a: number) => (c === "A" ? a : a - coupe);
    const aVisuel = visuel ? (visuel.ancre ?? Math.max(0, ...s.elements.map((e) => (e.type === "ligne" ? dit(e) : 0)))) : 0;
    const aBloc = bloc?.ancre ?? 0;
    return {
      ...reste,
      ...(numero && ici(numero.ancre) ? { numero: { ...numero, ancre: decale(numero.ancre) } } : {}),
      ...(visuel && ici(aVisuel) ? { visuel: visuel.ancre === undefined ? visuel : { ...visuel, ancre: decale(aVisuel) } } : {}),
      ...(bloc && ici(aBloc) ? { bloc: bloc.ancre === undefined ? bloc : { ...bloc, ancre: decale(aBloc) } } : {}),
    };
  };
  const scene = (texteDit: string, elements: ElementTableau[], ecrans?: EcranTableau[], c: "A" | "B" = "A"): SceneTableau => {
    const { ecrans: _e, gabarit: _g, ...reste } = s;
    void _e;
    void _g;
    const gabarit = gabaritDe(c);
    return { ...reste, texteDit, elements, ...(ecrans ? { ecrans } : {}), ...(gabarit ? { gabarit } : {}) };
  };
  let ecransA: EcranTableau[] | undefined;
  let ecransB: EcranTableau[] | undefined;
  if (s.ecrans?.length) {
    const orphelins = s.ecrans.filter((e) => (e.ancre ?? 0) < coupe).flatMap((e) => (e.liste ?? []).filter((it) => it.ancre >= coupe));
    ecransA = s.ecrans.filter((e) => (e.ancre ?? 0) < coupe).map((e) => ecranPour({ ...e, liste: e.liste?.filter((it) => it.ancre < coupe) }, elementsA));
    const suite = s.ecrans.filter((e) => (e.ancre ?? 0) >= coupe);
    const enCours = ecransA.at(-1)!;
    const premierB: EcranTableau = suite[0] ?? { moment: enCours.moment, ...(enCours.gabarit ? { gabarit: enCours.gabarit } : {}), ...(enCours.etiquette ? { etiquette: enCours.etiquette } : {}), ...(enCours.etape ? { etape: enCours.etape } : {}), ...(enCours.motsForts ? { motsForts: enCours.motsForts } : {}) };
    const rebase = (it: { texte: string; detail?: string; ancre: number }) => ({ ...it, ancre: it.ancre - coupe });
    ecransB = [premierB, ...suite.slice(suite[0] ? 1 : 0)].map((e, k) => {
      const { ancre, ...reste } = e;
      const liste = [...(k === 0 ? orphelins : []), ...(e.liste ?? [])].map(rebase);
      return ecranPour({ ...reste, ...(k > 0 && ancre !== undefined ? { ancre: ancre - coupe } : {}), ...(liste.length ? { liste } : {}) }, elementsB);
    });
    if (ecransB.some((e) => (e.liste?.length ?? 0) > 6)) return null;
  }
  const tourne = options.nouvellePage ? 1 : 0;
  const sceneB = { ...scene(texteB, elementsB, ecransB, "B"), page: s.page + tourne };
  const scenes = [...fiche.scenes.slice(0, i), scene(texteA, elementsA, ecransA), sceneB, ...fiche.scenes.slice(i + 1).map((x) => ({ ...x, page: x.page + tourne }))];
  return { ...fiche, scenes: renumeroter(scenes) };
}

/** Débuts de phrase de la scène, du plus proche du milieu au plus loin. */
function coupesCandidates(s: SceneTableau): number[] {
  const n = mots(s.texteDit).length;
  return debutsDePhrase(s.texteDit).sort((a, b) => Math.abs(a - n / 2) - Math.abs(b - n / 2) || a - b);
}

/* ------------------------------------------------------------------ */
/* Réparation de la fiche                                                */
/* ------------------------------------------------------------------ */

/** Mesure du défaut : nombre de trous, puis dépassement cumulé (ms). */
function mesure(fiche: FicheTableau, o: Reglages): [number, number] {
  const trous = trousRythme(fiche, o.debit);
  return [trous.length, trous.reduce((t, x) => t + (x.aMs - x.deMs - ECART_EVENEMENT_MAX_MS), 0)];
}
const meilleure = (a: [number, number], b: [number, number]) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1] - 1);

/** Une réparation de la scène `i` qui réduit le défaut, dans l'ordre : redistribuer, ajouter des gestes, couper. */
function reparerScene(fiche: FicheTableau, i: number, o: Reglages): FicheTableau | null {
  const avant = mesure(fiche, o);
  const essai = (f: FicheTableau | null) => (f && meilleure(mesure(f, o), avant) ? f : null);
  const r = essai(redistribuer(fiche, i, o)) ?? essai(redistribuerAvecGestes(fiche, i, o));
  if (r) return r;
  // Couper : même page d'abord, sinon une page tournée (un événement de plus au style « page écrite »).
  for (const nouvellePage of [false, true]) {
    for (const coupe of coupesCandidates(fiche.scenes[i])) {
      const c = couperScene(fiche, i, coupe, { nouvellePage });
      if (!c) continue;
      const a = redistribuerAvecGestes(c, i, o) ?? c;
      const b = redistribuerAvecGestes(a, i + 1, o) ?? a;
      const ok = essai(b);
      if (ok) return ok;
    }
  }
  return null;
}

/** Ce que la réparation lit en plus de la fiche : le débit des règles, les mots de la douleur (`motsDouleur`). */
export interface ReglagesRythme {
  debit?: number;
  motsDouleur?: readonly string[];
}

/** La fiche (forme lisible) réparée ; elle-même si rien n'est à réparer ou si rien ne réduit le défaut. */
export function reparerRythmeFiche(fiche: FicheTableau, reglages: ReglagesRythme = {}): FicheTableau {
  const o: Reglages = {
    debit: reglages.debit ?? CARACTERES_PAR_SECONDE,
    douleur: new Set([...motsClesDouleur(typeof fiche.douleur === "string" ? fiche.douleur : ""), ...(reglages.motsDouleur ?? []).flatMap((m) => motsPleins(m).map(racine))]),
  };
  let f = fiche;
  for (let tour = 0; tour < TOURS_MAX; tour++) {
    const trous = trousRythme(f, o.debit);
    if (!trous.length) return f;
    // La scène du trou d'abord, puis toutes celles qu'il traverse (un silence peut courir d'une scène à l'autre).
    const ts = tempsScenes(f, o.debit);
    const scenes = [...new Set(trous.flatMap((t) => [t.sceneId, ...ts.filter((x) => x.finMs > t.deMs && x.debutMs < t.aMs).map((x) => x.scene.id)]))];
    let suite: FicheTableau | null = null;
    for (const id of scenes) {
      const i = f.scenes.findIndex((s) => s.id === id);
      if (i < 0) continue;
      suite = reparerScene(f, i, o);
      if (suite) break;
    }
    if (!suite) return f;
    f = suite;
  }
  return f;
}

const estObjet = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);

/** Assez bien formée pour lire ses temps (sinon la validation dira ce qui manque, rien n'est touché). */
function formeLisible(brute: unknown): brute is FicheTableau {
  if (!estObjet(brute) || !Array.isArray(brute.scenes) || !brute.scenes.length) return false;
  return brute.scenes.every(
    (s) =>
      estObjet(s) &&
      typeof s.id === "string" &&
      typeof s.texteDit === "string" &&
      Array.isArray(s.elements) &&
      s.elements.every((e) => estObjet(e) && typeof e.id === "string" && typeof e.type === "string" && (e.type === "mention" || Number.isInteger(e.ancre)) && (e.type !== "ligne" || typeof e.texte === "string")) &&
      (s.ecrans === undefined || (Array.isArray(s.ecrans) && s.ecrans.every((ec) => estObjet(ec) && (ec.liste === undefined || (Array.isArray(ec.liste) && ec.liste.every((it) => estObjet(it) && Number.isInteger(it.ancre))))))),
  );
}

/**
 * Réparation du rythme d'une fiche BRUTE (réponse du découpage, ou fiche corrigée à la main) : rendue telle quelle si
 * elle n'est pas lisible, si elle passe déjà la règle, ou si rien ne la répare. Ne lève jamais.
 */
export function reparerRythme<T>(brute: T, reglages: ReglagesRythme = {}): T {
  if (!formeLisible(brute)) return brute;
  try {
    return reparerRythmeFiche(brute, reglages) as T;
  } catch {
    return brute;
  }
}
