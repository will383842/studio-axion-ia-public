/**
 * MISE EN PAGE DU STYLE « reference/2 » : la page écrite au crayon du style « reference/1 » (fond blanc cassé, crayon,
 * trois couleurs, Montserrat ExtraBold, un dessin), avec un GABARIT DE PAGE CLAIR (maquette
 * `maquettes/tableau-gabarit-clair/`, regard de Will du 14/10/2026 : « très clair, structuré »). Fonction PURE et
 * déterministe ; même contrat que les autres styles : mêmes pages (champ `page` des scènes), mêmes sorties (vertical,
 * portrait, carré, horizontal), mêmes heures (calage).
 *
 * Une page = une idée, toujours dans le même ordre, texte aligné à gauche :
 *  1. REPÈRE en haut à gauche : les points de progression des étapes (le courant plus gros), ou le bandeau
 *     « Exemple » ; le DESSIN de la page en haut à droite, sur une tache pâle ;
 *  2. TITRE (90 px), souligné d'un trait épais de la couleur du sens (terracotta : le problème ; vert sauge : le
 *     reste) ; sur une étape, la PASTILLE numérotée le précède (elle s'écrit au mot où la voix dit le numéro) ;
 *  3. PHRASE CLÉ (72 px) ;
 *  4. DÉTAILS (54 px), avec un filet pâle à gauche ;
 *  5. page « exemple » : AVANT (terracotta) / APRÈS (vert sauge), étiquetés, séparés d'un pointillé ;
 *  6. page « À retenir » : la liste numérotée des étapes, puis l'APPEL en grand (~70 px), en clair dans un cadre vert sauge.
 * Tailles : celles de `TAILLES_GABARIT` à l'échelle du format ; une page chargée (ou une sortie basse) est réduite d'un
 * même facteur, jamais sous `titreMin` / `phraseMin` / `detailMin` ; une page peu chargée grandit (10 % au plus), puis ses écarts
 * s'ouvrent (au plus `ecartMaxFacteur` fois) jusqu'à ce que son dernier élément descende vers `basVise` (92 %) de la
 * zone sûre : la page commence en haut et son texte couvre 85 à 90 % de la zone sûre ; une page restée courte est
 * centrée dans la zone sûre (14/10, regard de Will sur la première vraie vidéo). Sans repère ni bandeau, le dessin se
 * pose à droite du titre (un dessin seul sur sa rangée laissait le haut vide). Fin de TikTok et Shorts : leur demande
 * en grand dans le cadre vert de l'appel, l'adresse du site dessous (même poids que l'appel des Reels).
 * En horizontal (et en carré si une colonne ne suffit pas) : deux colonnes, titre et phrase clé à gauche, le reste à
 * droite. Une page trop chargée est d'abord réduite pas à pas jusqu'aux minimums lisibles (titre 70, phrase clé 56,
 * détails 44 px), une longue ligne prenant au besoin 4 rangées ; si elle ne tient toujours pas, elle est refusée en
 * nommant la page et sa dernière scène, et la réparation automatique (`densite.ts`) la fait d'abord passer à une page de
 * plus (la page neuve rappelle le même titre) : le refus ne reste qu'en dernier recours.
 */
import { largeurEcrite } from "@/briques/stylo/mesure-ecriture";
import { APPROCHE_REFERENCE, COULEURS_REFERENCE, SIGNATURE_REFERENCE, STYLE_REFERENCE_2, TAILLES_GABARIT, TAILLES_REFERENCE, TEINTES_PALES_GABARIT } from "@/briques/tableau-scene/reference/charte";
import type { DecorGabarit, MiseEnPageReference, RectDecor } from "@/briques/tableau-scene/reference/types";
import { cleMot, idNumero, type ElementLigne, type ElementTableau, type FicheTableau, type Geste, type SceneTableau } from "./fiche";
import { formatSortie, referenceFormat, zoneSureReference, type IdFormatSortie } from "./formats-sortie";
import { CONSEIL_GABARIT, estPageSuite, numeroDePage, pagesDe, rolePage, type RolePage } from "./gabarit";
import { ErreurMiseEnPage, VERSION_MISE_EN_PAGE, zoneSureTableau, type ElementPlace, type GestePlace, type LigneVisuelle, type MiseEnPageTableau, type OptionsMiseEnPage, type PagePlacee, type Rect, type RectPx } from "./mise-en-page";
import { largeurReference, unites } from "./mise-en-page-reference";

const T = TAILLES_GABARIT;
const C = COULEURS_REFERENCE;
const arrondi6 = (v: number) => Math.round(v * 1e6) / 1e6;

/* ------------------------------------------------------------------ */
/* Sortie                                                                */
/* ------------------------------------------------------------------ */

interface Sortie {
  W: number;
  H: number;
  k: number;
  format: IdFormatSortie;
  zone: RectPx;
  /** Bord gauche et droit de l'écriture, haut et bas de la place. */
  x0: number;
  x1: number;
  haut: number;
  bas: number;
}

function sortie(options: OptionsMiseEnPage): Sortie {
  const format: IdFormatSortie = options.format && options.format !== "vertical" ? options.format : "vertical";
  const f = formatSortie(format);
  const W = f.largeur;
  const H = f.hauteur;
  const k = referenceFormat(format).largeur / 1080;
  const z = format === "vertical" ? zoneSureReference("vertical", zoneSureTableau(options.reseaux)) : zoneSureReference(format);
  const x = Math.round((z.gauche / 100) * W);
  const y = Math.round((z.haut / 100) * H);
  const zone = { x, y, largeur: W - x - Math.round((z.droite / 100) * W), hauteur: H - y - Math.round((z.bas / 100) * H) };
  return { W, H, k, format, zone, x0: zone.x + Math.round(T.margeGauche * k), x1: zone.x + zone.largeur - Math.round(T.margeDroite * k), haut: zone.y + Math.round(T.margeHaut * k), bas: zone.y + zone.hauteur - Math.round(T.margeBas * k) };
}

const rect = (px: RectPx, s: Sortie): Rect => ({ px, fraction: { x: arrondi6(px.x / s.W), y: arrondi6(px.y / s.H), largeur: arrondi6(px.largeur / s.W), hauteur: arrondi6(px.hauteur / s.H) } });

const union = (rs: RectPx[]): RectPx => {
  const x = Math.floor(Math.min(...rs.map((r) => r.x)));
  const y = Math.floor(Math.min(...rs.map((r) => r.y)));
  const x2 = Math.ceil(Math.max(...rs.map((r) => r.x + r.largeur)));
  const y2 = Math.ceil(Math.max(...rs.map((r) => r.y + r.hauteur)));
  return { x, y, largeur: x2 - x, hauteur: y2 - y };
};

/** Typographie française : apostrophe courbe, espace insécable devant « : ; ! ? » » et après « « ». */
export const typographie = (t: string) => t.replace(/'/g, "’").replace(/ ([:;!?»])/g, " $1").replace(/« /g, "« ");

/* ------------------------------------------------------------------ */
/* Contenu d'une page                                                    */
/* ------------------------------------------------------------------ */

interface Ligne {
  l: ElementLigne;
  sceneId: string;
}

interface ContenuPage {
  page: number;
  role: RolePage;
  premiere: SceneTableau;
  derniere: SceneTableau;
  numero?: { n: number; sceneId: string; total: number; ecrit: boolean };
  titre?: Ligne;
  /** Page de suite (sans titre à elle) : le titre de la page qu'elle continue, rappelé sans être réécrit. */
  rappel?: Ligne;
  phrase?: Ligne;
  details: Ligne[];
  avant?: Ligne;
  apres?: Ligne;
  liste: Ligne[];
  appel?: Ligne;
  /** Lignes ajoutées par la fin de la sortie (TikTok, Shorts : la phrase de leur fin, puis le site). */
  ajouts: { id: string; sceneId: string; texte: string }[];
  dessins: { e: Extract<ElementTableau, { type: "dessin" }>; sceneId: string }[];
  /** Mention « Exemple illustratif » de la page : elle devient le bandeau de la page « exemple ». */
  mention?: { id: string; sceneId: string; texte: string };
  gestes: { e: Extract<ElementTableau, { type: "geste" }>; sceneId: string }[];
  /** Éléments marqués (marque de la ligne, ou geste « entourer » / « cocher » de la fiche). */
  entoure: Set<string>;
  coche: Set<string>;
  /** Doubles : même texte déjà écrit sur la page (écrit une fois). */
  doubles: Map<string, string>;
}

const ordreEcriture = (s: SceneTableau) =>
  s.elements
    .map((e, i) => ({ e, i }))
    .sort((a, b) => ("ancre" in a.e ? a.e.ancre : 0) - ("ancre" in b.e ? b.e.ancre : 0) || a.i - b.i)
    .map((x) => x.e);

const cleTexte = (t: string) => t.split(/\s+/).map(cleMot).filter(Boolean).join(" ");

function contenus(fiche: FicheTableau, options: OptionsMiseEnPage): ContenuPage[] {
  const pages = pagesDe(fiche);
  const total = Math.max(0, ...fiche.scenes.map((s) => s.gabarit?.numero?.n ?? 0));
  const derniereScene = fiche.scenes[fiche.scenes.length - 1];
  const appel = options.appel;
  return pages.map((p, i) => {
    const c: ContenuPage = { page: p.page, role: rolePage(p) ?? "probleme", premiere: p.scenes[0], derniere: p.scenes[p.scenes.length - 1], details: [], liste: [], ajouts: [], dessins: [], gestes: [], entoure: new Set(), coche: new Set(), doubles: new Map() };
    const n = numeroDePage(pages, i);
    const sceneNumero = p.scenes.find((s) => s.gabarit?.numero);
    if (n !== undefined) c.numero = { n, sceneId: sceneNumero?.id ?? p.scenes[0].id, total: Math.max(total, n), ecrit: !!sceneNumero };
    const vus = new Map<string, string>();
    for (const s of p.scenes)
      for (const e of ordreEcriture(s)) {
        if (e.type === "dessin") c.dessins.push({ e, sceneId: s.id });
        else if (e.type === "geste") c.gestes.push({ e, sceneId: s.id });
        else if (e.type === "mention") c.mention ??= { id: e.id, sceneId: s.id, texte: e.texte };
        else if (e.type === "chiffre") c.details.push({ l: { id: e.id, type: "ligne", texte: e.unite ? `${e.valeur} ${e.unite}` : e.valeur, niveau: "texte", role: "resultat", bloc: "detail", ancre: e.ancre }, sceneId: s.id });
        else if (e.type === "preuve") {
          // La preuve de l'exemple : sa ligne « Avant : … » et sa ligne « Après : … » sont l'AVANT et l'APRÈS de la
          // page (sans leur étiquette, écrite à part) ; une ligne sans étiquette est un détail.
          e.lignes.forEach((texte, j) => {
            const m = /^\s*(avant|après|apres)\s*:\s*/iu.exec(texte);
            const ton = m ? (m[1].toLowerCase() === "avant" ? "avant" : "apres") : null;
            const l: ElementLigne = { id: j === 0 ? e.id : `${e.id}~${j}`, type: "ligne", texte: m ? texte.slice(m[0].length) : texte, niveau: "texte", role: ton === "avant" ? "alerte" : "resultat", bloc: ton ?? "detail", ancre: e.ancre };
            const x = { l, sceneId: s.id };
            if (ton === "avant" && !c.avant) c.avant = x;
            else if (ton === "apres" && !c.apres) c.apres = x;
            else c.details.push(x);
          });
        }
        else if (e.type === "ligne") {
          const cle = cleTexte(e.texte);
          const deja = vus.get(cle);
          if (deja) {
            c.doubles.set(e.id, deja);
            continue;
          }
          vus.set(cle, e.id);
          const x = { l: e, sceneId: s.id };
          if (e.marque === "entoure") c.entoure.add(e.id);
          switch (e.bloc) {
            case "titre":
              c.titre ??= x;
              break;
            case "phrase-cle":
              if (c.phrase) c.details.push(x);
              else c.phrase = x;
              break;
            case "avant":
              if (c.avant) c.details.push(x);
              else c.avant = x;
              break;
            case "apres":
              if (c.apres) c.details.push(x);
              else c.apres = x;
              break;
            case "liste":
              c.liste.push(x);
              break;
            case "appel":
              c.appel ??= x;
              break;
            default:
              c.details.push(x);
          }
        }
      }
    for (const { e } of c.gestes) {
      const id = c.doubles.get(e.cibleId) ?? e.cibleId;
      if (e.geste === "entourer") c.entoure.add(id);
      if (e.geste === "cocher") c.coche.add(id);
    }
    // Page de suite : le titre de la page qu'elle continue est rappelé (déjà écrit, il ne compte pas comme écrit ici).
    if (!c.titre && estPageSuite(pages, i)) {
      for (let j = i - 1; j >= 0 && !c.rappel; j--) {
        const t = pages[j].scenes.flatMap((s) => s.elements).find((e): e is ElementLigne => e.type === "ligne" && e.bloc === "titre");
        if (t) c.rappel = { l: t, sceneId: p.scenes[0].id };
      }
    }
    // Fin de TikTok et Shorts : la phrase de leur fin, puis l'adresse du site, après la dernière scène. Une ligne de la
    // fiche qui écrit déjà ce texte (fin de la sortie) n'est écrite qu'une fois : en vert, à la fin de la page.
    if (appel && "site" in appel && p.scenes.includes(derniereScene)) {
      if (appel.phrase?.trim()) c.ajouts.push({ id: `${derniereScene.id}~phrase`, sceneId: derniereScene.id, texte: appel.phrase.trim() });
      c.ajouts.push({ id: `${derniereScene.id}~site`, sceneId: derniereScene.id, texte: SIGNATURE_REFERENCE });
      for (const a of c.ajouts) {
        const cle = cleTexte(a.texte);
        const enDouble = (x: Ligne | undefined) => !!x && cleTexte(x.l.texte) === cle;
        for (const x of [...c.details, ...c.liste, c.appel, c.phrase].filter(enDouble)) c.doubles.set(x!.l.id, a.id);
        c.details = c.details.filter((x) => !enDouble(x));
        c.liste = c.liste.filter((x) => !enDouble(x));
        if (enDouble(c.appel)) c.appel = undefined;
        if (enDouble(c.phrase)) c.phrase = undefined;
      }
    }
    return c;
  });
}

/* ------------------------------------------------------------------ */
/* Blocs posés                                                           */
/* ------------------------------------------------------------------ */

/** Tailles d'une page à un facteur donné (jamais sous les minimums). */
interface Tailles {
  titre: number;
  phrase: number;
  detail: number;
  etiquette: number;
  k: number;
  /** Facteur des formes (pastille, puces, dessin, écarts de base). */
  f: number;
  /** Rangées permises en plus par bloc (une colonne étroite, en deux colonnes). */
  plus: number;
  /** Réduction du dessin posé à droite d'un titre qui, sinon, prendrait une rangée de plus (absent : 1). */
  dessin?: number;
  /**
   * Rangées d'un détail, d'un avant / après ou d'un appel (3 ; 4, le plafond des contrôles, en dernier recours : une
   * longue ligne prend une rangée de plus plutôt que de faire refuser la page).
   */
  rangs: number;
  /** Facteur des écarts imposé (dernier recours, aux tailles minimales : de 0,55 à 0,35) ; absent : celui des tailles. */
  ecart?: number;
}

/** Rangées permises à un détail, un avant / après, un appel. */
const rangsDe = (t: Tailles) => Math.min(RANGS_MAX, t.rangs + t.plus);
/** Plafond des contrôles pour un bloc autre que le titre (« blocs courts »). */
const RANGS_MAX = 4;
/** Facteur des écarts d'une page serrée ; en dernier recours, aux tailles minimales, les écarts se resserrent encore. */
const ECART_MIN = 0.55;
const ECART_SERRE = 0.35;

function tailles(k: number, f: number): Tailles {
  const t = (base: number, min: number) => Math.max(Math.round(min * k), Math.round(base * k * f));
  const detail = t(T.detail, T.detailMin);
  return { titre: t(T.titre, T.titreMin), phrase: t(T.phrase, T.phraseMin), detail, etiquette: Math.max(Math.round(TAILLES_REFERENCE.texteMin * k), Math.min(detail, Math.round(T.etiquette * k * f))), k, f, plus: 0, rangs: 3 };
}

/** Un élément posé, relatif au haut de son bloc (y = 0), à décaler ensuite. */
type Pose = Omit<ElementPlace, "ordre" | "px" | "fraction" | "encombrement"> & { px: RectPx; enc: RectPx; heure?: string | null };

/** Un bloc de la colonne : sa hauteur, ses éléments posés (relatifs), le poids de l'écart qui le précède. */
interface Bloc {
  hauteur: number;
  poses: Pose[];
  /** Écart de base AVANT ce bloc (px) ; le premier bloc d'une colonne n'en a pas. */
  ecart: number;
  /** Zones des gestes (entouré, coche) par élément, relatives. */
  zones: Map<string, { entoure?: RectPx; coche?: RectPx }>;
  /** Filets et séparateurs à prolonger jusqu'au bloc suivant (détails qui se suivent). */
  filet?: boolean;
}

/** Petit mot à ne pas laisser en fin de rangée (« à », « de », « la », « Un ») ; un sigle (« IA ») n'en est pas un. */
const petitMot = (u: string) => /^[\p{L}'’]{1,3}$/u.test(u) && !/^\p{Lu}{2,}$/u.test(u);

/**
 * Coupe un texte ALIGNÉ À GAUCHE : le moins de rangées possible (jamais un mot coupé), et parmi ces coupes celle dont
 * les rangées (sauf la dernière) sont les plus pleines, sans petit mot (« à », « de », « la ») en fin de rangée ni mot
 * seul en dernière rangée quand c'est évitable. `null` si un mot ne tient pas.
 */
export function couperGauche(texte: string, taille: number, largeurMax: number): { texte: string; largeur: number }[] | null {
  // Les unités (un signe isolé reste avec son mot), comme la coupe de « reference/1 ».
  const u = unites(texte);
  if (!u.length) return null;
  const lu = u.map((m) => largeurReference(m, taille));
  if (lu.some((x) => x > largeurMax)) return null;
  const esp = largeurReference(" ", taille);
  const larg = (i: number, j: number) => lu.slice(i, j).reduce((s, x) => s + x, 0) + (j - i - 1) * esp;
  let n0 = 1;
  for (let i = 0, w = 0; i < u.length; i++) {
    if (w > 0 && w + esp + lu[i] > largeurMax) {
      n0++;
      w = lu[i];
    } else w += (w > 0 ? esp : 0) + lu[i];
  }
  const n = u.length;
  const cout = (i: number, j: number, derniere: boolean) => {
    const w = larg(i, j);
    if (w > largeurMax) return Infinity;
    let c = derniere ? 0 : ((largeurMax - w) / largeurMax) ** 2;
    if (!derniere && petitMot(u[j - 1])) c += 0.5;
    if (derniere && n0 > 1 && j - i === 1) c += 0.4;
    return c;
  };
  const meilleur: number[][] = Array.from({ length: n0 + 1 }, () => Array(n + 1).fill(Infinity));
  const coupe: number[][] = Array.from({ length: n0 + 1 }, () => Array(n + 1).fill(-1));
  meilleur[0][0] = 0;
  for (let k = 1; k <= n0; k++)
    for (let j = k; j <= n; j++)
      for (let i = k - 1; i < j; i++) {
        const c = meilleur[k - 1][i] + cout(i, j, k === n0);
        if (c < meilleur[k][j] - 1e-12) {
          meilleur[k][j] = c;
          coupe[k][j] = i;
        }
      }
  const bornes: [number, number][] = [];
  for (let k = n0, j = n; k > 0; k--) {
    const i = coupe[k][j];
    bornes.unshift([i, j]);
    j = i;
  }
  return bornes.map(([i, j]) => ({ texte: u.slice(i, j).join(" "), largeur: Math.ceil(larg(i, j)) }));
}

/** Rangées d'un texte dans une largeur, au plus `max` ; `null` si elles ne tiennent pas. */
function rangees(texte: string, taille: number, largeur: number, max: number) {
  if (largeur <= 0) return null;
  const r = couperGauche(texte, taille, largeur);
  return r && r.length <= max ? r : null;
}

/** Lignes visuelles d'un texte posé à gauche en (x, y). */
function lignesDe(rs: { texte: string; largeur: number }[], x: number, y: number, il: number): (Omit<LigneVisuelle, "fraction"> & { px: RectPx })[] {
  return rs.map((r, i) => ({ texte: typographie(r.texte), px: { x: Math.round(x), y: Math.round(y + i * il), largeur: r.largeur, hauteur: il } }));
}

const decaler = (r: RectPx, dy: number): RectPx => ({ ...r, y: r.y + dy });

/** Marge d'un entouré, épaisseur du trait (comme « reference/1 »). */
const margeEntoure = (k: number) => Math.round(TAILLES_REFERENCE.margeEntoure * k);
const trait = (k: number) => Math.max(2, Math.round(TAILLES_REFERENCE.trait * k));

/**
 * Un texte simple posé à `x`, dans `largeur` : rangées, marques (entouré, coche) et zones des gestes. `null` s'il ne
 * tient pas en `max` rangées.
 */
function texteSimple(
  ligne: Ligne,
  c: ContenuPage,
  x: number,
  largeur: number,
  taille: number,
  interligne: number,
  max: number,
  extra: Partial<Pose> & { couleur: string; fond: string },
  k: number,
): { pose: Pose; hauteur: number; zone: { entoure?: RectPx; coche?: RectPx } } | null {
  const entoure = c.entoure.has(ligne.l.id);
  const coche = c.coche.has(ligne.l.id);
  const m = entoure ? margeEntoure(k) + trait(k) : 0;
  const il = Math.round(taille * interligne);
  const place = coche ? 2 * Math.round(il * 0.9) : 0;
  const rs = rangees(ligne.l.texte, taille, largeur - 2 * m - place, max);
  if (!rs) return null;
  const lignes = lignesDe(rs, x + m, m, il);
  const texte = union(lignes.map((l) => l.px));
  const zone: { entoure?: RectPx; coche?: RectPx } = {};
  const enc = [texte];
  if (entoure) {
    const me = margeEntoure(k);
    zone.entoure = { x: texte.x - me, y: texte.y - me, largeur: texte.largeur + 2 * me, hauteur: texte.hauteur + 2 * me };
    enc.push({ x: zone.entoure.x - trait(k), y: zone.entoure.y - trait(k), largeur: zone.entoure.largeur + 2 * trait(k), hauteur: zone.entoure.hauteur + 2 * trait(k) });
  }
  if (coche) {
    const der = lignes[lignes.length - 1].px;
    const q = Math.round(il * 0.7);
    zone.coche = { x: der.x + der.largeur + Math.round(il * 0.3), y: der.y + Math.round((der.hauteur - q) / 2), largeur: q, hauteur: q };
    enc.push(zone.coche);
  }
  const marque = ligne.l.marque === "surligne" ? "souligne" : ligne.l.marque;
  const { couleur, fond, ...reste } = extra;
  const pose: Pose = {
    elementId: ligne.l.id,
    sceneId: ligne.sceneId,
    type: "ligne",
    niveau: "titre",
    taillePx: taille,
    couleurTexte: couleur,
    couleurFond: fond,
    lignes: lignes as LigneVisuelle[],
    role: ligne.l.role,
    ...(marque ? { marque } : {}),
    px: texte,
    enc: union(enc),
    ...reste,
  };
  return { pose, hauteur: texte.hauteur + 2 * m, zone };
}

/** Couleur du sens de la page : terracotta pour le problème, vert sauge sinon. */
const tonDe = (role: RolePage) => (role === "probleme" ? C.terracotta : C.sauge);
const paleDe = (role: RolePage) => (role === "probleme" ? TEINTES_PALES_GABARIT.terracotta : TEINTES_PALES_GABARIT.sauge);

/** Bloc du haut : repère (points ou bandeau) à gauche, dessins à droite. `null` s'il est vide. */
/**
 * Les dessins de la page, en haut à droite d'un bloc, à `y` : le premier au bord, les suivants à sa gauche tant qu'ils
 * restent à droite de `gauche` (le repère ou le bandeau), sinon sous le premier.
 */
function posesDessins(c: ContenuPage, x1: number, D: number, y: number, gauche = -Infinity): Pose[] {
  const pas = Math.round(D * 1.15);
  let col = 0;
  let rang = 0;
  return c.dessins.map((d, i) => {
    if (i > 0) {
      if (x1 - D - (col + 1) * pas >= gauche) col++;
      else {
        rang++;
        col = 0;
      }
    }
    const x = x1 - D - col * pas;
    const px = { x, y: y + rang * pas, largeur: D, hauteur: D };
    const tache = Math.round(D * 0.86);
    const decor: DecorGabarit = { sorte: "dessin", tache: { x: x + Math.round(D * 0.1), y: px.y + Math.round(D * 0.08), largeur: tache, hauteur: tache }, couleur: paleDe(c.role) };
    return { elementId: d.e.id, sceneId: d.sceneId, type: "dessin" as const, lignes: [], dessinId: d.e.dessinId, cote: "droite" as const, rattache: (c.titre ?? c.phrase ?? c.details[0] ?? c.liste[0])?.l.id, gabarit: decor, px, enc: px };
  });
}

/** Le haut de la page porte le repère des étapes ou le bandeau « Exemple ». */
const aRepereOuBandeau = (c: ContenuPage) => (!!c.numero && c.role === "etape") || c.role === "exemple";

/** Réduction du dessin à droite du titre (vertical), plutôt qu'une rangée de titre de plus. */
const DESSIN_REDUIT = 0.75;

/**
 * Vertical : le titre reste bien coupé avec les dessins à sa droite : il garde ses rangées, ou passe en deux rangées
 * sans mot d'une ou deux lettres seul sur une rangée (« Le devis / oublié », jamais « Le / problème »).
 */
function titreGardeSesRangees(c: ContenuPage, s: Sortie, t: Tailles): boolean {
  if (!c.dessins.length) return true;
  const rangs = (avec: boolean) => {
    const b = blocTitre(c, s.x0, s.x1, t, 0, avec);
    return b && b !== "rien" ? (b.poses.find((p) => p.gabarit?.sorte === "titre")?.lignes.map((l) => l.texte) ?? null) : null;
  };
  const avec = rangs(true);
  const sans = rangs(false);
  if (!avec || !sans) return false;
  return avec.length <= sans.length || (avec.length <= 2 && !avec.some((r) => !r.includes(" ") && /^[\p{L}'’]{1,2}$/u.test(r)));
}

/** Côté d'un dessin à une taille donnée. */
const coteDessin = (t: Tailles) => Math.round(T.dessin * t.k * Math.min(1, t.f) * (t.dessin ?? 1));

/**
 * Bloc du haut : repère (points ou bandeau) à gauche, dessins à droite (sauf `sansDessins` : ils vont alors à côté du
 * titre). `null` s'il est vide.
 */
function blocHaut(c: ContenuPage, x0: number, x1: number, t: Tailles, sansDessins = false): Bloc | null {
  const k = t.k;
  const poses: Pose[] = [];
  const D = coteDessin(t);
  let gauche = 0;
  if (c.numero && c.role === "etape") {
    const p = Math.round(T.point * k);
    const pc = Math.round(T.pointCourant * k);
    const halo = Math.round(T.halo * k);
    const ecart = Math.round(T.ecartPoints * k);
    const h = pc + 2 * halo;
    const points: Extract<DecorGabarit, { sorte: "repere" }>["points"] = [];
    let x = x0 + halo;
    for (let i = 1; i <= c.numero.total; i++) {
      const d = i === c.numero.n ? pc : p;
      points.push({ x, y: Math.round((h - d) / 2), diametre: d, plein: i <= c.numero.n, courant: i === c.numero.n });
      x += d + ecart;
    }
    const px = { x: x0, y: 0, largeur: Math.round(x - ecart + halo - x0), hauteur: h };
    poses.push({ elementId: `${c.premiere.id}~repere`, sceneId: c.premiere.id, type: "mention", niveau: "titre", taillePx: t.etiquette, couleurTexte: C.encre, couleurFond: C.fond, lignes: [], gabarit: { sorte: "repere", points, couleur: C.sauge, halo: TEINTES_PALES_GABARIT.sauge }, px, enc: px, heure: null });
    gauche = h;
  } else if (c.role === "exemple") {
    const texte = c.mention?.texte ?? "Exemple";
    const taille = t.etiquette;
    const il = Math.round(taille * 1.1);
    const mx = Math.round(30 * k);
    const my = Math.round(T.margeEtiquette * k);
    const l = Math.ceil(largeurReference(texte, taille));
    const cadre = { x: x0, y: 0, largeur: l + 2 * mx, hauteur: il + 2 * my };
    poses.push({
      elementId: c.mention?.id ?? `${c.premiere.id}~bandeau`,
      sceneId: c.mention?.sceneId ?? c.premiere.id,
      type: "mention",
      niveau: "titre",
      taillePx: taille,
      couleurTexte: C.fond,
      couleurFond: C.encre,
      lignes: [{ texte, px: { x: x0 + mx, y: my, largeur: l, hauteur: il } } as LigneVisuelle],
      gabarit: { sorte: "bandeau", cadre, rayon: Math.round(cadre.hauteur / 2) },
      px: cadre,
      enc: cadre,
      heure: null,
    });
    gauche = cadre.hauteur;
  }
  const bordGauche = Math.max(x0, ...poses.map((p) => p.px.x + p.px.largeur)) + Math.round(T.ecartPastille * k);
  const dessins = sansDessins ? [] : posesDessins(c, x1, D, 0, poses.length ? bordGauche : -Infinity);
  poses.push(...dessins);
  const hauteur = Math.max(gauche, ...dessins.map((d) => d.px.y + d.px.hauteur));
  if (!hauteur) return null;
  // Repère centré sur la hauteur du dessin.
  for (const p of poses) if (p.type !== "dessin") {
    const dy = Math.round((hauteur - gauche) / 2);
    p.px = decaler(p.px, dy);
    p.enc = decaler(p.enc, dy);
    p.lignes = p.lignes.map((l) => ({ ...l, px: decaler(l.px, dy) }));
    if (p.gabarit?.sorte === "repere") p.gabarit = { ...p.gabarit, points: p.gabarit.points.map((q) => ({ ...q, y: q.y + dy })) };
    if (p.gabarit?.sorte === "bandeau") p.gabarit = { ...p.gabarit, cadre: decaler(p.gabarit.cadre, dy) };
  }
  return { hauteur, poses, ecart: 0, zones: new Map() };
}

/** Bloc du titre : la pastille (étape), puis le titre souligné. */
function blocTitre(c: ContenuPage, x0: number, x1Bloc: number, t: Tailles, ecart: number, avecDessins = false): Bloc | null | "rien" {
  const titre = c.titre ?? c.rappel;
  if (!titre) return "rien";
  const k = t.k;
  // Sorties basses : les dessins se posent à droite du titre (une rangée de gagnée).
  const D = coteDessin(t);
  const nd = avecDessins ? c.dessins.length : 0;
  const x1 = nd ? x1Bloc - nd * Math.round(D * 1.15) - Math.round(T.ecartPastille * k) : x1Bloc;
  const ton = tonDe(c.role);
  const P = c.numero && c.role === "etape" ? Math.round(T.pastille * t.titre) : 0;
  const xt = x0 + (P ? P + Math.round(T.ecartPastille * k) : 0);
  const souligne = Math.round(T.ecartSouligne * k) + Math.round(T.souligne * k);
  const r = texteSimple(titre, c, xt, x1 - xt, t.titre, T.interligneTitre, 2, { couleur: C.encre, fond: C.fond, marque: "souligne", couleurMarque: ton, epaisseurMarque: Math.round(T.souligne * k) }, k);
  if (!r) return null;
  const hTexte = r.hauteur + souligne;
  const hauteur = Math.max(P, hTexte, nd ? D : 0);
  const dy = Math.round((hauteur - hTexte) / 2);
  const pose = r.pose;
  pose.px = decaler(pose.px, dy);
  pose.lignes = pose.lignes.map((l) => ({ ...l, px: decaler(l.px, dy) }));
  pose.enc = union([decaler(pose.enc, dy), { x: pose.px.x - 2, y: pose.px.y, largeur: pose.px.largeur + 4, hauteur: pose.px.hauteur + souligne }]);
  pose.gabarit = { sorte: "titre" };
  // Page de suite : le titre rappelé est déjà là (id à part, il apparaît avec la page sans être réécrit).
  if (titre === c.rappel) {
    pose.elementId = `${c.premiere.id}~rappel`;
    pose.sceneId = c.premiere.id;
    pose.heure = null;
  }
  const poses: Pose[] = [pose];
  const zones = new Map([[pose.elementId, { ...(r.zone.entoure ? { entoure: decaler(r.zone.entoure, dy) } : {}) }]]);
  if (P) {
    const n = c.numero!;
    const disque = { x: x0, y: Math.round((hauteur - P) / 2), largeur: P, hauteur: P };
    const taille = Math.round(t.titre * 0.86);
    const ilc = Math.round(taille * 1.1);
    const chiffre = String(n.n);
    const l = Math.ceil(largeurReference(chiffre, taille));
    poses.unshift({
      elementId: n.ecrit ? idNumero(n.sceneId) : `${c.premiere.id}~numero`,
      sceneId: n.sceneId,
      type: "chiffre",
      niveau: "titre",
      taillePx: taille,
      couleurTexte: C.fond,
      couleurFond: ton,
      lignes: [{ texte: chiffre, px: { x: Math.round(x0 + (P - l) / 2), y: Math.round(disque.y + (P - ilc) / 2), largeur: l, hauteur: ilc } } as LigneVisuelle],
      gabarit: { sorte: "pastille", n: n.n, disque, couleur: ton },
      px: disque,
      enc: disque,
      ...(n.ecrit ? {} : { heure: null }),
    });
  }
  if (nd) poses.push(...posesDessins(c, x1Bloc, D, Math.round((hauteur - D) / 2)));
  return { hauteur, poses, ecart, zones };
}

/** Bloc d'un texte simple (phrase clé, détail, élément d'ajout) pleine largeur. */
function blocTexte(ligne: Ligne, c: ContenuPage, x0: number, x1: number, taille: number, interligne: number, max: number, ecart: number, extra: Partial<Pose> & { couleur: string; fond: string }, k: number, retrait = 0): Bloc | null {
  const r = texteSimple(ligne, c, x0 + retrait, x1 - x0 - retrait, taille, interligne, max, extra, k);
  if (!r) return null;
  return { hauteur: r.hauteur, poses: [r.pose], ecart, zones: new Map([[ligne.l.id, r.zone]]) };
}

/** Bloc avant / après : l'étiquette à gauche, le texte coloré à droite. */
function blocComparaison(ligne: Ligne, ton: "avant" | "apres", c: ContenuPage, x0: number, x1: number, t: Tailles, ecart: number): Bloc | null {
  const k = t.k;
  const taille = t.etiquette;
  const il = Math.round(taille * 1.1);
  const my = Math.round(T.margeEtiquette * k * 0.6);
  const texte = ton === "avant" ? "AVANT" : "APRÈS";
  const l = Math.ceil(largeurReference(texte, taille));
  // La colonne des étiquettes : celle du gabarit, jamais plus étroite que l'étiquette « APRÈS » (la plus large).
  const col = Math.max(Math.round(T.colonneEtiquette * k * Math.min(1, t.f)), Math.ceil(largeurReference("APRÈS", taille)) + 2 * Math.round(14 * k));
  // Colonne étroite (deux colonnes d'une sortie basse) : l'étiquette au-dessus du texte, plutôt qu'à sa gauche.
  const empile = x1 - x0 - col < Math.round(420 * k);
  const hCadre = il + 2 * my;
  const xt = empile ? x0 : x0 + col + Math.round(T.ecartEtiquette * k);
  const couleur = ton === "avant" ? C.terracotta : C.sauge;
  const r = texteSimple(ligne, c, xt, x1 - xt, t.detail, T.interligneDetail, rangsDe(t), { couleur, fond: C.fond }, k);
  if (!r) return null;
  if (empile) {
    const dy = hCadre + Math.round(10 * k);
    r.pose.px = decaler(r.pose.px, dy);
    r.pose.enc = decaler(r.pose.enc, dy);
    r.pose.lignes = r.pose.lignes.map((x) => ({ ...x, px: decaler(x.px, dy) }));
    for (const z of Object.values(r.zone)) if (z) z.y += dy;
    r.hauteur += dy;
  }
  const premiere = r.pose.lignes[0].px;
  const cadre = empile
    ? { x: x0, y: 0, largeur: l + 2 * Math.round(14 * k), hauteur: hCadre }
    : { x: x0, y: Math.max(0, Math.round(premiere.y + (premiere.hauteur - hCadre) / 2)), largeur: col, hauteur: hCadre };
  const etiquette: Pose = {
    elementId: `${ligne.l.id}~etiquette`,
    sceneId: ligne.sceneId,
    type: "mention",
    niveau: "titre",
    taillePx: taille,
    couleurTexte: C.fond,
    couleurFond: couleur,
    lignes: [{ texte, px: { x: Math.round(cadre.x + (cadre.largeur - l) / 2), y: cadre.y + my, largeur: l, hauteur: il } } as LigneVisuelle],
    gabarit: { sorte: "etiquette", cadre, rayon: Math.round(T.rayonEtiquette * k) },
    px: cadre,
    enc: cadre,
    heure: ligne.l.id,
  };
  return { hauteur: Math.max(r.hauteur, cadre.y + cadre.hauteur), poses: [etiquette, r.pose], ecart, zones: new Map([[ligne.l.id, r.zone]]) };
}

/** Bloc d'un élément de « À retenir » : la puce numérotée, puis le texte. */
function blocListe(ligne: Ligne, i: number, c: ContenuPage, x0: number, x1: number, t: Tailles, ecart: number): Bloc | null {
  const k = t.k;
  const P = Math.round(T.puce * t.phrase);
  const xt = x0 + P + Math.round(T.ecartPuce * k);
  const r = texteSimple(ligne, c, xt, x1 - xt, t.phrase, T.interlignePhrase, 2 + t.plus, { couleur: C.encre, fond: C.fond }, k);
  if (!r) return null;
  const premiere = r.pose.lignes[0].px;
  const disque = { x: x0, y: Math.max(0, Math.round(premiere.y + (premiere.hauteur - P) / 2)), largeur: P, hauteur: P };
  const taille = Math.max(Math.round(TAILLES_REFERENCE.texteMin * k), Math.round(P * 0.6));
  const il = Math.round(taille * 1.1);
  const chiffre = String(i + 1);
  const l = Math.ceil(largeurReference(chiffre, taille));
  const puce: Pose = {
    elementId: `${ligne.l.id}~puce`,
    sceneId: ligne.sceneId,
    type: "chiffre",
    niveau: "titre",
    taillePx: taille,
    couleurTexte: C.fond,
    couleurFond: C.sauge,
    lignes: [{ texte: chiffre, px: { x: Math.round(x0 + (P - l) / 2), y: Math.round(disque.y + (P - il) / 2), largeur: l, hauteur: il } } as LigneVisuelle],
    gabarit: { sorte: "puce", disque, couleur: C.sauge },
    px: disque,
    enc: disque,
    heure: ligne.l.id,
  };
  return { hauteur: Math.max(r.hauteur, disque.y + P), poses: [puce, r.pose], ecart, zones: new Map([[ligne.l.id, r.zone]]) };
}

/** Bloc de l'appel : le texte en grand, en clair, dans un cadre vert sauge (et les détails de la page dessous). */
function blocAppel(ligne: Ligne, suite: Ligne[], c: ContenuPage, x0: number, x1: number, t: Tailles, ecart: number): Bloc | null {
  const k = t.k;
  const mx = Math.round(T.margeAppelX * k);
  const my = Math.round(T.margeAppelY * k);
  // En grand (~70 px : taille de la phrase clé), la même pour toutes les fins (Reels, TikTok et Shorts : même poids) ;
  // dans une colonne étroite, à la taille des détails.
  const r = texteSimple(ligne, c, x0 + mx, x1 - x0 - 2 * mx, t.phrase, T.interlignePhrase, rangsDe(t), { couleur: C.fond, fond: C.sauge }, k) ?? texteSimple(ligne, c, x0 + mx, x1 - x0 - 2 * mx, t.detail, T.interligneDetail, rangsDe(t), { couleur: C.fond, fond: C.sauge }, k);
  if (!r) return null;
  const poses: Pose[] = [];
  let y = r.hauteur;
  const zones = new Map([[ligne.l.id, r.zone]]);
  for (const d of suite) {
    const s = texteSimple(d, c, x0 + mx, x1 - x0 - 2 * mx, t.detail, T.interligneDetail, rangsDe(t), { couleur: C.fond, fond: C.sauge }, k);
    if (!s) return null;
    y += Math.round(12 * k);
    s.pose.px = decaler(s.pose.px, y);
    s.pose.enc = decaler(s.pose.enc, y);
    s.pose.lignes = s.pose.lignes.map((l) => ({ ...l, px: decaler(l.px, y) }));
    poses.push(s.pose);
    y += s.hauteur;
  }
  const largeurTexte = Math.max(r.pose.px.largeur, ...poses.map((p) => p.px.largeur));
  const cadre = { x: x0, y: 0, largeur: Math.min(x1 - x0, largeurTexte + 2 * mx), hauteur: y + 2 * my };
  const tous = [r.pose, ...poses].map((p) => ({ ...p, px: decaler(p.px, my), enc: decaler(p.enc, my), lignes: p.lignes.map((l) => ({ ...l, px: decaler(l.px, my) })) }));
  tous[0].gabarit = { sorte: "appel", cadre, rayon: Math.round(T.rayonAppel * k), couleur: C.sauge };
  return { hauteur: cadre.hauteur, poses: tous, ecart, zones: new Map([...zones].map(([id, z]) => [id, { ...(z.entoure ? { entoure: decaler(z.entoure, my) } : {}), ...(z.coche ? { coche: decaler(z.coche, my) } : {}) }])) };
}

/* ------------------------------------------------------------------ */
/* Colonnes                                                              */
/* ------------------------------------------------------------------ */

/** Une fabrique de bloc : le bloc posé entre `x0` et `x1` (et l'écart qui le précède quand il suit un bloc). */
type Fabrique = (x0: number, x1: number) => Bloc | null;

/** Les fabriques des blocs d'une page, dans l'ordre de lecture (titre, phrase clé, avant / après, liste, détails, appel). */
function fabriques(c: ContenuPage, t: Tailles, dessinsAuTitre = false): Fabrique[] {
  const k = t.k;
  // Une page serrée resserre aussi ses écarts (les tailles, elles, ne descendent jamais sous leur minimum).
  const f = t.ecart ?? Math.max(ECART_MIN, t.f);
  const res: Fabrique[] = [];
  const ecart = (base: number) => Math.round(base * k * f);
  if (c.titre ?? c.rappel)
    res.push((x0, x1) => {
      const b = blocTitre(c, x0, x1, t, ecart(T.ecartRepere), dessinsAuTitre);
      return b === "rien" ? null : b;
    });
  const section = () => ecart(res.length ? T.ecartPhrase : T.ecartRepere);
  if (c.phrase) {
    const e = res.length ? ecart(T.ecartTitre) : ecart(T.ecartRepere);
    // Jusqu'à 4 rangées (le plafond des contrôles) : une longue phrase clé garde sa grande taille plutôt que de rapetisser.
    res.push((x0, x1) => blocTexte(c.phrase!, c, x0, x1, t.phrase, T.interlignePhrase, 4 + t.plus, e, { couleur: C.encre, fond: C.fond, gabarit: { sorte: "phrase" } }, k));
  }
  for (const [ligne, ton] of [
    [c.avant, "avant"],
    [c.apres, "apres"],
  ] as const) {
    if (!ligne) continue;
    const e = ton === "apres" && c.avant ? Math.round(ecart(T.ecartPhrase) * 0.9) : section();
    res.push((x0, x1) => blocComparaison(ligne, ton, c, x0, x1, t, e));
  }
  c.liste.forEach((l, i) => {
    const e = i === 0 ? section() : ecart(T.ecartListe);
    res.push((x0, x1) => blocListe(l, i, c, x0, x1, t, e));
  });
  const detailsDansAppel = c.role === "retenir" && !!c.appel;
  if (!detailsDansAppel)
    c.details.forEach((d, i) => {
      const e = i === 0 ? section() : ecart(T.ecartDetails);
      res.push((x0, x1) => {
        const b = blocTexte(d, c, x0, x1, t.detail, T.interligneDetail, rangsDe(t), e, { couleur: C.encre, fond: C.fond }, k, Math.round(T.retraitDetail * k));
        if (b) b.filet = true;
        return b;
      });
    });
  if (c.appel) {
    const e = c.liste.length ? ecart(T.ecartPhrase) : section();
    res.push((x0, x1) => blocAppel(c.appel!, detailsDansAppel ? c.details : [], c, x0, x1, t, e));
  }
  // Fin de TikTok et Shorts : leur demande EN GRAND, dans le même cadre vert plein que l'appel des Reels (même poids),
  // puis l'adresse du site dessous, dans le cadre (14/10, regard de Will : « la fin est minuscule »).
  if (c.ajouts.length) {
    const [tete, ...suite] = c.ajouts.map((a): Ligne => ({ l: { id: a.id, type: "ligne", texte: a.texte, niveau: "texte", role: "resultat", bloc: "appel", ancre: 0 }, sceneId: a.sceneId }));
    const e = c.appel ? ecart(T.ecartDetails) : c.liste.length && !c.details.length ? ecart(T.ecartPhrase) : section();
    res.push((x0, x1) => blocAppel(tete, suite, c, x0, x1, t, e));
  }
  return res;
}

/**
 * Les blocs d'une page à des tailles données : une colonne, ou deux (lues à gauche, puis à droite ; le titre toujours
 * à gauche), coupées au plus équilibré. `null` si un bloc ne tient pas.
 */
function blocsDePage(c: ContenuPage, t0: Tailles, s: Sortie, deux: boolean): { haut: Bloc | null; gauche: Bloc[]; droite: Bloc[]; auTitre: boolean } | null {
  // Vertical sans repère ni bandeau : le dessin à droite du titre, réduit au besoin pour que le titre garde ses rangées.
  const reduit = !deux && s.format === "vertical" && !!(c.titre ?? c.rappel) && !aRepereOuBandeau(c) && !titreGardeSesRangees(c, s, t0) && titreGardeSesRangees(c, s, { ...t0, dessin: DESSIN_REDUIT });
  const t = reduit ? { ...t0, dessin: DESSIN_REDUIT } : t0;
  // Sorties basses sur une colonne : les dessins vont à droite du titre (s'il y en a un). Vertical : aussi quand le haut
  // de la page n'a ni repère ni bandeau (14/10, regard de Will : un dessin seul sur sa rangée laissait le haut vide).
  const dessinsAuTitre = !deux && !!(c.titre ?? c.rappel) && (s.format !== "vertical" || (!aRepereOuBandeau(c) && titreGardeSesRangees(c, s, t)));
  const haut = blocHaut(c, s.x0, s.x1, t, dessinsAuTitre);
  const fs = fabriques(c, t, dessinsAuTitre);
  if (!deux) {
    const blocs = fs.map((f) => f(s.x0, s.x1));
    if (blocs.some((b) => !b)) return null;
    return { haut, gauche: blocs as Bloc[], droite: [], auTitre: dessinsAuTitre };
  }
  if (fs.length < 2) return null;
  const gouttiere = Math.round(80 * t.k);
  const milieu = Math.round((s.x0 + s.x1) / 2);
  const g = fs.map((f) => f(s.x0, milieu - gouttiere / 2));
  const d = fs.map((f) => f(milieu + gouttiere / 2, s.x1));
  // Coupe de préférence : l'en-tête (titre, phrase clé) à gauche, le contenu à droite ; sinon la plus équilibrée.
  // Jamais entre l'« avant » et l'« après » d'un exemple.
  const entete = (c.titre ?? c.rappel ? 1 : 0) + (c.phrase ? 1 : 0);
  const iApres = c.avant && c.apres ? entete + 1 : -1;
  if (entete >= 1 && entete < fs.length) {
    const gauche = g.slice(0, entete);
    const droite = d.slice(entete);
    if (!gauche.some((b) => !b) && !droite.some((b) => !b) && Math.max(hauteurColonne(gauche as Bloc[]), hauteurColonne(droite as Bloc[])) <= s.bas - s.haut - (haut?.hauteur ?? 0) - (haut ? (droite[0]?.ecart ?? 0) : 0))
      return { haut, gauche: gauche as Bloc[], droite: droite as Bloc[], auTitre: dessinsAuTitre };
  }
  let meilleur: { gauche: Bloc[]; droite: Bloc[]; h: number } | null = null;
  // L'« avant » et l'« après » restent ensemble ; en dernier recours seulement (sortie carrée chargée), l'après passe en
  // haut de la colonne de droite (l'ordre de lecture reste : gauche, puis droite).
  for (const separer of [false, true]) {
    if (meilleur && meilleur.h <= s.bas - s.haut - (haut?.hauteur ?? 0)) break;
    for (let i = 1; i < fs.length; i++) {
      if (i === iApres && !separer) continue;
      const gauche = g.slice(0, i);
      const droite = d.slice(i);
      if (gauche.some((b) => !b) || droite.some((b) => !b)) continue;
      const h = Math.max(hauteurColonne(gauche as Bloc[]), hauteurColonne(droite as Bloc[]));
      if (!meilleur || h < meilleur.h - 0.5) meilleur = { gauche: gauche as Bloc[], droite: droite as Bloc[], h };
    }
  }
  return meilleur ? { haut, gauche: meilleur.gauche, droite: meilleur.droite, auTitre: dessinsAuTitre } : null;
}

const hauteurColonne = (bs: Bloc[]) => bs.reduce((s, b, i) => s + b.hauteur + (i ? b.ecart : 0), 0);

interface PageRetenue {
  t: Tailles;
  deux: boolean;
  haut: Bloc | null;
  colonnes: { blocs: Bloc[]; facteurEcart: number }[];
  /** Descente de toute la page (px) : une page qui reste courte, écarts ouverts, est centrée dans la zone sûre. */
  decalage: number;
}

/**
 * Tailles et écarts d'une page : le plus grand facteur (1 d'abord, jusqu'à 0,55, les tailles jamais sous leur minimum) où tout tient, sur une colonne ou deux
 * (horizontal ; carré et portrait si une colonne ne suffit pas) ; puis une page peu chargée grandit (jusqu’à `T.grandirMax`) et
 * ouvre ses écarts pour descendre vers `basVise` de la zone sûre. Si rien ne tient en 3 rangées par détail, la même
 * descente avec 4 rangées par détail, avant / après ou appel ; en dernier recours, aux tailles minimales, les écarts se
 * resserrent jusqu'à `ECART_SERRE` (14/10, pages refusées de la vidéo v-b19aefb21d57 : un détail de 13 mots demandait
 * 4 rangées ; l'exemple du plombier dépassait le carré de 14 px). `null` : la page passe à une page de plus (densite.ts).
 */
function retenir(c: ContenuPage, s: Sortie): PageRetenue | null {
  const place = s.bas - s.haut;
  const cible = Math.min(place, s.zone.y + Math.round(T.basVise * s.zone.hauteur) - s.haut);
  const modes = s.format === "horizontal" ? [true, false] : s.format === "vertical" ? [false] : [false, true];
  const mesurer = (f: number, deux: boolean, rangs: number, ecart?: number) => {
    const t: Tailles = { ...tailles(s.k, f), plus: deux ? 1 : 0, rangs, ...(ecart !== undefined ? { ecart } : {}) };
    const b = blocsDePage(c, t, s, deux);
    if (!b) return null;
    if (deux && (!b.droite.length || !b.gauche.length)) return null;
    const hHaut = b.haut ? b.haut.hauteur : 0;
    const premierEcart = (bs: Bloc[]) => (b.haut && bs.length ? bs[0].ecart : 0);
    const hs = [b.gauche, b.droite].filter((x) => x.length).map((bs) => hauteurColonne(bs) + premierEcart(bs));
    const total = hHaut + Math.max(0, ...hs);
    return { t, b, total, deux };
  };
  // Dans l'ordre : 3 rangées par détail ; 4 ; puis les écarts resserrés (toutes les tailles sont alors à leur minimum).
  const essais = [
    { rangs: 3, serre: false },
    { rangs: RANGS_MAX, serre: false },
    { rangs: RANGS_MAX, serre: true },
  ].flatMap((e) => modes.map((deux) => ({ ...e, deux })));
  for (const { rangs, serre, deux } of essais) {
    let r: ReturnType<typeof mesurer> = null;
    // Les tailles descendent (facteur 1 → 0,55) ; puis, serré, les écarts seuls (0,525 → 0,35), tailles et dessin au plus bas.
    for (let f = serre ? ECART_MIN - 0.025 : 1; f >= (serre ? ECART_SERRE : ECART_MIN) - 1e-9 && !r; f -= 0.025) {
      const x = serre ? mesurer(ECART_MIN, deux, rangs, f) : mesurer(f, deux, rangs);
      if (x && x.total <= place) r = x;
    }
    if (!r) continue;
    if (r.t.f >= 1 - 1e-9)
      for (let f = 1.025; f <= T.grandirMax + 1e-9; f += 0.025) {
        const x = mesurer(f, deux, rangs);
        // Grandir ne renvoie jamais le dessin du titre sur sa propre rangée (le haut de la page redeviendrait vide).
        if (!x || x.total > cible || x.b.auTitre !== r.b.auTitre) break;
        r = x;
      }
    const b = r.b;
    const hHaut = b.haut ? b.haut.hauteur : 0;
    let hFinale = 0;
    const colonnes = [b.gauche, b.droite]
      .filter((bs) => bs.length)
      .map((bs) => {
        const ecarts = bs.reduce((sm, x, i) => sm + (i || b.haut ? x.ecart : 0), 0);
        const h = hHaut + hauteurColonne(bs) + (b.haut ? bs[0].ecart : 0);
        // Deux colonnes : les écarts s'ouvrent moins (une colonne courte reste groupée sous son titre).
        const plafond = r.deux ? Math.min(2.4, T.ecartMaxFacteur) : T.ecartMaxFacteur;
        const facteur = ecarts > 0 && h < cible ? Math.min(plafond, 1 + (cible - h) / ecarts) : 1;
        hFinale = Math.max(hFinale, h + ecarts * (facteur - 1));
        return { blocs: bs, facteurEcart: facteur };
      });
    // Page encore courte, écarts ouverts au plus : centrée dans la zone sûre plutôt que collée en haut (14/10, Will).
    const decalage = hFinale < cible - 1 ? Math.max(0, Math.floor((place - hFinale) / 2)) : 0;
    return { t: r.t, deux: r.deux, haut: b.haut, colonnes, decalage };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Mise en page                                                          */
/* ------------------------------------------------------------------ */

/** Met en page une fiche « reference/2 ». Lève `ErreurMiseEnPage` (qui nomme la page et sa dernière scène) si une page ne tient pas. */
export function mettreEnPageClair(fiche: FicheTableau, options: OptionsMiseEnPage = {}): MiseEnPageTableau {
  const s = sortie(options);
  const ajouts: string[] = [];
  const ecritsUneFois: string[] = [];
  const suivent: Record<string, string | null> = {};
  const pages = contenus(fiche, options).map((c): PagePlacee => {
    const r = retenir(c, s);
    if (!r) {
      const mot = [c.titre, c.phrase, ...c.details, c.avant, c.apres, ...c.liste, c.appel]
        .filter((x): x is Ligne => !!x)
        .flatMap((x) => x.l.texte.split(/\s+/))
        .find((m) => largeurReference(m, Math.round(T.detailMin * s.k)) > (s.x1 - s.x0) * 0.6);
      if (mot) throw new ErreurMiseEnPage(`Page ${c.page} · scène ${c.derniere.id} · le mot « ${mot} » est trop long pour la largeur de la page : raccourcissez-le.`, c.page);
      throw new ErreurMiseEnPage(
        `Page ${c.page} · scène ${c.derniere.id} · la page (${contenuEnClair(c)}) ne tient pas dans la zone sûre, même réduite aux tailles minimales (titre ${T.titreMin}, phrase clé ${T.phraseMin}, détails ${T.detailMin} px) et en passant une ligne sur 4 rangées : raccourcissez une ligne (un détail de ${CONSEIL_GABARIT.detailMots} mots au plus, un avant ou un après de ${CONSEIL_GABARIT.comparaisonMots}), retirez un détail, ou mettez la dernière scène sur une page de plus.`,
        c.page,
      );
    }
    ecritsUneFois.push(...c.doubles.keys());
    const elements: ElementPlace[] = [];
    const zones = new Map<string, { entoure?: RectPx; coche?: RectPx }>();
    let ordre = 0;
    const poser = (p: Pose, dy: number) => {
      const { enc, heure, px, ...reste } = p;
      const g = reste.gabarit ? decalerDecor(reste.gabarit, dy) : undefined;
      elements.push({ ...reste, ...(g ? { gabarit: g } : {}), ordre: ordre++, ...rect(decaler(px, dy), s), lignes: p.lignes.map((l) => ({ ...l, ...rect(decaler(l.px, dy), s) })), encombrement: rect(decaler(enc, dy), s) });
      if (heure !== undefined) suivent[p.elementId] = heure;
      // Seconde ligne d'une preuve (« Après : … ») : écrite à la suite de la première.
      else if (/~\d+$/.test(p.elementId)) suivent[p.elementId] = p.elementId.replace(/~\d+$/, "");
      if (p.elementId.endsWith("~phrase") || p.elementId.endsWith("~site")) ajouts.push(p.elementId);
    };
    let yHaut = s.haut + r.decalage;
    if (r.haut) {
      for (const p of r.haut.poses) poser(p, yHaut);
      yHaut += r.haut.hauteur;
    }
    // L'ordre d'écriture suit les colonnes (gauche, puis droite) et les blocs de haut en bas.
    const filets: { pose: ElementPlace; bas: number }[] = [];
    for (const col of r.colonnes) {
      let y = yHaut;
      col.blocs.forEach((b, i) => {
        if (i || r.haut) y += Math.round(b.ecart * col.facteurEcart);
        for (const p of b.poses) poser(p, y);
        for (const [id, z] of b.zones) zones.set(id, { ...(z.entoure ? { entoure: decaler(z.entoure, y) } : {}), ...(z.coche ? { coche: decaler(z.coche, y) } : {}) });
        if (b.filet) filets.push({ pose: elements[elements.length - 1], bas: y + b.hauteur });
        y += b.hauteur;
      });
    }
    // Filets des détails : à gauche de chaque détail, prolongés jusqu'au détail suivant (un seul trait continu).
    const ton = paleDe(c.role);
    filets.forEach((f, i) => {
      const e = f.pose;
      const suivant = filets[i + 1]?.pose;
      const haut = e.px.y - Math.round(4 * s.k);
      const bas = suivant ? suivant.px.y - Math.round(4 * s.k) : f.bas + Math.round(4 * s.k);
      const filet = { x: e.px.x - Math.round(T.retraitDetail * s.k), y: haut, largeur: Math.round(T.filet * s.k), hauteur: bas - haut };
      e.gabarit = { sorte: "detail", filet, couleur: ton };
      const enc = union([e.encombrement.px, filet]);
      e.encombrement = rect(enc, s);
    });
    // Exemple : un pointillé sépare « avant » et « après » (il apparaît avec « après »).
    const etiquettes = elements.filter((e) => e.gabarit?.sorte === "etiquette");
    if (c.avant && c.apres && etiquettes.length === 2) {
      const [ea, ep] = etiquettes;
      const textes = elements.filter((e) => e.elementId === c.avant!.l.id || e.elementId === c.apres!.l.id);
      const basAvant = Math.max(ea.px.y + ea.px.hauteur, ...textes.filter((e) => e.elementId === c.avant!.l.id).map((e) => e.encombrement.px.y + e.encombrement.px.hauteur));
      const hautApres = Math.min(ep.px.y, ...textes.filter((e) => e.elementId === c.apres!.l.id).map((e) => e.encombrement.px.y));
      if (ep.gabarit?.sorte === "etiquette" && hautApres > basAvant) ep.gabarit = { ...ep.gabarit, separateur: { x: ea.px.x, y: Math.round((basAvant + hautApres) / 2), largeur: Math.max(...textes.map((e) => e.px.x + e.px.largeur)) - ea.px.x } };
    }
    // Gestes de la fiche : sur le bloc écrit.
    const gestes: GestePlace[] = [];
    for (const { e, sceneId } of c.gestes) {
      const id = c.doubles.get(e.cibleId) ?? e.cibleId;
      const cible = elements.find((x) => x.elementId === id && x.type !== "dessin");
      if (!cible) continue;
      const z = zones.get(id);
      const zone = e.geste === "cocher" ? z?.coche : e.geste === "entourer" ? z?.entoure : undefined;
      gestes.push({ elementId: e.id, sceneId, geste: e.geste as Geste, cibleId: id, cible: { px: cible.px, fraction: cible.fraction }, ...(zone ? { zone: rect(zone, s) } : {}), ordre: ordre++ });
    }
    const haut = elements.length ? Math.min(...elements.map((e) => e.encombrement.px.y)) : s.haut;
    const bas = elements.length ? Math.max(...elements.map((e) => e.encombrement.px.y + e.encombrement.px.hauteur)) : s.haut;
    return { page: c.page, echelle: r.t.f, occupation: arrondi6((bas - haut) / Math.max(1, s.bas - s.haut)), elements, gestes };
  });
  const autre = s.format !== "vertical";
  const reference: MiseEnPageReference = {
    style: STYLE_REFERENCE_2,
    k: s.k,
    // Aucune signature au gabarit clair (une quatrième taille de texte brouillerait la hiérarchie).
    signature: { x: s.zone.x, y: s.zone.y + s.zone.hauteur, largeur: 0, hauteur: 0, taillePx: Math.round(TAILLES_REFERENCE.signature * s.k) },
    pagesSansSignature: pages.map((p) => p.page),
    ajouts,
    ecritsUneFois,
    suivent,
  };
  return {
    version: VERSION_MISE_EN_PAGE,
    ...(autre ? { format: s.format, reference: referenceFormat(s.format) } : {}),
    largeurPx: s.W,
    hauteurPx: s.H,
    zoneSure: rect(s.zone, s),
    bandeSousTitres: rect({ x: s.zone.x, y: s.zone.y + s.zone.hauteur, largeur: s.zone.largeur, hauteur: 0 }, s),
    cadre: rect({ x: s.x0, y: s.haut, largeur: s.x1 - s.x0, hauteur: s.bas - s.haut }, s),
    pages,
    styleReference: reference,
  };
}

/** « titre, phrase clé, 2 détails » : ce que porte une page, pour un message. */
function contenuEnClair(c: ContenuPage): string {
  const n = (x: number, mot: string) => (x ? [`${x} ${mot}${x > 1 ? "s" : ""}`] : []);
  return [...(c.titre ? ["titre"] : []), ...(c.phrase ? ["phrase clé"] : []), ...(c.avant || c.apres ? ["avant / après"] : []), ...n(c.liste.length, "élément"), ...n(c.details.length, "détail"), ...(c.appel ? ["appel"] : [])].join(", ");
}

const dRect = (r: RectDecor, dy: number): RectDecor => ({ ...r, y: r.y + dy });

/** Le décor d'un élément, descendu de `dy`. */
function decalerDecor(g: DecorGabarit, dy: number): DecorGabarit {
  switch (g.sorte) {
    case "repere":
      return { ...g, points: g.points.map((p) => ({ ...p, y: p.y + dy })) };
    case "bandeau":
    case "appel":
      return { ...g, cadre: dRect(g.cadre, dy) };
    case "etiquette":
      return { ...g, cadre: dRect(g.cadre, dy), ...(g.separateur ? { separateur: { ...g.separateur, y: g.separateur.y + dy } } : {}) };
    case "pastille":
    case "puce":
      return { ...g, disque: dRect(g.disque, dy) };
    case "detail":
      return { ...g, filet: dRect(g.filet, dy) };
    case "dessin":
      return { ...g, tache: dRect(g.tache, dy) };
    default:
      return g;
  }
}

/** Largeur d'un texte écrit dans la police du style (réexport pour les contrôles). */
export const largeurGabarit = (texte: string, taille: number) => largeurEcrite(texte, "titre", taille, APPROCHE_REFERENCE);
