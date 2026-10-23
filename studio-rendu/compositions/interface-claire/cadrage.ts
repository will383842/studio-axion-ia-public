/**
 * MISE EN PAGE du face caméra animé — fonctions PURES (aucun React, aucun état) : où est la prise, où sont les yeux, où
 * se posent les cartes, les fenêtres, les étiquettes et les sous-titres, à chaque instant. `VideoAnimee.tsx` ne fait
 * qu'APPLIQUER ces résultats ; les tests (`tests/facecam-animee/mise-en-page.test.ts`) vérifient les mêmes calculs.
 *
 * Retours de Will du 14/10 et cahier des charges de l'architecte :
 *  - quand une carte (ou une fenêtre « au-dessus », ou une étiquette) arrive, la personne DESCEND franchement (3 images,
 *    petit dépassement) et l'échelle revient à 1 en même temps (recul) ; elle remonte 1 à 2 images après la sortie ;
 *  - un objet couvre TOUT le visage ou RIEN (jamais la moitié) ;
 *  - les sous-titres ne touchent jamais les yeux ;
 *  - DÉCISION DE WILL DU 15/10 (« ça bouge trop ») : PLUS AUCUN ZOOM ni mouvement de cadrage sur la prise (échelle
 *    toujours 1, aucun décalage horizontal) ; le dynamisme vient des animations elles-mêmes. La descente reste.
 *
 * Unités : fractions de la LARGEUR (x) et de la HAUTEUR (y) de l'image, secondes. La transformation de la prise s'écrit
 * avec l'origine en HAUT À GAUCHE : point affiché = (tx, ty) + échelle × point source.
 */
import type { CalquePlan, CartePlan, ContenuCarte, FenetrePlan, PlanFacecamAnimee } from "../../../src/domaine/facecam-animee/plan";
import { GEOMETRIE, largeurTexte, TEMPS } from "./charte";
import { dans, progression, rebond, sortie } from "./mouvement";
import * as ModuleSousTitres from "./SousTitres";
import { hauteurCalcul } from "./cartes/Calcul";
import { hauteurCalendrier } from "./cartes/Calendrier";
import { hauteurChatTape } from "./cartes/ChatTape";
import { hauteurCommentaire } from "./cartes/Commentaire";
import { hauteurGraphique } from "./cartes/Graphique";
import { hauteurGrilleVignettes } from "./cartes/GrilleVignettes";
import { hauteurListeCochee } from "./cartes/ListeCochee";
import { hauteurPileLogos } from "./cartes/PileLogos";
import { hauteurStatuts } from "./cartes/Statuts";

/* ------------------------------------------------------------------ Constantes ------------------------------------------------------------------ */

/** Valeurs par défaut de la prise (copie de `PRISE_DEFAUTS` de plan.ts : le rendu n'importe que des TYPES du domaine). */
export const PRISE_PAR_DEFAUT = Object.freeze({ yeux: 0.34, centreX: 0.5, largeurVisage: 0.38 });
/** Copie de `CADRAGE_FENETRE_DEFAUT` (plan.ts). */
export const CADRAGE_FENETRE_PAR_DEFAUT = "sur-le-visage" as const;

/** Boîte du visage autour des yeux (fractions de H à l'échelle 1) : haut des cheveux, haut du front, menton ; marge en largeur. */
export const VISAGE = Object.freeze({ cheveux: 0.2, front: 0.12, menton: 0.22, margeLargeur: 1.2 });

/**
 * Carte : 0,81 L, de 0,13 H à au moins 0,465 H (référence : la carte finit à 0,465). En-tête 0,04 H. Bas au plus à 0,50 H
 * (yeux à 0,62 H au plus pendant la carte) : un contenu plus haut est RÉDUIT pour tenir (Carte.tsx), jamais coupé.
 */
export const CARTE = Object.freeze({ x: GEOMETRIE.carteX, y: GEOMETRIE.carteY, l: GEOMETRIE.carteL, hMin: 0.335, basMax: 0.5, entete: GEOMETRIE.enteteH });

/** Fenêtre « sur-le-visage » (défaut) : de 0,05 à 0,86 L, de 0,12 à 0,69 H (≈ 4:5) ; agrandie si le visage dépasse (bas ≤ 0,72). */
export const FENETRE_SUR_VISAGE = Object.freeze({ x0: 0.05, x1: 0.86, y0: 0.12, y1: 0.69, y1Max: 0.72, marge: 0.012 });
/** Fenêtre « au-dessus » : paysage 0,81 L × 0,30 H, posée comme une carte. */
export const FENETRE_AU_DESSUS = Object.freeze({ x0: GEOMETRIE.carteX, l: GEOMETRIE.carteL, y0: GEOMETRIE.carteY, h: 0.3 });

/**
 * FIN SUR LE VISAGE (revue finale du 14/10) : panneau de la taille d'une carte (0,81 L, de 0,13 à 0,47 H) ; la prise
 * descend dessous comme pour une carte, Will reste à l'écran jusqu'au bout (plus d'écran ivoire plein).
 */
export const FIN_SUR_VISAGE = Object.freeze({ x0: GEOMETRIE.carteX, x1: GEOMETRIE.carteX + GEOMETRIE.carteL, y0: GEOMETRIE.carteY, y1: 0.47 });

/** Descente de la prise (images à la cadence du plan). */
export const DESCENTE = Object.freeze({
  /** Yeux affichés = bas de l'objet + 0,12 H (référence : yeux 0,577-0,60 sous une carte finissant à 0,465). */
  yeuxSousObjet: 0.12,
  max: 0.42,
  images: 3,
  /** Force du dépassement (courbe « back out ») : ≈ 6 % de dépassement, sous les 8 % permis. */
  force: 1.3,
  imagesRemontee: 3.5,
  /** La remontée commence 1 à 2 images après la sortie de l'objet. */
  imagesRetard: 1.5,
  /** Deux objets à moins de 0,3 s l'un de l'autre : la prise ne remonte pas entre les deux. */
  enchainement: 0.3,
  /** Descente minimale à l'arrivée d'une étiquette (mouvement franc, jamais un tressautement). */
  minCalque: 0.06,
  /** Espace entre le bas d'une étiquette et le haut des cheveux. */
  margeCalque: 0.01,
});

/** Mouvements de cadrage. */
export const ZOOM = Object.freeze({ max: 1.5, imagesRapide: 7, forceRapide: 1.6, baseRecul: 1.04, decaleMin: 1.25, decaleMax: 1.4, visageGauche: 0.35, visageDroite: 0.65 });

/**
 * Sous-titres (centre, fraction de H). `menton` : bas du visage − yeux, en LARGEURS DE VISAGE (mesuré au détecteur YuNet :
 * médiane 0,87-0,89 sur la référence et sur Will, 95 % des images sous 0,97 ; 0,95 retenu par prudence). Le haut de la
 * bande se pose `margeMenton` sous le menton affiché (zoom et poussée compris), jamais plus haut que `hors`.
 */
export const SOUS_TITRES = Object.freeze({ hors: 0.64, menton: 0.95, margeMenton: 0.03, max: 0.84, sousObjet: 0.03, sousFenetreVisage: 0.035, gardeYeux: 0.03 });

/** Étiquettes : marge au bord ≥ 0,04 L (le dépassement du « pop » compris). */
export const ETIQUETTES = Object.freeze({ marge: 0.04, largeurMax: 0.9, depassementPop: 1.1, inclinaison: 3 });

/** Hauteur de la bande des sous-titres (fraction de H) : constante de SousTitres.tsx quand elle existe, 0,0563 sinon. */
export function hauteurSousTitres(): number {
  const h = (ModuleSousTitres as unknown as { HAUTEUR_SOUS_TITRES?: number }).HAUTEUR_SOUS_TITRES;
  return typeof h === "number" && h > 0 ? h : 0.0563;
}

const borne = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const contourPx = (W: number) => Math.max(3, Math.round(GEOMETRIE.contourL * W));

/* ------------------------------------------------------------------ Types ------------------------------------------------------------------ */

/** Rectangle en fractions (x de la largeur, y de la hauteur). */
export type Rect = { x0: number; y0: number; x1: number; y1: number };
export type Phase = "entree" | "pose" | "sortie";
export type GenreObjet = "carte" | "fenetre-dessus" | "fenetre-visage" | "calque" | "fin";

export type ObjetScene = {
  genre: GenreObjet;
  /** Rang dans sa liste du plan (cartes, fenêtres ou calques). */
  index: number;
  debut: number;
  fin: number;
  /** Emprise une fois posé (sans animation). */
  rect: Rect;
  /** Poussée de la prise visée pendant l'objet (fraction de H). */
  cible: number;
  /** Durées d'entrée et de sortie de l'objet (secondes) : hors de ces instants il est « posé ». */
  dureeEntree: number;
  dureeSortie: number;
};

/** Mesures d'une étiquette (pixels) pour le rendu. */
export type MesureCalque = { taille: number; tailleLegende?: number; x: number; y: number };

type Changement = { t: number; pDe: number; pVers: number; kDe: number; kVers: number };

export type Scene = {
  plan: PlanFacecamAnimee;
  fps: number;
  W: number;
  H: number;
  yeux: number;
  centreX: number;
  largeurVisage: number;
  cartes: ObjetScene[];
  fenetres: ObjetScene[];
  calques: ObjetScene[];
  mesuresCalques: MesureCalque[];
  objets: ObjetScene[];
  changements: Changement[];
};

/* ------------------------------------------------------------------ Cartes ------------------------------------------------------------------ */

const hLigne = (H: number) => H * 0.05;

/** Hauteur du CONTENU d'une carte (px), selon son type, au grossissement `g` (1 : taille de la charte). */
export function hauteurContenu(c: ContenuCarte, W: number, H0: number, g = 1): number {
  const H = H0 * g;
  switch (c.type) {
    case "frise":
      return c.etapes.length * H * 0.056;
    case "chat":
      return hauteurChatTape(hLigne(H), c.reponse.lignes ?? 2);
    case "grille":
      return hauteurGrilleVignettes(H * 0.1, c.vignettes.length, c.colonnes ?? 2);
    case "liste":
      return hauteurListeCochee(hLigne(H), c.lignes.length, !!c.entete, !!c.badge);
    case "calendrier":
      return hauteurCalendrier(hLigne(H), c.rangees, !!c.rangee?.length);
    case "graphique":
      return hauteurGraphique(hLigne(H), H * 0.15, c.barres.some((b) => b.libelle), !!c.pastilles?.length);
    case "statuts":
      return hauteurStatuts(H * 0.055, Math.min(4, c.lignes.length));
    case "calcul":
      return hauteurCalcul(H * 0.04, Math.max(c.avant.lignes.length, c.apres.lignes.length));
    case "logos":
      return hauteurPileLogos(W * 0.11 * g, c.tuiles.length, 5);
    case "commentaire":
      return hauteurCommentaire(H * 0.045, !!c.publication);
  }
}

/** Grossissement maximal du contenu par type (au-delà, les textes ou les tuiles déborderaient en largeur). */
export const GROSSISSEMENT_MAX: Record<ContenuCarte["type"], number> = { liste: 1.6, frise: 1.6, statuts: 1.5, calendrier: 2.2, graphique: 1.45, grille: 1.8, chat: 1.3, commentaire: 1.6, calcul: 1.3, logos: 1.35 };
/** Part visée de la hauteur utile de la carte remplie par son contenu (revue finale du 14/10 : 70 % au moins). */
export const REMPLISSAGE_VISE = 0.92;

/**
 * Grossissement du CONTENU d'une carte (≥ 1) : un contenu court est AGRANDI (la carte, elle, garde sa taille) pour remplir
 * ≈ 92 % de la hauteur utile — plus de carte à moitié vide (revue finale : « Bureau du soir », « Bilan », « Réservation »).
 * Les hauteurs du contenu sont proportionnelles à ce facteur (les fonctions `hauteurXxx` sont linéaires). Une garde de
 * LARGEUR empêche un texte de sortir de la carte (liste, statuts).
 */
export function grossissementContenu(c: ContenuCarte, W: number, H: number, hauteurCarte: number): number {
  const place = hauteurCarte * H - CARTE.entete * H * 1.9 - 12;
  const base = hauteurContenu(c, W, H);
  if (base <= 0) return 1;
  let g = borne((REMPLISSAGE_VISE * place) / base, 1, GROSSISSEMENT_MAX[c.type]);
  const dispo = (CARTE.l - 0.06) * W;
  const tient = (x: number): boolean => {
    if (c.type === "liste") {
      const u = hLigne(H) * x;
      return Math.max(...c.lignes.map((l) => largeurTexte(l.texte, u * 0.36)), c.entete ? largeurTexte(c.entete.texte, u * 0.36, 0.5) + u * 0.6 : 0) + u * 1.66 <= dispo;
    }
    if (c.type === "logos") {
      // 5 colonnes de tuiles (côté 0,11 L × g, écart 0,22 côté) dans la largeur utile de la carte.
      const cote = W * 0.11 * x;
      return 5 * cote + 4 * cote * 0.22 <= dispo;
    }
    if (c.type === "grille") {
      // Revue du 14/10 (remplissage ≥ 70 %) : vignettes plus hautes, tant que la plus longue légende tient dans sa colonne.
      const colonnes = c.colonnes ?? 2;
      const h = H * 0.1 * x;
      const colonne = (dispo - (colonnes - 1) * h * 0.16) / colonnes;
      // La légende se réduit seule pour tenir dans sa colonne (GrilleVignettes) : elle doit rester lisible (≥ 0,024 L).
      return h <= colonne * 1.15 && Math.min(...c.vignettes.map((v) => Math.min(h * 0.13, colonne / largeurTexte(v.legende, 1)))) >= W * 0.024;
    }
    if (c.type === "calendrier") {
      // Pastilles (0,66 de la hauteur de ligne) dans leur colonne de jour, avec une marge.
      return hLigne(H) * x * 0.66 * 1.15 <= dispo / c.jours.length;
    }
    if (c.type === "commentaire") {
      // Champ (mot-clé tapé) + bouton sur une ligne.
      const T = H * 0.045 * x;
      return largeurTexte(c.saisie.texte, T * 0.36) + T * 0.6 + largeurTexte(c.bouton.texte, T * 0.26, 0.5) + T * 0.32 + T * 0.48 + T * 0.16 <= dispo;
    }
    if (c.type === "statuts") {
      const h = H * 0.055 * x;
      return Math.max(...c.lignes.map((l) => largeurTexte(l.nom, h * 0.3))) + h * 3.2 + largeurTexte(c.apres.texte, h * 0.22, 0.4) <= dispo;
    }
    return true;
  };
  for (let i = 0; i < 60 && g > 1 && !tient(g); i++) g = Math.max(1, g - 0.02);
  return g;
}

/**
 * Hauteur d'une carte (fraction de H) : au moins 0,335 H (elle « prend de la place » même vide), au plus ce que permet la
 * descente plafonnée (bas ≤ yeux + 0,42 − 0,12) : au-delà, le visage passerait sous la carte.
 */
export function hauteurCarteFraction(c: CartePlan, W: number, H: number, yeux: number = PRISE_PAR_DEFAUT.yeux): number {
  const contenu = (CARTE.entete * H * 1.9 + hauteurContenu(c.contenu, W, H) + 12) / H;
  const max = Math.min(CARTE.basMax, yeux + DESCENTE.max - DESCENTE.yeuxSousObjet) - CARTE.y;
  return Math.min(Math.max(CARTE.hMin, max), Math.max(CARTE.hMin, contenu));
}

/* ------------------------------------------------------------------ Étiquettes ------------------------------------------------------------------ */

/** Boîte (px, non tournée) d'une étiquette `Etiquette` (elements.tsx) à la taille `t`. */
export function boiteEtiquette(texte: string, sousTexte: string | undefined, nbIcones: number, t: number, W: number): { l: number; h: number } {
  const pad = Math.round(t * 0.38);
  const c = contourPx(W);
  const gap = Math.round(t * 0.35);
  const texteL = Math.max(largeurTexte(texte, t, 0.5), sousTexte ? largeurTexte(sousTexte, t * 0.62) : 0);
  const l = 2 * pad + 2 * c + nbIcones * (t * 1.6 + gap) + texteL;
  const h = Math.max(nbIcones ? t * 1.6 : 0, t * 1.02 + (sousTexte ? t * 0.62 * 1.02 : 0)) + 2 * Math.round(pad * 0.55) + 2 * c;
  return { l, h };
}

/** Largeur et hauteur d'une boîte tournée de `deg` degrés. */
function tournee(l: number, h: number, deg: number) {
  const a = (Math.abs(deg) * Math.PI) / 180;
  return { l: l * Math.cos(a) + h * Math.sin(a), h: l * Math.sin(a) + h * Math.cos(a) };
}

/** Plus grande taille ≤ `max` telle que `largeur(taille)` tienne dans `dispo` (réduction automatique, par pas de 1 %). */
function ajuster(max: number, dispo: number, largeur: (t: number) => number): number {
  let t = max;
  for (let i = 0; i < 400 && largeur(t) > dispo; i++) t *= 0.99;
  return t;
}

const formatNombre = (v: number) => Math.round(v).toLocaleString("fr-FR");

/**
 * Taille, position et emprise d'un calque : jamais hors cadre (marge ≥ 0,04 L, dépassement du « pop » compris) — un texte
 * trop long est RÉDUIT. Emprise en fractions, inclinaison comprise, à l'échelle 1 (posé).
 */
export function mesurerCalque(c: CalquePlan, W: number, H: number): { mesure: MesureCalque; rect: Rect } {
  const dispo = W * (1 - 2 * ETIQUETTES.marge);
  const dispoPop = W / ETIQUETTES.depassementPop;
  const lim = Math.min(dispo, dispoPop);
  const rectCentre = (x: number, y: number, l: number, h: number, deg: number): Rect => {
    const r = tournee(l, h, deg);
    return { x0: (x - r.l / 2) / W, x1: (x + r.l / 2) / W, y0: (y - r.h / 2) / H, y1: (y + r.h / 2) / H };
  };
  switch (c.type) {
    case "etiquette": {
      const nb = c.icones?.length ?? 0;
      const taille = ajuster(W * 0.058, lim, (t) => {
        const b = boiteEtiquette(c.texte, c.sousTexte, nb, t, W);
        return tournee(b.l, b.h, ETIQUETTES.inclinaison).l;
      });
      const b = boiteEtiquette(c.texte, c.sousTexte, nb, taille, W);
      const x = W / 2;
      const y = H * 0.085;
      return { mesure: { taille, x, y }, rect: rectCentre(x, y, b.l, b.h, ETIQUETTES.inclinaison) };
    }
    case "compteur": {
      const texte = `${c.prefixe ?? ""}${formatNombre(Math.max(Math.abs(c.de), Math.abs(c.a)) * (c.a < 0 || c.de < 0 ? -1 : 1))}${c.suffixe ?? ""}`;
      const boite = (t: number) => {
        const l = t * 0.8 + Math.max(largeurTexte(texte, t), c.legende ? largeurTexte(c.legende, t * 0.34) : 0) + 2 * contourPx(W);
        const h = t + (c.legende ? t * 0.42 : 0) + t * 0.36 + 2 * contourPx(W);
        return { l, h };
      };
      const taille = ajuster(W * 0.08, lim, (t) => tournee(boite(t).l, boite(t).h, ETIQUETTES.inclinaison).l);
      const b = boite(taille);
      const x = W / 2;
      const y = H * 0.085;
      return { mesure: { taille, x, y }, rect: rectCentre(x, y, b.l, b.h, ETIQUETTES.inclinaison) };
    }
    case "glisse": {
      const boite = (t: number) => ({ l: t * 1.1 + (c.icone ? t * 1.1 + 10 : 0) + largeurTexte(c.texte, t) + 2 * contourPx(W), h: t * 1.25 + t * 0.6 + 2 * contourPx(W) });
      const taille = ajuster(Math.round(W * 0.034), W * (1 - 0.05 - ETIQUETTES.marge) - 4, (t) => tournee(boite(t).l, boite(t).h, 3).l);
      const b = boite(taille);
      const r = tournee(b.l, b.h, 3);
      const x1 = W * 0.95;
      const y = H * 0.06;
      return { mesure: { taille, x: x1, y }, rect: { x0: (x1 - r.l) / W, x1: x1 / W, y0: y / H - (r.h - b.h) / 2 / H, y1: (y + b.h) / H + (r.h - b.h) / 2 / H } };
    }
    case "logos": {
      const n = c.logos.length;
      const cote = Math.min(Math.round(W * 0.11), lim / (n + (n - 1) * 0.22));
      const l = n * cote + (n - 1) * cote * 0.22;
      const x = W / 2;
      const y = H * 0.075;
      return { mesure: { taille: cote, x, y }, rect: rectCentre(x, y, l * 1.03, cote * 1.08, 0) };
    }
    case "tuile": {
      const cote = Math.round(W * 0.12);
      const x0 = W * 0.06;
      const legendeL = (f: number) => largeurTexte(c.legende, f) + 20 + 2 * contourPx(W);
      const tailleLegende = ajuster(cote * 0.17, W * (1 - ETIQUETTES.marge) - x0 - 8, (f) => tournee(Math.max(cote, legendeL(f)), cote, 4).l);
      const l = Math.max(cote, legendeL(tailleLegende));
      const h = cote + 8 + tailleLegende * 1.2 + 4 + 2 * contourPx(W);
      const r = tournee(l, h, 4);
      const y0 = H * 0.05;
      return { mesure: { taille: cote, tailleLegende, x: x0, y: y0 }, rect: { x0: (x0 - (r.l - l) / 2) / W, x1: (x0 + l + (r.l - l) / 2) / W, y0: (y0 - (r.h - h) / 2) / H, y1: (y0 + h + (r.h - h) / 2) / H } };
    }
  }
}

/** Taille de l'étiquette posée sur une fenêtre : GRANDE (≈ 0,70-0,78 de la largeur de la fenêtre), police ≈ 0,055 L. */
export function tailleEtiquetteFenetre(texte: string, largeurFenetrePx: number, W: number): number {
  const vise = 0.74 * largeurFenetrePx;
  const parUnite = largeurTexte(texte, 1) + 1.0; // texte + marges intérieures (0,5 × taille de chaque côté)
  const t = (vise - 2 * contourPx(W)) / parUnite;
  return borne(t, W * 0.032, W * 0.075);
}

/** Largeur (px) de l'étiquette de fenêtre à la taille `taille`. */
export const largeurEtiquetteFenetre = (texte: string, taille: number, W: number) => largeurTexte(texte, taille) + taille + 2 * contourPx(W);

/* ------------------------------------------------------------------ Fenêtres ------------------------------------------------------------------ */

export const cadrageFenetre = (f: FenetrePlan) => f.cadrage ?? CADRAGE_FENETRE_PAR_DEFAUT;

/** Boîte du visage dans la prise au repos (échelle 1, sans descente), mode « cheveux » (yeux − 0,20 → yeux + 0,22). */
function boiteVisageRepos(yeux: number, centreX: number, largeurVisage: number): Rect {
  const demi = (largeurVisage / 2) * VISAGE.margeLargeur;
  return { x0: centreX - demi, x1: centreX + demi, y0: yeux - VISAGE.cheveux, y1: yeux + VISAGE.menton };
}

/**
 * Emprise d'une fenêtre « sur-le-visage » : la boîte du visage (cheveux → menton, largeur × 1,2) est ENTIÈREMENT dedans ;
 * sinon la fenêtre est agrandie (haut, côtés) ou abaissée (bas jusqu'à 0,72 H au plus).
 */
export function rectFenetreVisage(yeux: number, centreX: number, largeurVisage: number): Rect {
  const v = boiteVisageRepos(yeux, centreX, largeurVisage);
  const m = FENETRE_SUR_VISAGE.marge;
  const y0 = Math.max(0.02, Math.min(FENETRE_SUR_VISAGE.y0, v.y0 - m));
  // Hauteur visée ≈ 0,57 H (référence : 0,81 L × 0,56 H) : si le haut remonte (visage haut), le bas remonte d'autant,
  // tant que le menton reste dedans.
  const hauteurVisee = FENETRE_SUR_VISAGE.y1 - FENETRE_SUR_VISAGE.y0;
  return {
    x0: Math.max(0.02, Math.min(FENETRE_SUR_VISAGE.x0, v.x0 - m)),
    x1: Math.min(0.98, Math.max(FENETRE_SUR_VISAGE.x1, v.x1 + m)),
    y0,
    y1: Math.min(FENETRE_SUR_VISAGE.y1Max, Math.max(y0 + hauteurVisee, v.y1 + m)),
  };
}

export const rectFenetreDessus = (): Rect => ({ x0: FENETRE_AU_DESSUS.x0, x1: FENETRE_AU_DESSUS.x0 + FENETRE_AU_DESSUS.l, y0: FENETRE_AU_DESSUS.y0, y1: FENETRE_AU_DESSUS.y0 + FENETRE_AU_DESSUS.h });

/* ------------------------------------------------------------------ Animations des objets ------------------------------------------------------------------ */

export type AnimationObjet = { dx: number; dy: number; rotation: number; echelle: number; phase: Phase };

/** Animation d'une carte (dx en fraction de L, dy en fraction de H). Chute : petit rebond (force 1,2, ≈ 5 % du trajet). */
export function animationCarte(t: number, debut: number, fin: number, rect: Rect, sens: "chute" | "glisse" | "surgit" = "chute"): AnimationObjet {
  const e = rebond(t, debut, TEMPS.entreeCarte, 1.2);
  const s = sortie(t, fin - TEMPS.sortieCarte, TEMPS.sortieCarte);
  const dy = (sens === "chute" ? -(rect.y1 + 0.02) * (1 - e) : 0) - (rect.y1 + 0.03) * s;
  const dx = sens === "glisse" ? (1 - e) * 1.1 : 0;
  const echelle = sens === "surgit" ? 0.3 + 0.7 * e : 1;
  const rotation = (sens === "glisse" ? 6 * (1 - e) : sens === "surgit" ? -3 * (1 - e) : -4 * (1 - e)) + 3 * s;
  const phase: Phase = t < debut + TEMPS.entreeCarte ? "entree" : t >= fin - TEMPS.sortieCarte ? "sortie" : "pose";
  return { dx, dy, rotation, echelle, phase };
}

/** Animation d'une fenêtre : entre par la droite inclinée de −14° en 5-6 images (ou par le bas, ou en zoom), sort par la gauche. */
export function animationFenetre(t: number, debut: number, fin: number, sens: "droite" | "bas" | "zoom" = "droite"): AnimationObjet {
  const e = rebond(t, debut, TEMPS.entreeFenetre, 1.15);
  const s = sortie(t, fin - TEMPS.sortieFenetre, TEMPS.sortieFenetre);
  const dx = (sens === "droite" ? (1 - e) * 0.95 : 0) - s * 1.15;
  const dy = sens === "bas" ? (1 - e) * 0.6 : 0;
  const rotation = (sens === "zoom" ? 0 : sens === "bas" ? 10 : -14) * (1 - e) - 6 * s;
  const echelle = sens === "zoom" ? 0.2 + 0.8 * e : 0.88 + 0.12 * e;
  const phase: Phase = t < debut + TEMPS.entreeFenetre ? "entree" : t >= fin - TEMPS.sortieFenetre ? "sortie" : "pose";
  return { dx, dy, rotation, echelle, phase };
}

/** Phase d'un calque (pop d'entrée 0,17 s, sortie 0,12 s). */
export const phaseCalque = (t: number, debut: number, fin: number): Phase => (t < debut + TEMPS.pop ? "entree" : t >= fin - 0.12 ? "sortie" : "pose");

/** Emprise animée (sans la rotation) d'un objet à l'instant t. */
export function rectAnime(o: ObjetScene, t: number, plan: PlanFacecamAnimee): { rect: Rect; phase: Phase } {
  if (o.genre === "calque") return { rect: o.rect, phase: phaseCalque(t, o.debut, o.fin) };
  if (o.genre === "fin") return { rect: o.rect, phase: t < o.debut + o.dureeEntree ? "entree" : "pose" };
  const a = o.genre === "carte" ? animationCarte(t, o.debut, o.fin, o.rect, plan.cartes[o.index].entree) : animationFenetre(t, o.debut, o.fin, plan.fenetres[o.index].entree);
  const r = o.rect;
  const cx = (r.x0 + r.x1) / 2;
  const cy = o.genre === "carte" ? r.y0 : (r.y0 + r.y1) / 2; // la carte grossit depuis son bord haut
  const sc = (v: number, c: number) => c + (v - c) * a.echelle;
  return { rect: { x0: sc(r.x0, cx) + a.dx, x1: sc(r.x1, cx) + a.dx, y0: sc(r.y0, cy) + a.dy, y1: sc(r.y1, cy) + a.dy }, phase: a.phase };
}

/* ------------------------------------------------------------------ Scène ------------------------------------------------------------------ */

/**
 * Prépare la scène : emprises des objets, poussées visées, et les CHANGEMENTS de poussée et de présence (instants où la
 * prise descend, change de niveau ou remonte). Calculée une fois par plan.
 */
export function preparerScene(plan: PlanFacecamAnimee): Scene {
  const W = plan.largeur;
  const H = plan.hauteur;
  const fps = plan.fps;
  const yeux = plan.prise.yeux ?? PRISE_PAR_DEFAUT.yeux;
  const centreX = plan.prise.centreX ?? PRISE_PAR_DEFAUT.centreX;
  const largeurVisage = plan.prise.largeurVisage ?? PRISE_PAR_DEFAUT.largeurVisage;
  const cibleSous = (bas: number) => borne(bas + DESCENTE.yeuxSousObjet - yeux, 0, DESCENTE.max);

  const cartes: ObjetScene[] = plan.cartes.map((c, index) => {
    const rect = { x0: CARTE.x, x1: CARTE.x + CARTE.l, y0: CARTE.y, y1: CARTE.y + hauteurCarteFraction(c, W, H, yeux) };
    return { genre: "carte", index, debut: c.debut, fin: c.fin, rect, cible: cibleSous(rect.y1), dureeEntree: TEMPS.entreeCarte, dureeSortie: TEMPS.sortieCarte };
  });
  const fenetres: ObjetScene[] = plan.fenetres.map((f, index) => {
    const visage = cadrageFenetre(f) === "sur-le-visage";
    const rect = visage ? rectFenetreVisage(yeux, centreX, largeurVisage) : rectFenetreDessus();
    return { genre: visage ? "fenetre-visage" : "fenetre-dessus", index, debut: f.debut, fin: f.fin, rect, cible: visage ? 0 : cibleSous(rect.y1), dureeEntree: TEMPS.entreeFenetre, dureeSortie: TEMPS.sortieFenetre };
  });
  const mesures = plan.calques.map((c) => mesurerCalque(c, W, H));
  const calques: ObjetScene[] = plan.calques.map((c, index) => {
    const rect = mesures[index].rect;
    // Le haut des cheveux (yeux − 0,20 × échelle) reste sous l'étiquette, dépassement du « pop » compris. Les zooms
    // CONTINUENT pendant une étiquette (variété demandée par Will) : la descente tient compte du plus fort d'entre eux.
    const bas = rect.y1 + ((rect.y1 - rect.y0) * (ETIQUETTES.depassementPop - 1)) / 2;
    let eMax = 1;
    for (let t = c.debut; t < c.fin; t += 1 / fps) eMax = Math.max(eMax, zoomDemande(plan, t, fps).echelle);
    const cible = borne(Math.max(DESCENTE.minCalque, bas + DESCENTE.margeCalque + VISAGE.cheveux * eMax - yeux), 0, DESCENTE.max);
    return { genre: "calque", index, debut: c.debut, fin: c.fin, rect, cible, dureeEntree: TEMPS.pop, dureeSortie: 0.12 };
  });
  // La fin est un objet comme une carte (la prise descend dessous) qui reste jusqu'au bout de la vidéo.
  const rectFin = { ...FIN_SUR_VISAGE };
  const fin: ObjetScene = { genre: "fin", index: -1, debut: plan.fin.debut, fin: plan.duree + 1, rect: rectFin, cible: cibleSous(rectFin.y1), dureeEntree: TEMPS.entreeCarte, dureeSortie: 0 };
  const objets = [...[...cartes, ...fenetres, ...calques].filter((o) => o.debut < plan.fin.debut && o.fin > o.debut), ...(plan.fin.debut < plan.duree ? [fin] : [])].sort((a, b) => a.debut - b.debut || a.fin - b.fin);

  // Segments : objets enchaînés (≤ 0,3 s d'écart) → la prise ne remonte pas entre eux.
  const retard = DESCENTE.imagesRetard / fps;
  type Tenue = { o: ObjetScene; jusqua: number };
  const tenues: Tenue[] = [];
  let i = 0;
  while (i < objets.length) {
    const seg = [objets[i]];
    let finSeg = objets[i].fin;
    let j = i + 1;
    while (j < objets.length && objets[j].debut <= finSeg + DESCENTE.enchainement) {
      seg.push(objets[j]);
      finSeg = Math.max(finSeg, objets[j].fin);
      j++;
    }
    seg.forEach((o, k) => {
      const suivant = seg[k + 1];
      tenues.push({ o, jusqua: o.fin >= finSeg ? finSeg + retard : Math.max(o.fin, suivant ? suivant.debut : o.fin) });
    });
    i = j;
  }
  const niveau = (t: number) => {
    const actifs = tenues.filter((x) => t >= x.o.debut && t < x.jusqua);
    // Présence (retour de l'échelle à 1) : cartes et fenêtres seulement ; une étiquette laisse les zooms jouer.
    return { p: actifs.length ? Math.max(...actifs.map((x) => x.o.cible)) : 0, k: actifs.some((x) => x.o.genre !== "calque") ? 1 : 0 };
  };
  const instants = [...new Set(tenues.flatMap((x) => [x.o.debut, x.jusqua]))].sort((a, b) => a - b);
  const changements: Changement[] = [];
  let avant = { p: 0, k: 0 };
  for (const t of instants) {
    const apres = niveau(t);
    if (apres.p === avant.p && apres.k === avant.k) continue;
    // Valeur animée au moment du changement (continuité si le précédent n'est pas fini).
    const courant = changements.length ? valeurAnimee(changements, t, fps) : { p: 0, k: 0 };
    changements.push({ t, pDe: courant.p, pVers: apres.p, kDe: courant.k, kVers: apres.k });
    avant = apres;
  }
  return { plan, fps, W, H, yeux, centreX, largeurVisage, cartes, fenetres, calques, mesuresCalques: mesures.map((m) => m.mesure), objets, changements };
}

/** Poussée (p) et présence d'objet (k) animées à l'instant t. */
function valeurAnimee(ch: Changement[], t: number, fps: number): { p: number; k: number } {
  let c: Changement | undefined;
  for (const x of ch) {
    if (x.t <= t) c = x;
    else break;
  }
  if (!c) return { p: 0, k: 0 };
  const u = t - c.t;
  const desc = DESCENTE.images / fps;
  const rem = DESCENTE.imagesRemontee / fps;
  const p = c.pVers >= c.pDe ? c.pDe + (c.pVers - c.pDe) * rebond(u, 0, desc, DESCENTE.force) : c.pDe + (c.pVers - c.pDe) * (1 - Math.pow(1 - progression(u, 0, rem), 3));
  const k = c.kVers >= c.kDe ? c.kDe + (c.kVers - c.kDe) * progression(u, 0, desc) : c.kDe + (c.kVers - c.kDe) * progression(u, 0, rem);
  return { p, k };
}

const caches = new WeakMap<object, Scene>();
/** Scène d'un plan (mise en cache par plan). */
export function scene(plan: PlanFacecamAnimee | Scene): Scene {
  if ("changements" in plan) return plan;
  let s = caches.get(plan);
  if (!s) {
    s = preparerScene(plan);
    caches.set(plan, s);
  }
  return s;
}

/* ------------------------------------------------------------------ Prise ------------------------------------------------------------------ */

/**
 * DÉCISION DE WILL DU 15/10 (« il faut supprimer le zoom car ça bouge trop ») : AUCUN zoom ni mouvement de cadrage sur
 * sa prise. Le rendu IGNORE `plan.zooms` et `plan.mouvements` (un ancien plan qui en contient se rend sans zoom) ; le
 * contrôle du plan les refuse (`realisateur/regles.ts`). Seule la DESCENTE à l'arrivée d'une carte, d'une fenêtre
 * « au-dessus » ou d'une étiquette reste (ce n'est pas un zoom : la prise glisse vers le bas, à l'échelle 1).
 */
export const ZOOMS_AUTORISES = false;

/** Échelle « de base » de la prise et position horizontale visée du visage : toujours 1 et le visage en place (15/10). */
export function zoomDemande(plan: PlanFacecamAnimee, t: number, fps: number): { echelle: number; visageX: number } {
  if (!ZOOMS_AUTORISES) return { echelle: 1, visageX: (plan.prise.centreX ?? PRISE_PAR_DEFAUT.centreX) };
  return zoomDemandeAncien(plan, t, fps);
}

/** Ancien calcul (zooms coupés et mouvements), gardé pour mémoire et pour les tests de non-régression ; JAMAIS appelé au rendu. */
function zoomDemandeAncien(plan: PlanFacecamAnimee, t: number, fps: number): { echelle: number; visageX: number } {
  const coupe = plan.zooms.find(([a, b]) => dans(t, a, b))?.[2] ?? 1;
  const m = (plan.mouvements ?? []).find((x) => dans(t, x.debut, x.fin));
  let em = 1;
  let visageX = 0.5;
  if (m) {
    const duree = ZOOM.imagesRapide / fps;
    const p = rebond(t, m.debut, duree, ZOOM.forceRapide);
    switch (m.type) {
      case "zoom-rapide":
        em = 1 + (m.echelle - 1) * p;
        break;
      case "recul":
        em = ZOOM.baseRecul + (m.echelle - ZOOM.baseRecul) * (1 - p);
        break;
      case "decale-gauche":
      case "decale-droite":
        em = borne(m.echelle, ZOOM.decaleMin, ZOOM.decaleMax);
        visageX = m.type === "decale-gauche" ? ZOOM.visageGauche : ZOOM.visageDroite;
        break;
    }
  }
  return { echelle: borne(Math.max(coupe, em), 1, ZOOM.max), visageX };
}

/**
 * Transformation de la prise à l'instant t : point affiché = (tx, ty) + échelle × point source (fractions, origine en haut
 * à gauche). Zoom centré sur le VISAGE ; recentrage horizontal borné (jamais de bord noir) ; descente quand un objet est
 * là, avec retour simultané de l'échelle à 1.
 */
export function transformPrise(p: PlanFacecamAnimee | Scene, t: number): { echelle: number; tx: number; ty: number } {
  const s = scene(p);
  const { echelle: z, visageX } = zoomDemande(s.plan, t, s.fps);
  const v = valeurAnimee(s.changements, t, s.fps);
  const k = borne(v.k, 0, 1);
  const pousse = borne(v.p, 0, DESCENTE.max);
  const e = 1 + (z - 1) * (1 - k);
  // Sans zoom (e = 1) : tx = 0 — la prise ne bouge JAMAIS horizontalement (décision de Will du 15/10).
  const tx = e === 1 ? 0 : borne(s.centreX * (1 - e) + (visageX - s.centreX), 1 - e, 0);
  const ty = s.yeux * (1 - e) + pousse;
  return { echelle: e, tx, ty };
}

/** Hauteur (fraction de H) de la bande ivoire qui couvre le haut quand la prise est descendue (jamais de bord noir). */
export function hauteurBande(p: PlanFacecamAnimee | Scene, t: number): number {
  const { ty } = transformPrise(p, t);
  return ty > 0 ? ty + 0.004 : 0;
}

/** Hauteur des yeux À L'ÉCRAN (fraction de H), après zoom, descente et recentrage. */
export function yeuxAffiches(p: PlanFacecamAnimee | Scene, t: number): number {
  const s = scene(p);
  const { echelle, ty } = transformPrise(s, t);
  return s.yeux * echelle + ty;
}

/** Boîte du visage À L'ÉCRAN. `haut` : « cheveux » (yeux − 0,20, défaut) ou « front » (yeux − 0,12, haut du visage détecté). */
export function boiteVisageAffichee(p: PlanFacecamAnimee | Scene, t: number, haut: "cheveux" | "front" = "cheveux"): Rect {
  const s = scene(p);
  const { echelle, tx } = transformPrise(s, t);
  const y = yeuxAffiches(s, t);
  const cx = s.centreX * echelle + tx;
  const demi = (s.largeurVisage / 2) * VISAGE.margeLargeur * echelle;
  return { x0: cx - demi, x1: cx + demi, y0: y - (haut === "cheveux" ? VISAGE.cheveux : VISAGE.front) * echelle, y1: y + VISAGE.menton * echelle };
}

/** Objet (carte ou fenêtre) qui occupe l'écran à l'instant t — le plus récent s'ils se chevauchent ; les calques n'en sont pas. */
export function objetCourant(p: PlanFacecamAnimee | Scene, t: number): ObjetScene | null {
  const s = scene(p);
  let o: ObjetScene | null = null;
  for (const x of [...s.cartes, ...s.fenetres]) if (dans(t, x.debut, x.fin) && x.debut < s.plan.fin.debut && (!o || x.debut >= o.debut)) o = x;
  return o;
}

/** Bas du visage (menton) À L'ÉCRAN, fraction de H : yeux affichés + 0,95 largeur de visage × échelle (zoom et poussée compris). */
export function mentonAffiche(p: PlanFacecamAnimee | Scene, t: number): number {
  const s = scene(p);
  const { echelle } = transformPrise(s, t);
  return yeuxAffiches(s, t) + SOUS_TITRES.menton * s.largeurVisage * (s.W / s.H) * echelle;
}

/**
 * Centre des sous-titres (fraction de H) :
 *  - hors objet : SOUS LE MENTON affiché (haut de la bande = menton + 0,03), jamais plus haut que 0,64 (poitrine, comme
 *    la référence), au plus 0,84 ;
 *  - sous une carte ou une fenêtre « au-dessus » : bas + 0,03, c.-à-d. sur le FRONT (yeux = bas + 0,12), comme la
 *    référence ; sous une fenêtre « sur-le-visage » : bas + 0,035 (le visage est caché).
 * Contraintes DURES quand le visage est visible : la bande [y ± HAUTEUR_SOUS_TITRES/2] ne chevauche jamais [yeux ± 0,03]
 * NI la bouche et le menton (tout ce qui est entre les yeux et le menton est interdit) : elle est au-dessus des yeux ou
 * sous le menton. Pendant les 3 images où la prise descend, les sous-titres attendent donc sous le menton.
 */
export function positionSousTitres(p: PlanFacecamAnimee | Scene, t: number): number {
  const s = scene(p);
  const yeux = yeuxAffiches(s, t);
  const menton = mentonAffiche(s, t);
  const demi = hauteurSousTitres() / 2;
  const o = objetCourant(s, t);
  const visageCache = o?.genre === "fenetre-visage" && rectAnime(o, t, s.plan).phase === "pose";
  const dansImage = (y: number) => y - demi >= 0 && y + demi <= 1;
  const horsVisage = (y: number) => y + demi <= yeux - SOUS_TITRES.gardeYeux - 1e-6 || y - demi >= menton + 1e-6;
  const libre = (y: number) => dansImage(y) && (visageCache || horsVisage(y));
  const sousMenton = Math.max(SOUS_TITRES.hors, menton + SOUS_TITRES.margeMenton + demi);
  const candidats: number[] = [];
  if (o) candidats.push(o.rect.y1 + (o.genre === "fenetre-visage" ? SOUS_TITRES.sousFenetreVisage : SOUS_TITRES.sousObjet));
  candidats.push(Math.min(SOUS_TITRES.max, sousMenton));
  // Repli : sur le front ; puis collé sous le menton même au-delà de 0,84 ; puis tout en bas.
  candidats.push(yeux - demi - SOUS_TITRES.gardeYeux - 0.01, menton + demi + 0.005, 1 - demi);
  return candidats.find(libre) ?? 1 - demi;
}

/** Part (0 → 1) du rectangle `b` couverte par le rectangle `a`. */
export function couverture(a: Rect, b: Rect): number {
  const l = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
  const h = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const aire = (b.x1 - b.x0) * (b.y1 - b.y0);
  return aire > 0 ? (l * h) / aire : 0;
}
