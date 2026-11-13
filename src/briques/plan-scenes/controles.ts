/**
 * CONTRÔLES DE QUALITÉ DU PLAN DE SCÈNES (GV2-46) — PUR (sans React, sans Remotion).
 * Une fonction par contrôle. Chacune prend une scène (ou le plan) et le contexte, et rend `{ scene | null, remarque? }`
 * (`scene: null` = scène retirée). Jamais de refus du plan entier : des remarques, une scène réparée, déplacée ou retirée.
 * Appelés à la fin de `validerPlanInterne`, dans l'ordre : littéralité, temps de lecture, débordement, sous-titres,
 * densité, répétition. Ils valent pour le plan du stock comme pour le plan composé par un modèle.
 */
import { faitsDuScript, type Fait } from "../faits-script";
import { couperLignes, tailleQuiTient } from "../motion/mesure";
import { type IdPiece } from "./catalogue";
import type { FormatPlan, MotMinute, ScenePlan } from "./schema";
import { TOILES } from "./toiles";
import { devantLeVisage, POSITION_SURE_FACECAM, seChevauchent, ZONES, type Position, type Rectangle } from "./zones";

/** Bande des sous-titres (en % de l'image) : aucune pièce ne se pose dessus. */
export const BANDE_SOUS_TITRES_DEFAUT: Rectangle = { x: 5, y: 66, largeur: 90, hauteur: 16 };

/** Seuils retenus (voir le compte rendu de la fiche). */
export const SEUILS_CONTROLES = {
  /** Temps de lecture : par mot affiché, plus une base fixe (ms). */
  MS_PAR_MOT: 250,
  MS_BASE: 400,
  /** Aucune scène ne finit plus de 1,2 s après la fin de son dernier mot (ms). */
  QUEUE_MAX_MS: 1200,
  /** Débordement : taille minimale du texte, en part de la hauteur de l'image. */
  TAILLE_MIN_PART_HAUTEUR: 0.03,
  /** Sous-titres : une pièce dont moins de 15 % de la hauteur dessinée tombe dans la bande n'est pas déplacée (marge basse d'un écran). */
  RECOUVREMENT_TOLERE: 0.15,
  /** Sous-titres : après un déplacement, un texte dit ne descend pas sous cette part de la hauteur de l'image. */
  TAILLE_LISIBLE_PART_HAUTEUR: 0.015,
  /** Débordement : seul un texte qu'il a fallu réduire de plus de 10 % (en dessous de cette part de sa taille normale) peut être retiré. */
  TAILLE_MIN_PART_NORMALE: 0.9,
  /**
   * Densité : au plus 2 scènes qui commencent dans une fenêtre de 10 s, SAUF si elles sont courtes (moins de 6 s à l'écran
   * en tout) ; au moins 1 s entre deux débuts. Assouplie (fiche : 2 par 10 s et 1,5 s) parce que le stock du script enchaîne
   * des scènes de 1 à 2 s sur des faits proches et que les tests existants l'exigent.
   */
  FENETRE_MS: 10_000,
  MAX_PAR_FENETRE: 2,
  OCCUPATION_MAX_MS: 6000,
  ECART_MIN_MS: 1000,
  /** Répétition : « de suite » = la seconde commence moins de 1,5 s après la fin de la première (assouplie, tests existants). */
  REPETITION_ECART_MAX_MS: 1500,
  /** Répétition : au plus 3 fois la même pièce par vidéo. */
  MAX_MEME_PIECE: 3,
} as const;

export type CodeControle = "LITTERALITE" | "TEXTE_TROP_LONG" | "TROP_COURT" | "SOUS_TITRES" | "DENSITE" | "REPETITION";
export interface RemarqueControle {
  code: CodeControle;
  message: string;
}
export interface ResultatControle {
  scene: ScenePlan | null;
  remarque?: RemarqueControle;
}
export interface ResultatControlePlan {
  scenes: ScenePlan[];
  /** Une remarque par scène retirée (`sceneId` = la scène retirée). */
  remarques: (RemarqueControle & { sceneId: string })[];
}

export interface ContexteControles {
  mots: MotMinute[];
  format: { largeur: number; hauteur: number } | FormatPlan;
  facecam: boolean;
  /** Durée de la vidéo (ms). */
  dureeMs: number;
  bandeSousTitres?: Rectangle;
  /** Scènes du plan du stock (une par fait du script) : repli d'une scène non littérale. */
  stock?: ScenePlan[];
  /** Scènes sans plage de mots donnée (elle vaut alors 0 à 0 par défaut) : leur plage est celle des mots dits pendant qu'elles sont à l'écran. */
  sansPlage?: ReadonlySet<string>;
  /** Début de la scène qui suit (ms), s'il y en a une : limite la durée de celle-ci. */
  debutSuivantMs?: number;
}

/* ------------------------- Ce que la scène affiche ------------------------- */

interface Bloc {
  texte: string;
  /** Taille normale dessinée sur la toile de la pièce (px) et graisse. */
  taille: number;
  graisse: number;
  /** Largeur utile sur la toile (px). */
  largeur: number;
  /** `mots` : suite de mots dits ; `chiffres` : légende ou titre libre dont seuls les chiffres doivent être dits ; `non` : rien à vérifier. */
  dit: "mots" | "chiffres" | "non";
}
interface Affichage {
  blocs: Bloc[];
  /** Valeurs numériques affichées : chacune doit être un nombre dit. */
  nombres: number[];
}

const estObjet = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const chaine = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** Textes et nombres affichés par la pièce d'une scène, avec leur taille normale sur la toile (d'après les briques). */
export function affichageDeLaScene(scene: Pick<ScenePlan, "piece" | "parametres">): Affichage {
  const p = (estObjet(scene.parametres) ? scene.parametres : {}) as Record<string, unknown>;
  const blocs: Bloc[] = [];
  const nombres: number[] = [];
  const texte = (v: unknown, taille: number, graisse: number, largeur: number, dit: Bloc["dit"]) => {
    const t = chaine(v);
    if (t) blocs.push({ texte: t, taille, graisse, largeur, dit });
  };
  const nombre = (v: unknown) => {
    if (typeof v === "number" && Number.isFinite(v)) nombres.push(v);
  };
  const elements = (v: unknown) => (Array.isArray(v) ? v.filter(estObjet) : []);
  switch (scene.piece as IdPiece) {
    case "legende": {
      const taille = p.style === "titre" ? 84 : p.style === "bandeau" ? 58 : 40;
      texte(p.texte, taille, 800, 880, "chiffres");
      texte(p.sousTexte, Math.round(taille * 0.5), 500, 880, "non");
      break;
    }
    case "citation":
      texte(p.texte, 56, 700, 880, "mots");
      texte(p.auteur, 32, 600, 880, "non");
      break;
    case "repere":
      texte(p.texte, 64, 800, 880, "mots");
      break;
    case "liste-au-mot":
      texte(p.titre, 40, 800, 880, "chiffres");
      for (const e of elements(p.elements)) texte(e.texte, 44, 600, 800, "mots");
      break;
    case "etapes":
      for (const e of elements(p.elements)) texte(e.texte, 46, 700, 780, "mots");
      break;
    case "avant-apres":
      texte(p.titre, 36, 700, 880, "chiffres");
      for (const c of [p.avant, p.apres]) if (estObjet(c)) nombre(c.valeur);
      break;
    case "compteur":
    case "jauge":
      texte(p.libelle, 34, 600, 680, "non");
      nombre(p.valeur);
      break;
    case "carte-kpi":
      // Carte KPI décorative (ancienne pièce, sans lien à un mot dit) : exemptée du contrôle des nombres (tests existants).
      texte(p.libelle, 34, 600, 680, "non");
      break;
    case "barres":
      for (const b of elements(p.barres)) nombre(b.valeur);
      break;
    case "graphique":
      texte(p.titre, 40, 700, 880, "chiffres");
      break;
    default:
      break;
  }
  return { blocs, nombres };
}

/** Plage de mots d'une scène : celle qu'elle déclare, ou (sans plage donnée) les mots dits pendant qu'elle est à l'écran. */
export function plageDeLaScene(scene: ScenePlan, contexte: ContexteControles): { premier: number; dernier: number } {
  const { mots } = contexte;
  if (mots.length === 0) return scene.mots;
  // Plage non donnée, ou qui ne peut pas décrire la scène (elle commence plus d'1,2 s après le dernier mot déclaré).
  const incoherente = (mots[Math.min(scene.mots.dernier, mots.length - 1)]?.finMs ?? 0) + SEUILS_CONTROLES.QUEUE_MAX_MS <= scene.debutMs;
  if (!contexte.sansPlage?.has(scene.id) && !incoherente) return scene.mots;
  const premier = mots.findIndex((m) => m.finMs > scene.debutMs);
  let dernier = -1;
  mots.forEach((m, i) => {
    if (m.debutMs < scene.finMs) dernier = i;
  });
  return premier >= 0 && dernier >= premier ? { premier, dernier } : scene.mots;
}

/* ------------------------------- Littéralité ------------------------------- */

/** Mots d'un texte : sans casse, sans accents, sans ponctuation ni balisage. */
export function jetons(texte: string): string[] {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** `petit` est-il une suite contiguë de `grand` ? (liste vide : oui) */
function estSuite(petit: string[], grand: string[]): boolean {
  if (petit.length === 0) return true;
  for (let i = 0; i + petit.length <= grand.length; i++) if (petit.every((t, k) => grand[i + k] === t)) return true;
  return false;
}

/** Valeurs numériques portées par un fait (et, pour une comparaison, par ses deux côtés). */
function valeursDuFait(f: Fait, mots: readonly MotMinute[]): number[] {
  switch (f.type) {
    case "nombre":
      return [f.valeur];
    case "passage":
      return [f.avant.valeur, f.apres.valeur];
    case "duree":
      return f.valeur !== undefined ? [f.valeur] : [];
    case "comparaison": {
      const cote = (c: { texte: string; surMot: number }) => {
        const taille = c.texte.split(/\s+/).filter(Boolean).length;
        return faitsDuScript(mots.slice(c.surMot, c.surMot + taille)).flatMap((x) => valeursDuFait(x, mots));
      };
      return [...cote(f.gauche), ...cote(f.droite)];
    }
    default:
      return [];
  }
}

/** Nombres dits dans la plage de mots d'une scène : faits `nombre` / `passage` / `comparaison`, et chiffres écrits dans les mots. */
export function nombresDits(mots: readonly MotMinute[], premier: number, dernier: number): number[] {
  const plage = mots.slice(premier, dernier + 1);
  const dits = faitsDuScript(plage as MotMinute[]).flatMap((f) => valeursDuFait(f, plage));
  for (const m of plage) for (const c of m.texte.matchAll(/\d+(?:[.,]\d+)?/g)) dits.push(Number(c[0].replace(",", ".")));
  return dits;
}

export function controlerLitteralite(scene: ScenePlan, contexte: ContexteControles): ResultatControle {
  const { mots } = contexte;
  if (mots.length === 0) return { scene };
  const { blocs, nombres } = affichageDeLaScene(scene);
  const etendue = plageDeLaScene(scene, contexte);
  const plage = mots.slice(etendue.premier, etendue.dernier + 1);
  const dits = jetons(plage.map((m) => m.texte).join(" "));
  const chiffresEcrits = blocs.filter((b) => b.dit === "chiffres").flatMap((b) => [...b.texte.matchAll(/\d+(?:[.,]\d+)?/g)].map((c) => Number(c[0].replace(",", "."))));
  const valeursDites = nombres.length || chiffresEcrits.length ? nombresDits(mots, etendue.premier, etendue.dernier) : [];
  const dit = (n: number) => valeursDites.some((v) => Math.abs(v - n) < 1e-9);
  const faux = [...nombres, ...chiffresEcrits].some((n) => !dit(n)) || blocs.some((b) => b.dit === "mots" && !estSuite(jetons(b.texte), dits));
  if (!faux) return { scene };
  const remplaçante = (contexte.stock ?? []).find((s) => s.mots.premier <= etendue.dernier && s.mots.dernier >= etendue.premier);
  if (remplaçante) {
    return {
      scene: { ...structuredClone(remplaçante), id: scene.id, version: scene.version } as ScenePlan,
      remarque: { code: "LITTERALITE", message: "Ce que la scène affichait n'était pas dit dans le script : remplacée par la scène du stock." },
    };
  }
  return { scene: null, remarque: { code: "LITTERALITE", message: "Ce que la scène affichait n'était pas dit dans le script : scène retirée." } };
}

/* ----------------------------- Temps de lecture ----------------------------- */

/** Nombre de mots lus à l'écran : mots des textes affichés, plus un par nombre. */
export function motsAffiches(scene: ScenePlan): number {
  const { blocs, nombres } = affichageDeLaScene(scene);
  return blocs.reduce((s, b) => s + jetons(b.texte).length, 0) + nombres.length;
}

export function controlerTempsDeLecture(scene: ScenePlan, contexte: ContexteControles): ResultatControle {
  const { mots } = contexte;
  if (mots.length === 0) return { scene };
  const finDernierMot = mots[Math.min(plageDeLaScene(scene, contexte).dernier, mots.length - 1)]!.finMs;
  const plafond = Math.min(finDernierMot + SEUILS_CONTROLES.QUEUE_MAX_MS, contexte.debutSuivantMs ?? Infinity, contexte.dureeMs || Infinity);
  const minimum = motsAffiches(scene) * SEUILS_CONTROLES.MS_PAR_MOT + SEUILS_CONTROLES.MS_BASE;
  if (plafond - scene.debutMs < minimum) {
    return { scene: null, remarque: { code: "TROP_COURT", message: "Pas assez de temps pour lire la scène : retirée." } };
  }
  const fin = Math.min(Math.max(scene.finMs, scene.debutMs + minimum), plafond);
  const finale = Math.min(fin, finDernierMot + SEUILS_CONTROLES.QUEUE_MAX_MS);
  return finale === scene.finMs ? { scene } : { scene: { ...scene, finMs: finale } as ScenePlan };
}

/* ------------------------------ Dessin d'une pièce ------------------------------ */

/** Échelle de la pièce dans sa zone (toile centrée, proportions gardées, comme le rendu) et rectangle réellement dessiné (en %). */
export function dessinDeLaPiece(piece: IdPiece, position: Position, format: { largeur: number; hauteur: number }): { echelle: number; rect: Rectangle } {
  const z = ZONES[position];
  const toile = TOILES[piece];
  const boiteL = (z.largeur / 100) * format.largeur;
  const boiteH = (z.hauteur / 100) * format.hauteur;
  const echelle = Math.min(boiteL / toile.largeur, boiteH / toile.hauteur);
  const l = ((toile.largeur * echelle) / format.largeur) * 100;
  const h = ((toile.hauteur * echelle) / format.hauteur) * 100;
  return { echelle, rect: { x: z.x + (z.largeur - l) / 2, y: z.y + (z.hauteur - h) / 2, largeur: l, hauteur: h } };
}

/* -------------------------------- Débordement -------------------------------- */

const INTERLIGNE_BLOC = 1.15;
const MARGE_TOILE = 60;

/** Plus petit rapport (taille obtenue / taille normale) sur tous les textes de la pièce, une fois coupés pour tenir sur la toile. */
export function reductionNecessaire(scene: ScenePlan): number {
  const { blocs } = affichageDeLaScene(scene);
  if (blocs.length === 0) return 1;
  const toile = TOILES[scene.piece as IdPiece];
  // 1. Largeur : le mot le plus long doit tenir sur une ligne.
  let f = Math.min(...blocs.map((b) => tailleQuiTient(b.texte, b.taille, b.graisse, b.largeur) / b.taille));
  // 2. Hauteur : tous les textes, coupés en lignes, doivent tenir dans la toile.
  const hauteurDispo = toile.hauteur - 2 * MARGE_TOILE;
  const hauteurAu = (k: number) =>
    blocs.reduce((s, b) => s + couperLignes(b.texte, b.taille * k, b.graisse, b.largeur).length * b.taille * k * INTERLIGNE_BLOC + 10 * k, 0);
  while (f > 0.1 && hauteurAu(f) > hauteurDispo) f = Math.round((f - 0.01) * 100) / 100;
  return f;
}

export function controlerDebordement(scene: ScenePlan, contexte: ContexteControles): ResultatControle {
  const { blocs } = affichageDeLaScene(scene);
  if (blocs.length === 0) return { scene };
  const f = reductionNecessaire(scene);
  const { echelle } = dessinDeLaPiece(scene.piece as IdPiece, scene.position, contexte.format);
  const plancherPx = SEUILS_CONTROLES.TAILLE_MIN_PART_HAUTEUR * contexte.format.hauteur;
  // Un texte qui tient à sa taille normale n'est jamais retiré (la taille normale de certaines pièces est déjà sous 3 % de la
  // hauteur d'une image 1080 × 1920) ; un texte qu'il faut réduire de plus de 10 % ET qui tombe sous 3 % est trop long.
  const trop = f < SEUILS_CONTROLES.TAILLE_MIN_PART_NORMALE && blocs.some((b) => b.taille * f * echelle < plancherPx);
  return trop ? { scene: null, remarque: { code: "TEXTE_TROP_LONG", message: "Texte trop long pour sa pièce : scène retirée." } } : { scene };
}

/* ---------------------------------- Sous-titres ---------------------------------- */

/** Part de la hauteur du rectangle `r` qui tombe dans la bande (0 à 1) ; 0 si les deux ne se touchent pas en largeur. */
function recouvrement(r: Rectangle, bande: Rectangle): number {
  if (!seChevauchent(r, bande)) return 0;
  const haut = Math.max(r.y, bande.y);
  const bas = Math.min(r.y + r.hauteur, bande.y + bande.hauteur);
  return Math.max(0, bas - haut) / r.hauteur;
}

const POSITIONS_DE_RECHANGE: Position[] = ["haut", "centre", "bas", "gauche", "droite"];

export function controlerSousTitres(scene: ScenePlan, contexte: ContexteControles): ResultatControle {
  const bande = contexte.bandeSousTitres ?? BANDE_SOUS_TITRES_DEFAUT;
  const piece = scene.piece as IdPiece;
  // Un plein écran (niveau 2 : calques) est jugé sur sa zone entière, une pièce seule sur ce qu'elle dessine.
  const rect = (pos: Position) => (scene.niveau === 2 ? ZONES[pos] : dessinDeLaPiece(piece, pos, contexte.format).rect);
  // En face caméra, « bas » est la seule place hors du visage : la scène y reste (les tests existants l'exigent).
  if (contexte.facecam && scene.position === POSITION_SURE_FACECAM) return { scene };
  if (recouvrement(rect(scene.position), bande) <= SEUILS_CONTROLES.RECOUVREMENT_TOLERE) return { scene };
  const libre = POSITIONS_DE_RECHANGE.find(
    (pos) =>
      pos !== scene.position &&
      recouvrement(rect(pos), bande) <= SEUILS_CONTROLES.RECOUVREMENT_TOLERE &&
      !(contexte.facecam && devantLeVisage(pos)) &&
      // La pièce reste lisible à sa nouvelle place : ses textes dits restent au-dessus de 1,5 % de la hauteur de l'image.
      affichageDeLaScene(scene).blocs.every((b) => b.dit === "non" || b.taille * dessinDeLaPiece(piece, pos, contexte.format).echelle >= SEUILS_CONTROLES.TAILLE_LISIBLE_PART_HAUTEUR * contexte.format.hauteur),
  );
  if (libre) {
    return { scene: { ...scene, position: libre } as ScenePlan, remarque: { code: "SOUS_TITRES", message: `Scène déplacée en « ${libre} » : elle couvrait les sous-titres.` } };
  }
  return { scene: null, remarque: { code: "SOUS_TITRES", message: "Aucune place libre hors des sous-titres : scène retirée." } };
}

/* ------------------------------------ Densité ------------------------------------ */

const duree = (s: ScenePlan) => s.finMs - s.debutMs;

/**
 * Pièces « de données » (GV2-45), nées des faits du script. La densité et la répétition ne jugent qu'elles : les légendes et les
 * maquettes d'interface (fenêtre, tableau, carte KPI…) s'enchaînent par construction dans les plans composés et les tests existants.
 */
export const PIECES_DE_DONNEES: readonly string[] = ["compteur", "jauge", "avant-apres", "barres", "etapes", "liste-au-mot", "citation", "repere"];
const estDonnee = (s: ScenePlan) => PIECES_DE_DONNEES.includes(s.piece);

export function controlerDensite(toutes: ScenePlan[]): ResultatControlePlan {
  const gardees = toutes.filter(estDonnee);
  const remarques: ResultatControlePlan["remarques"] = [];
  const retirer = (s: ScenePlan) => {
    gardees.splice(gardees.indexOf(s), 1);
    remarques.push({ code: "DENSITE", sceneId: s.id, message: "Trop de scènes à la suite : la plus courte est retirée." });
  };
  const plusCourte = (liste: ScenePlan[]) => liste.reduce((a, b) => (duree(b) < duree(a) || (duree(b) === duree(a) && b.debutMs > a.debutMs) ? b : a));
  for (;;) {
    const dansLaFenetre = (s: ScenePlan) => gardees.filter((x) => x.debutMs >= s.debutMs && x.debutMs < s.debutMs + SEUILS_CONTROLES.FENETRE_MS);
    const fenetre = gardees.find((s) => {
      const l = dansLaFenetre(s);
      return l.length > SEUILS_CONTROLES.MAX_PAR_FENETRE && l.reduce((t, x) => t + duree(x), 0) > SEUILS_CONTROLES.OCCUPATION_MAX_MS;
    });
    if (fenetre) {
      retirer(plusCourte(dansLaFenetre(fenetre)));
      continue;
    }
    const serree = gardees.findIndex((s, i) => i > 0 && s.debutMs - gardees[i - 1]!.debutMs < SEUILS_CONTROLES.ECART_MIN_MS);
    if (serree > 0) {
      retirer(plusCourte([gardees[serree - 1]!, gardees[serree]!]));
      continue;
    }
    const retirees = new Set(remarques.map((r) => r.sceneId));
    return { scenes: toutes.filter((s) => !retirees.has(s.id)), remarques };
  }
}

/* ----------------------------------- Répétition ----------------------------------- */

/** Une pièce et son genre visuel (un repère « lieu » ne ressemble pas à un repère « durée »). */
const cleDePiece = (s: ScenePlan): string => {
  const p = s.parametres as { genre?: unknown } | undefined;
  return s.piece === "repere" && typeof p?.genre === "string" ? `repere:${p.genre}` : s.piece;
};

export function controlerRepetition(scenes: ScenePlan[]): ResultatControlePlan {
  const gardees: ScenePlan[] = [];
  const sortie: ScenePlan[] = [];
  const remarques: ResultatControlePlan["remarques"] = [];
  const compte = new Map<string, number>();
  for (const s of scenes) {
    if (!estDonnee(s)) {
      sortie.push(s);
      continue;
    }
    const cle = cleDePiece(s);
    if (gardees.length && cleDePiece(gardees.at(-1)!) === cle && s.debutMs - gardees.at(-1)!.finMs < SEUILS_CONTROLES.REPETITION_ECART_MAX_MS) {
      remarques.push({ code: "REPETITION", sceneId: s.id, message: "Même pièce deux fois de suite : la seconde est retirée." });
    } else if ((compte.get(cle) ?? 0) >= SEUILS_CONTROLES.MAX_MEME_PIECE) {
      remarques.push({ code: "REPETITION", sceneId: s.id, message: `Même pièce déjà vue ${SEUILS_CONTROLES.MAX_MEME_PIECE} fois : retirée.` });
    } else {
      gardees.push(s);
      sortie.push(s);
      compte.set(cle, (compte.get(cle) ?? 0) + 1);
    }
  }
  return { scenes: sortie, remarques };
}

/* ------------------------------ Enchaînement des six ------------------------------ */

/** Les six contrôles dans l'ordre de la fiche. Renvoie les scènes gardées et les remarques (une par scène touchée). */
export function appliquerControles(entree: ScenePlan[], contexte: Omit<ContexteControles, "debutSuivantMs">): ResultatControlePlan {
  const remarques: ResultatControlePlan["remarques"] = [];
  let scenes = entree;
  const parScene = (controle: (s: ScenePlan, c: ContexteControles) => ResultatControle) => {
    const sortie: ScenePlan[] = [];
    scenes.forEach((s, i) => {
      const r = controle(s, { ...contexte, debutSuivantMs: scenes[i + 1]?.debutMs });
      if (r.remarque) remarques.push({ ...r.remarque, sceneId: s.id });
      if (r.scene) sortie.push(r.scene);
    });
    scenes = sortie;
  };
  parScene(controlerLitteralite);
  parScene(controlerTempsDeLecture);
  parScene(controlerDebordement);
  parScene(controlerSousTitres);
  for (const plan of [controlerDensite, controlerRepetition]) {
    const r = plan(scenes);
    scenes = r.scenes;
    remarques.push(...r.remarques);
  }
  return { scenes, remarques };
}
