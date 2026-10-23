/**
 * MISE EN PAGE DU STYLE « reference/1 » (maquette validée le 14/10/2026, `maquettes/tableau-style-reference/`) : UNE
 * page blanche qui se remplit de haut en bas, bloc après bloc, sans rien effacer. Fonction PURE et déterministe ; même
 * contrat que les autres styles (`mettreEnPage` y renvoie une fiche dont `habillage` vaut « reference/1 ») : mêmes
 * pages (champ `page` des scènes), mêmes sorties (vertical, portrait, carré, horizontal), mêmes heures (calage).
 *
 *  - Un BLOC par élément écrit de la fiche (ligne, chiffre, mention ; une preuve fait un bloc par ligne « Avant » /
 *    « Après »), dans l'ordre d'écriture (scène, puis ancre). Texte centré, Montserrat ExtraBold, 52 px de référence
 *    (une ligne « titre » : 58), coupé en rangées ÉQUILIBRÉES (jamais un mot coupé, jamais plus de 3 rangées) ; couleur
 *    selon le rôle : encre, terracotta (alerte, « Avant »), sauge (résultat, avantage, « Après »). Un même texte n'est
 *    écrit qu'une fois par page (« Exemple illustratif » répété).
 *  - Un DESSIN par idée (~120 px) : rattaché au bloc écrit juste avant lui (sinon juste après) qui n'en a pas encore ;
 *    posé à côté de son texte, jamais collé, le groupe « texte + dessin » centré dans la colonne, en ALTERNANCE
 *    gauche / droite sur la page. Un dessin sans bloc libre a sa rangée à lui, au centre.
 *  - Réglages du 14/10/2026 (regard de Will sur les planches : « trop vide, texte trop petit », méthode du reel de
 *    référence) : la page COMMENCE EN HAUT (premier bloc vers y = 140 en vertical) et se remplit vers le bas, blocs
 *    serrés à écart régulier. Une page très chargée est serrée (écart, puis taille, jamais sous 44 px). Une page qui ne
 *    tient pas est refusée en nommant la page et sa dernière scène.
 *  - Réglages du 14/10/2026, suite (une vraie vidéo regardée par Will : « page remplie aux 2/3, bas vide ») : colonne
 *    jusqu'à 88 % de la largeur ; une page peu chargée grandit (taille jusqu'à 60 px, puis écart) jusqu'à ce que son
 *    DERNIER bloc descende vers 88 % de la hauteur de la zone sûre (`basVise`) : jamais de grand vide en bas d'une page
 *    terminée.
 *  - Les quatre sorties : la colonne est dans la zone sûre de la sortie (en vertical : haut à 6 %, bas à 20 % ; aucune
 *    bande de sous-titres, le texte de la page les remplace) ; en horizontal, une page large centrée, ou deux
 *    colonnes de blocs quand la page est chargée (lues à gauche, puis à droite).
 *  - Fin de TikTok et Shorts (`appel.site`) : la phrase de leur fin validée, puis « axion-ia.com », écrites en sauge à
 *    la suite de la dernière page. Les autres fins : ce que la fiche écrit (le texte dit et le texte écrit restent ceux
 *    du script validé).
 */
import { largeurEcrite } from "@/briques/stylo/mesure-ecriture";
import { APPROCHE_REFERENCE, COULEURS_REFERENCE, SIGNATURE_REFERENCE, STYLE_REFERENCE_1, TAILLES_REFERENCE, couleurDuRole, couleurDuTon } from "@/briques/tableau-scene/reference/charte";
import type { MiseEnPageReference } from "@/briques/tableau-scene/reference/types";
import { cleMot, type Cote, type ElementTableau, type FicheTableau, type Geste, type Marque, type SceneTableau } from "./fiche";
import { formatSortie, referenceFormat, zoneSureReference, type IdFormatSortie } from "./formats-sortie";
import { ErreurMiseEnPage, VERSION_MISE_EN_PAGE, zoneSureTableau, type ElementPlace, type GestePlace, type LigneVisuelle, type MiseEnPageTableau, type OptionsMiseEnPage, type PagePlacee, type Rect, type RectPx, type TonPreuve } from "./mise-en-page";

/** Texte de l'adresse écrite à la fin de TikTok et Shorts. */
const SITE = SIGNATURE_REFERENCE;

/* ------------------------------------------------------------------ */
/* Gabarit de la sortie                                                  */
/* ------------------------------------------------------------------ */

interface GabaritReference {
  W: number;
  H: number;
  /** Petit côté ÷ 1080 : échelle des tailles du style. */
  k: number;
  format: IdFormatSortie;
  zone: RectPx;
  /** Colonne d'écriture : centre et largeur (les dessins se posent DANS la colonne, à côté de leur texte). */
  cx: number;
  colonne: number;
  /** Horizontal : deux colonnes de blocs (centres), sinon une. */
  deuxColonnes: { gauche: number; droite: number; largeur: number } | null;
  /** Haut et bas de la place des blocs. */
  haut: number;
  bas: number;
  signature: MiseEnPageReference["signature"];
}

const arrondi6 = (v: number) => Math.round(v * 1e6) / 1e6;

function gabaritReference(options: OptionsMiseEnPage): GabaritReference {
  const format: IdFormatSortie = options.format && options.format !== "vertical" ? options.format : "vertical";
  const f = formatSortie(format);
  const W = f.largeur;
  const H = f.hauteur;
  const k = referenceFormat(format).largeur / 1080;
  const z = format === "vertical" ? zoneSureReference("vertical", zoneSureTableau(options.reseaux)) : zoneSureReference(format);
  const x = Math.round((z.gauche / 100) * W);
  const y = Math.round((z.haut / 100) * H);
  const zone = { x, y, largeur: W - x - Math.round((z.droite / 100) * W), hauteur: H - y - Math.round((z.bas / 100) * H) };
  const T = TAILLES_REFERENCE;
  // Une colonne jusqu'à ~85 % de la largeur, dans la zone sûre, au plus près du milieu de l'image.
  const colonne = Math.min(Math.round(T.colonne * k), zone.largeur);
  const cx = Math.min(zone.x + zone.largeur - colonne / 2, Math.max(zone.x + colonne / 2, W / 2));
  // Horizontal : deux colonnes de blocs (la page large se remplit, une ligne reste lisible).
  const largeur2 = Math.floor((zone.largeur - Math.round(T.gouttiere * k)) / 2);
  const deuxColonnes = format === "horizontal" ? { gauche: zone.x + largeur2 / 2, droite: zone.x + zone.largeur - largeur2 / 2, largeur: largeur2 } : null;
  const tailleSig = Math.round(T.signature * k);
  const hSig = Math.round(tailleSig * 1.3);
  const signature = { x: zone.x, y: zone.y + zone.hauteur - hSig, largeur: Math.ceil(largeurEcrite(SITE, "titre", tailleSig, APPROCHE_REFERENCE)), hauteur: hSig, taillePx: tailleSig };
  return { W, H, k, format, zone, cx, colonne, deuxColonnes, haut: zone.y + Math.round(T.margeHaut * k), bas: signature.y - Math.round(T.margeBas * k), signature };
}

/* ------------------------------------------------------------------ */
/* Coupure en rangées équilibrées                                        */
/* ------------------------------------------------------------------ */

/** Mots du texte ; un signe isolé reste avec son mot : « ? », « : », « » » avec le précédent, « « » avec le suivant. */
export function unites(texte: string): string[] {
  const res: string[] = [];
  let ouvrant = "";
  for (const m of texte.split(/\s+/).filter(Boolean)) {
    if (/^[«“(]$/u.test(m)) ouvrant += `${m} `;
    else if (res.length && !ouvrant && !/[\p{L}\p{N}]/u.test(m)) res[res.length - 1] += ` ${m}`;
    else {
      res.push(ouvrant + m);
      ouvrant = "";
    }
  }
  if (ouvrant) res.push(ouvrant.trim());
  return res;
}

/** Largeur (px) d'un texte écrit dans la police du style. */
export function largeurReference(texte: string, taille: number): number {
  return largeurEcrite(texte, "titre", taille, APPROCHE_REFERENCE);
}

const petit = (u: string) => /^[\p{L}']{1,3}$/u.test(u) && !/^\p{Lu}/u.test(u);

/**
 * Coupe un texte en rangées ÉQUILIBRÉES dans `largeurMax` : le moins de rangées possible, puis les plus égales, un
 * petit mot jamais en fin de rangée quand c'est évitable. `null` si un mot ne tient pas.
 */
export function couperReference(texte: string, taille: number, largeurMax: number): { texte: string; largeur: number }[] | null {
  const u = unites(texte);
  if (!u.length) return null;
  const l = u.map((m) => largeurReference(m, taille));
  if (l.some((x) => x > largeurMax)) return null;
  const esp = largeurReference(" ", taille);
  const larg = (i: number, j: number) => l.slice(i, j).reduce((s, x) => s + x, 0) + (j - i - 1) * esp;
  let n0 = 1;
  for (let i = 0, w = 0; i < u.length; i++) {
    if (w > 0 && w + esp + l[i] > largeurMax) {
      n0++;
      w = l[i];
    } else w += (w > 0 ? esp : 0) + l[i];
  }
  const n = u.length;
  const cout = (i: number, j: number, derniere: boolean) => {
    const w = larg(i, j);
    if (w > largeurMax) return Infinity;
    let c = ((largeurMax - w) / largeurMax) ** 2;
    if (!derniere && petit(u[j - 1])) c += 0.3;
    if (n0 > 1 && j - i === 1 && petit(u[i])) c += 0.6;
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

/* ------------------------------------------------------------------ */
/* Blocs d'une page                                                      */
/* ------------------------------------------------------------------ */

interface Groupe {
  texte: string;
  couleur: string;
  ton?: TonPreuve;
}

interface Bloc {
  id: string;
  sceneId: string;
  type: "ligne" | "chiffre" | "mention" | "preuve";
  role?: string;
  marque?: Marque;
  groupes: Groupe[];
  ancre: number;
  /** Dessin rattaché (un par bloc au plus) et son côté. */
  dessin?: { id: string; dessinId: string; cote: Exclude<Cote, "centre"> };
  /** Marques posées par la ligne ou par un geste de la fiche. */
  entoure: boolean;
  coche: boolean;
}

interface DessinSeul {
  id: string;
  sceneId: string;
  dessinId: string;
}

type Article = { bloc: Bloc } | { seul: DessinSeul };

const ancreDe = (e: ElementTableau) => ("ancre" in e ? e.ancre : 0);

/** Éléments d'une scène dans l'ordre d'écriture (ancre, puis rang dans la fiche). */
function ordreEcriture(s: SceneTableau): ElementTableau[] {
  return s.elements
    .map((e, i) => ({ e, i }))
    .sort((a, b) => ancreDe(a.e) - ancreDe(b.e) || a.i - b.i)
    .map((x) => x.e);
}

/** « Avant : une heure » → ton « avant » ; sans étiquette : pas de ton. */
function tonDe(ligne: string): TonPreuve | undefined {
  const m = /^\s*(avant|après|apres)\s*:/iu.exec(ligne);
  return m ? (m[1].toLowerCase() === "avant" ? "avant" : "apres") : undefined;
}

const cleTexte = (t: string) => t.split(/\s+/).map(cleMot).filter(Boolean).join(" ");

/** Les blocs d'une page, leurs dessins et leurs marques ; ce qui n'est pas écrit (déjà écrit sur la page). */
function articlesDePage(scenes: SceneTableau[], ajouts: Bloc[]): { articles: Article[]; ecritsUneFois: Map<string, string>; gestes: { e: Extract<ElementTableau, { type: "geste" }>; sceneId: string }[] } {
  const articles: Article[] = [];
  const parTexte = new Map<string, string>();
  const ecritsUneFois = new Map<string, string>();
  const gestes: { e: Extract<ElementTableau, { type: "geste" }>; sceneId: string }[] = [];
  const blocs = new Map<string, Bloc>();
  const ajouter = (b: Bloc) => {
    const cle = b.groupes.map((g) => cleTexte(g.texte)).join(" | ");
    const deja = parTexte.get(cle);
    if (deja) {
      ecritsUneFois.set(b.id, deja);
      return;
    }
    parTexte.set(cle, b.id);
    blocs.set(b.id, b);
    articles.push({ bloc: b });
  };
  for (const s of scenes) {
    const ordre = ordreEcriture(s);
    const dessins: Extract<ElementTableau, { type: "dessin" }>[] = [];
    for (const e of ordre) {
      const base = { id: e.id, sceneId: s.id, ancre: ancreDe(e), entoure: false, coche: false };
      // La scène de fin (l'appel, ce qu'on gagne) s'écrit en sauge, sauf une alerte.
      const couleur = s.role === "fin" && e.type === "ligne" && e.role !== "alerte" ? COULEURS_REFERENCE.sauge : e.type === "ligne" ? couleurDuRole(e.role) : COULEURS_REFERENCE.encre;
      if (e.type === "ligne") ajouter({ ...base, type: "ligne", role: e.role, ...(e.marque ? { marque: e.marque === "surligne" ? "souligne" : e.marque } : {}), entoure: e.marque === "entoure", groupes: [{ texte: e.texte, couleur }] });
      else if (e.type === "chiffre") ajouter({ ...base, type: "chiffre", groupes: [{ texte: e.unite ? `${e.valeur} ${e.unite}` : e.valeur, couleur: COULEURS_REFERENCE.encre }] });
      else if (e.type === "mention") ajouter({ ...base, type: "mention", groupes: [{ texte: e.texte, couleur: COULEURS_REFERENCE.encre }] });
      else if (e.type === "preuve") ajouter({ ...base, type: "preuve", groupes: e.lignes.map((t) => ({ texte: t, couleur: couleurDuTon(tonDe(t)), ...(tonDe(t) ? { ton: tonDe(t) } : {}) })) });
      else if (e.type === "dessin") dessins.push(e);
      else if (e.type === "geste") gestes.push({ e, sceneId: s.id });
    }
    // Un dessin par idée : rattaché au bloc libre écrit juste avant lui dans la scène, sinon juste après.
    for (const d of dessins) {
      const libres = articles.flatMap((a) => ("bloc" in a && a.bloc.sceneId === s.id && !a.bloc.dessin ? [a.bloc] : []));
      const avant = libres.filter((b) => b.ancre <= d.ancre);
      const cible = avant.at(-1) ?? libres.find((b) => b.ancre > d.ancre);
      if (cible) cible.dessin = { id: d.id, dessinId: d.dessinId, cote: d.cote === "droite" ? "droite" : "gauche" };
      else articles.push({ seul: { id: d.id, sceneId: s.id, dessinId: d.dessinId } });
    }
  }
  for (const b of ajouts) ajouter(b);
  // Dessins restés seuls : un bloc libre de la page, s'il y en a (le plus proche dans l'ordre d'écriture).
  for (let i = 0; i < articles.length; i++) {
    const a = articles[i];
    if (!("seul" in a)) continue;
    let meilleur: Bloc | null = null;
    let distance = Infinity;
    articles.forEach((x, j) => {
      if ("bloc" in x && !x.bloc.dessin && Math.abs(j - i) < distance) {
        meilleur = x.bloc;
        distance = Math.abs(j - i);
      }
    });
    if (meilleur) {
      (meilleur as Bloc).dessin = { id: a.seul.id, dessinId: a.seul.dessinId, cote: "gauche" };
      articles.splice(i, 1);
      i--;
    }
  }
  // Marques des gestes de la fiche (sur le bloc écrit, même s'il visait un texte déjà écrit plus haut).
  for (const { e } of gestes) {
    const cible = blocs.get(ecritsUneFois.get(e.cibleId) ?? e.cibleId);
    if (!cible) continue;
    if (e.geste === "entourer") cible.entoure = true;
    if (e.geste === "cocher") cible.coche = true;
  }
  // Alternance gauche / droite des dessins de la page, en partant du côté voulu par le premier ; un bloc coché garde
  // sa droite libre pour la coche.
  let cote: "gauche" | "droite" | null = null;
  for (const a of articles) {
    if (!("bloc" in a) || !a.bloc.dessin) continue;
    let c: "gauche" | "droite" = cote === null ? a.bloc.dessin.cote : cote === "gauche" ? "droite" : "gauche";
    if (a.bloc.coche) c = "gauche";
    a.bloc.dessin.cote = c;
    cote = c;
  }
  return { articles, ecritsUneFois, gestes };
}

/* ------------------------------------------------------------------ */
/* Pose                                                                  */
/* ------------------------------------------------------------------ */

interface ArticlePose {
  article: Article;
  /** Taille du texte de l'article (une ligne « titre » est un peu plus grande) et son interligne. */
  taille: number;
  il: number;
  /** Écart entre les groupes d'une preuve (« Avant » / « Après »). */
  ecartGroupes: number;
  /** Rangées de chaque groupe. */
  rangees: { texte: string; largeur: number }[][];
  hauteurTexte: number;
  hauteur: number;
}

/** Lignes au plus par bloc (comme le contrôle `LIGNES_BLOC_MAX`). */
const LIGNES_BLOC = 3;

/** Taille d'une ligne « titre » pour une taille de base. */
const tailleTitre = (base: number, k: number) => Math.min(Math.round((base * TAILLES_REFERENCE.texteTitre) / TAILLES_REFERENCE.texte), Math.round(TAILLES_REFERENCE.titreMax * k));

/**
 * Hauteur d'un article : son texte (et l'entouré), ou son dessin s'il est plus haut. Un bloc qui porte un dessin écrit
 * dans la colonne moins la place d'un dessin de chaque côté : le texte reste centré, le dessin tient à côté de lui,
 * dans la colonne, jamais collé.
 */
function poserArticle(a: Article, base: number, ecart: number, colonne: number, g: GabaritReference): ArticlePose | null {
  const T = TAILLES_REFERENCE;
  const D = Math.round(T.dessin * g.k);
  const ecartGroupes = Math.min(ecart, Math.round(T.ecart * g.k));
  if ("seul" in a) return { article: a, taille: base, il: Math.round(base * T.interligne), ecartGroupes, rangees: [], hauteurTexte: 0, hauteur: D };
  const b = a.bloc;
  const taille = b.role === "titre" ? tailleTitre(base, g.k) : base;
  const il = Math.round(taille * T.interligne);
  const marge = b.entoure ? Math.round(T.margeEntoure * g.k) + Math.max(2, Math.round(T.trait * g.k)) : 0;
  // Le dessin se pose à côté du texte : le groupe (texte + dessin) est centré dans la colonne.
  const reserve = b.dessin ? D + Math.round(T.ecartDessin * g.k) : 0;
  // Un bloc coché garde, à droite de sa dernière ligne, la place de la coche (et la même à gauche : il reste centré).
  const coche = b.coche ? 2 * Math.round(il * 1.15) : 0;
  const largeur = colonne - 2 * marge - reserve - coche;
  if (largeur <= 0) return null;
  const rangees: { texte: string; largeur: number }[][] = [];
  for (const gr of b.groupes) {
    const r = couperReference(gr.texte, taille, largeur);
    // Blocs courts : jamais plus de 3 lignes (contrôle « Blocs courts ») ; sinon plus petit, ou plus serré.
    if (!r || r.length > LIGNES_BLOC) return null;
    rangees.push(r);
  }
  const margeE = b.entoure ? Math.round(T.margeEntoure * g.k) : 0;
  const hauteurTexte = rangees.reduce((s, r) => s + r.length * il, 0) + (rangees.length - 1) * ecartGroupes + 2 * margeE;
  return { article: a, taille, il, ecartGroupes, rangees, hauteurTexte, hauteur: Math.max(hauteurTexte, b.dessin ? D : 0) };
}

const rect = (px: RectPx, g: GabaritReference): Rect => ({ px, fraction: { x: arrondi6(px.x / g.W), y: arrondi6(px.y / g.H), largeur: arrondi6(px.largeur / g.W), hauteur: arrondi6(px.hauteur / g.H) } });

const union = (rs: RectPx[]): RectPx => {
  const x = Math.floor(Math.min(...rs.map((r) => r.x)));
  const y = Math.floor(Math.min(...rs.map((r) => r.y)));
  const x2 = Math.ceil(Math.max(...rs.map((r) => r.x + r.largeur)));
  const y2 = Math.ceil(Math.max(...rs.map((r) => r.y + r.hauteur)));
  return { x, y, largeur: x2 - x, hauteur: y2 - y };
};

/** Une colonne de la page : son centre, sa largeur, ses articles posés et leur hauteur totale. */
interface ColonnePosee {
  cx: number;
  largeur: number;
  poses: ArticlePose[];
  hauteur: number;
  /** Écart entre ses blocs (deux colonnes : chacune répartie pour se remplir). */
  ecart: number;
}

/** Une page posée : taille de base retenue, écart, colonnes. */
interface PageRetenue {
  taille: number;
  ecart: number;
  colonnes: ColonnePosee[];
  /** Hauteur de la plus haute colonne. */
  hauteur: number;
}

const hauteurDe = (ps: ArticlePose[], ecart: number) => ps.reduce((s, p) => s + p.hauteur, 0) + Math.max(0, ps.length - 1) * ecart;

/**
 * Pose les articles à une taille et un écart, sur une colonne (`deux` faux) ou deux (horizontal, coupées au plus
 * équilibré, l'ordre de lecture gardé : la colonne de gauche, puis celle de droite).
 */
function essayer(articles: Article[], taille: number, ecart: number, g: GabaritReference, deux = false): PageRetenue | null {
  const dc = g.deuxColonnes;
  if (dc && deux && articles.length >= 2) {
    const poses = articles.map((a) => poserArticle(a, taille, ecart, dc.largeur, g));
    if (poses.some((p) => !p)) return null;
    const ps = poses as ArticlePose[];
    let coupe = 1;
    let meilleur = Infinity;
    for (let i = 1; i < ps.length; i++) {
      const h = Math.max(hauteurDe(ps.slice(0, i), ecart), hauteurDe(ps.slice(i), ecart));
      if (h < meilleur - 0.5) {
        meilleur = h;
        coupe = i;
      }
    }
    const colonnes = [
      { cx: dc.gauche, largeur: dc.largeur, poses: ps.slice(0, coupe), hauteur: hauteurDe(ps.slice(0, coupe), ecart), ecart },
      { cx: dc.droite, largeur: dc.largeur, poses: ps.slice(coupe), hauteur: hauteurDe(ps.slice(coupe), ecart), ecart },
    ];
    return { taille, ecart, colonnes, hauteur: Math.max(...colonnes.map((c) => c.hauteur)) };
  }
  // Une seule colonne (en horizontal : une page large, centrée, aux deux tiers de la largeur utile).
  const largeur = dc ? Math.round(g.zone.largeur * 0.66) : g.colonne;
  const cx = dc ? g.zone.x + g.zone.largeur / 2 : g.cx;
  const poses = articles.map((a) => poserArticle(a, taille, ecart, largeur, g));
  if (poses.some((p) => !p)) return null;
  const ps = poses as ArticlePose[];
  const hauteur = hauteurDe(ps, ecart);
  return { taille, ecart, colonnes: [{ cx, largeur, poses: ps, hauteur, ecart }], hauteur };
}

/**
 * Taille et écart d'une page, sur une colonne ou deux :
 *  1. la page tient-elle à la taille de base (52 px) et à l'écart serré du style ? sinon on serre l'écart (jusqu'à
 *     `ecartMin`), puis la taille (jusqu'à `texteMin`, 44 px) ;
 *  2. une page peu chargée grandit : la taille d'abord (jusqu'à `texteMax`, 60 px), puis l'écart (jusqu'à `ecartMax`),
 *     jusqu'à ce que le bas de son dernier bloc atteigne `basVise` (88 %) de la zone sûre ; jamais au-delà de la place.
 */
function retenirSur(articles: Article[], g: GabaritReference, deux: boolean): PageRetenue | null {
  const T = TAILLES_REFERENCE;
  const place = g.bas - g.haut;
  const cible = Math.min(place, g.zone.y + Math.round(T.basVise * g.zone.hauteur) - g.haut);
  const px = (v: number) => Math.round(v * g.k);
  let r: PageRetenue | null = null;
  for (let t = T.texte; t >= T.texteMin && !r; t -= 2) {
    for (let e = T.ecart; e >= T.ecartMin; e -= 4) {
      const x = essayer(articles, px(t), px(e), g, deux);
      if (!x) break; // un mot trop long à cette taille : plus petit
      if (x.hauteur <= place) {
        r = x;
        break;
      }
    }
  }
  if (!r) return null;
  if (r.taille !== px(T.texte) || r.ecart !== px(T.ecart)) return r;
  // Page peu chargée : la taille grandit tant que la page reste au-dessus du bas visé, puis l'écart (chaque colonne
  // pour elle-même) la répartit jusque-là.
  for (let t = T.texte + 2; t <= T.texteMax && r.hauteur < cible; t += 2) {
    const x = essayer(articles, px(t), r.ecart, g, deux);
    if (!x || x.hauteur > cible) break;
    r = x;
  }
  const ecartMax = px(T.ecartMax);
  for (const c of r.colonnes) {
    const n = c.poses.length;
    if (n < 2 || c.hauteur >= cible) continue;
    const plus = Math.min(ecartMax - c.ecart, Math.floor((cible - c.hauteur) / (n - 1)));
    if (plus <= 0) continue;
    c.ecart += plus;
    c.hauteur += plus * (n - 1);
  }
  r.hauteur = Math.max(...r.colonnes.map((c) => c.hauteur));
  return r;
}

/** Horizontal : une colonne large si la page y tient à la taille de base, sinon deux colonnes (la plus grande taille). */
function retenir(articles: Article[], g: GabaritReference): PageRetenue | null {
  const une = retenirSur(articles, g, false);
  if (!g.deuxColonnes || articles.length < 3 || (une && une.taille >= Math.round(TAILLES_REFERENCE.texte * g.k))) return une;
  const deux = retenirSur(articles, g, true);
  if (!une) return deux;
  return deux && deux.taille > une.taille ? deux : une;
}

/**
 * Met en page une fiche « reference/1 ». Lève `ErreurMiseEnPage` (message qui nomme la page et sa dernière scène) si
 * une page ne tient pas, même serrée jusqu'à la taille `texteMin`.
 */
export function mettreEnPageReference(fiche: FicheTableau, options: OptionsMiseEnPage = {}): MiseEnPageTableau {
  const g = gabaritReference(options);
  const numeros = [...new Set(fiche.scenes.map((s) => s.page))].sort((a, b) => a - b);
  const derniere = fiche.scenes[fiche.scenes.length - 1];
  const appel = options.appel;
  // Fin de TikTok et Shorts : la phrase de leur fin validée, puis l'adresse du site, en sauge, après la dernière scène.
  const ajoutsFin: Bloc[] =
    appel && "site" in appel && derniere
      ? [
          ...(appel.phrase?.trim() ? [{ id: `${derniere.id}~phrase`, sceneId: derniere.id, type: "ligne" as const, role: "resultat", groupes: [{ texte: appel.phrase.trim(), couleur: COULEURS_REFERENCE.sauge }], ancre: Number.MAX_SAFE_INTEGER, entoure: false, coche: false }] : []),
          { id: `${derniere.id}~site`, sceneId: derniere.id, type: "ligne" as const, role: "resultat", groupes: [{ texte: SITE, couleur: COULEURS_REFERENCE.sauge }], ancre: Number.MAX_SAFE_INTEGER, entoure: false, coche: false },
        ]
      : [];
  const ajouts: string[] = [];
  const ecritsUneFois: string[] = [];
  const pagesSansSignature: number[] = [];
  const base = Math.round(TAILLES_REFERENCE.texte * g.k);
  const pages = numeros.map((page): PagePlacee => {
    const scenes = fiche.scenes.filter((s) => s.page === page);
    const derniereScene = scenes[scenes.length - 1];
    const { articles, ecritsUneFois: doubles, gestes } = articlesDePage(scenes, derniereScene === derniere ? ajoutsFin : []);
    ecritsUneFois.push(...doubles.keys());
    const retenue: PageRetenue | null = articles.length ? retenir(articles, g) : { taille: base, ecart: 0, colonnes: [], hauteur: 0 };
    if (!retenue) {
      // Un mot plus large que la colonne, même à la plus petite taille : on le nomme.
      const tMin = Math.round(TAILLES_REFERENCE.texteMin * g.k);
      const largeur = g.deuxColonnes?.largeur ?? g.colonne;
      for (const a of articles) {
        if (!("bloc" in a)) continue;
        const mot = a.bloc.groupes.flatMap((gr) => unites(gr.texte)).find((m) => largeurReference(m, tMin) > largeur);
        if (mot) throw new ErreurMiseEnPage(`Page ${page} · scène ${a.bloc.sceneId} · le mot « ${mot} » ne tient pas dans la largeur de la page : raccourcissez-le.`, page);
      }
      throw new ErreurMiseEnPage(
        `Page ${page} · scène ${derniereScene.id} · la page ne tient pas dans la zone sûre, même serrée (${articles.length} blocs) : raccourcissez une ligne, ou mettez une scène sur une page de plus.`,
        page,
      );
    }
    const D = Math.round(TAILLES_REFERENCE.dessin * g.k);
    const ecartDessin = Math.round(TAILLES_REFERENCE.ecartDessin * g.k);
    const trait = Math.max(2, Math.round(TAILLES_REFERENCE.trait * g.k));
    const elements: ElementPlace[] = [];
    const zones = new Map<string, { entoure?: RectPx; coche?: RectPx }>();
    let ordre = 0;
    for (const col of retenue.colonnes) {
      // La page commence EN HAUT et se remplit vers le bas, à écart régulier.
      let y = g.haut;
      for (const p of col.poses) {
        const a = p.article;
        if ("seul" in a) {
          const px = { x: Math.round(col.cx - D / 2), y, largeur: D, hauteur: D };
          elements.push({ elementId: a.seul.id, sceneId: a.seul.sceneId, type: "dessin", ordre: ordre++, ...rect(px, g), lignes: [], dessinId: a.seul.dessinId, cote: "centre", encombrement: rect(px, g) });
          y += p.hauteur + col.ecart;
          continue;
        }
        const b = a.bloc;
        const marge = b.entoure ? Math.round(TAILLES_REFERENCE.margeEntoure * g.k) : 0;
        // Bloc à dessin : le texte se décale de la moitié de la place du dessin, du côté opposé (groupe centré).
        const ecartTexte = ecartDessin + (b.entoure ? marge + trait : 0);
        const decale = b.dessin ? ((D + ecartDessin) / 2) * (b.dessin.cote === "gauche" ? 1 : -1) : 0;
        const cx = col.cx + decale;
        let yl = y + Math.round((p.hauteur - p.hauteurTexte) / 2) + marge;
        const lignes: LigneVisuelle[] = [];
        p.rangees.forEach((rs, gi) => {
          if (gi > 0) yl += p.ecartGroupes;
          for (const r of rs) {
            const px = { x: Math.round(cx - r.largeur / 2), y: yl, largeur: r.largeur, hauteur: p.il };
            const ton = b.groupes[gi].ton;
            lignes.push({ texte: r.texte, ...rect(px, g), ...(ton ? { ton } : {}) });
            yl += p.il;
          }
        });
        const texte = union(lignes.map((l) => l.px));
        const enc: RectPx[] = [texte];
        const z: { entoure?: RectPx; coche?: RectPx } = {};
        if (b.entoure) {
          z.entoure = { x: texte.x - marge, y: texte.y - marge, largeur: texte.largeur + 2 * marge, hauteur: texte.hauteur + 2 * marge };
          enc.push({ x: z.entoure.x - trait, y: z.entoure.y - trait, largeur: z.entoure.largeur + 2 * trait, hauteur: z.entoure.hauteur + 2 * trait });
        }
        if (b.coche) {
          const der = lignes[lignes.length - 1].px;
          const q = Math.round(p.il * 0.8);
          z.coche = { x: der.x + der.largeur + Math.round(p.il * 0.3), y: der.y + Math.round((der.hauteur - q) / 2), largeur: q, hauteur: q };
          enc.push(z.coche);
        }
        zones.set(b.id, z);
        const couleur = b.groupes[0].couleur;
        elements.push({
          elementId: b.id,
          sceneId: b.sceneId,
          type: b.type,
          ordre: ordre++,
          ...rect(texte, g),
          niveau: "titre",
          taillePx: p.taille,
          couleurTexte: couleur,
          couleurFond: COULEURS_REFERENCE.fond,
          lignes,
          ...(b.role ? { role: b.role } : {}),
          ...(b.marque ? { marque: b.marque } : {}),
          encombrement: rect(union(enc), g),
        });
        if (b.id.includes("~")) ajouts.push(b.id);
        if (b.dessin) {
          // À côté de son texte (dans la colonne, la place lui est gardée), jamais collé : un bloc court garde son
          // dessin près de lui.
          const x = b.dessin.cote === "gauche" ? texte.x - ecartTexte - D : texte.x + texte.largeur + ecartTexte;
          const px = { x: Math.round(x), y: y + Math.round((p.hauteur - D) / 2), largeur: D, hauteur: D };
          elements.push({ elementId: b.dessin.id, sceneId: b.sceneId, type: "dessin", ordre: ordre++, ...rect(px, g), lignes: [], dessinId: b.dessin.dessinId, cote: b.dessin.cote, rattache: b.id, encombrement: rect(px, g) });
        }
        y += p.hauteur + col.ecart;
      }
    }
    // Gestes de la fiche : sur le bloc écrit (un texte écrit une fois reçoit le geste qui visait son double).
    const placesGestes: GestePlace[] = [];
    for (const { e, sceneId } of gestes) {
      const id = doubles.get(e.cibleId) ?? e.cibleId;
      const cible = elements.find((x) => x.elementId === id && x.type !== "dessin");
      if (!cible) continue;
      const z = zones.get(id);
      const zone = e.geste === "cocher" ? z?.coche : e.geste === "entourer" ? z?.entoure : undefined;
      placesGestes.push({ elementId: e.id, sceneId, geste: e.geste as Geste, cibleId: id, cible: { px: cible.px, fraction: cible.fraction }, ...(zone ? { zone: rect(zone, g) } : {}), ordre: ordre++ });
    }
    if (elements.some((e) => e.elementId.endsWith("~site"))) pagesSansSignature.push(page);
    const haut = elements.length ? Math.min(...elements.map((e) => e.encombrement.px.y)) : g.haut;
    const bas = elements.length ? Math.max(...elements.map((e) => e.encombrement.px.y + e.encombrement.px.hauteur)) : g.haut;
    return { page, echelle: retenue.taille / base, occupation: arrondi6((bas - haut) / Math.max(1, g.bas - g.haut)), elements, gestes: placesGestes };
  });
  const autre = g.format !== "vertical";
  const cadre = g.deuxColonnes
    ? { x: Math.round(g.deuxColonnes.gauche - g.deuxColonnes.largeur / 2), y: g.haut, largeur: Math.round(g.deuxColonnes.droite - g.deuxColonnes.gauche + g.deuxColonnes.largeur), hauteur: g.bas - g.haut }
    : { x: Math.round(g.cx - g.colonne / 2), y: g.haut, largeur: g.colonne, hauteur: g.bas - g.haut };
  return {
    version: VERSION_MISE_EN_PAGE,
    ...(autre ? { format: g.format, reference: referenceFormat(g.format) } : {}),
    largeurPx: g.W,
    hauteurPx: g.H,
    zoneSure: rect(g.zone, g),
    // Aucune bande de sous-titres : le texte écrit de la page les remplace (bande vide au bas de la zone sûre).
    bandeSousTitres: rect({ x: g.zone.x, y: g.zone.y + g.zone.hauteur, largeur: g.zone.largeur, hauteur: 0 }, g),
    cadre: rect(cadre, g),
    pages,
    styleReference: { style: STYLE_REFERENCE_1, k: g.k, signature: g.signature, pagesSansSignature, ajouts, ecritsUneFois },
  };
}
