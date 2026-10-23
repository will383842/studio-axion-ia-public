/**
 * PLAN DES COMPOSANTS « Image → vidéo » des lots L8 et L9a. Ce qui est visible à l'instant `t` (secondes), en pixels
 * de l'écran de référence 1080 × 1920. PUR : ni React ni `remotion` (les tests l'appellent directement). Déterministe :
 * aucun hasard, aucune date ; les objets « au hasard » (point de chute, ordre des coches) suivent une règle fixe.
 *
 * L8 : entonnoir (K06), nuée (K07), écran partagé (K08), additionneur (K09).
 * L9a : cartes bénéfices (K10), bandeau des chiffres (K12), repère (K13), recherche (K14), alerte (K15), e-mail (K16),
 * dossiers (K17), sources (K18), phrase-choc (K19), scène « Ensemble » (K21), et la mesure des textes.
 * Règle de lisibilité (B3, Q21) : tout texte porteur de sens a une taille ≥ plancher de la charte (0,03 × hauteur).
 * Un texte qui ne tient pas rétrécit jusqu'au plancher, passe sur plus de lignes, et sinon lève une ALERTE (jamais un
 * texte illisible posé en silence). Seules l'étiquette en capitales espacées et la marque échappent au plancher (charte).
 */
import { motsBalises } from "../ecrans-motion";
import { COULEURS_DUO, TAILLES_DUO } from "../habillage/charte-duo";
import {
  ECRAN_IV,
  MESURES_TOILE,
  MOTS_MAX_ENSEMBLE,
  nombreDeMots,
  PLANCHER_IV,
  VITESSE_FRAPPE,
  type CouleurSchema,
  type EnteteSceneIV,
  type SchemaEntree,
} from "./index";
import type { NomMicroObjet } from "./micro-objets";
import { c01, doux, progres, rebond, va } from "./courbes";
import { centrer, MARGE_IV, MARGE_LATERALE_MIN_IV, zoneUtile, type ZoneIV } from "./mise-en-page";
import { largeurAnton } from "./chasse-anton";
import { couleurTrait, TEMPS_IV } from "./temps";

export type { ZoneIV } from "./mise-en-page";
export { MARGE_IV } from "./mise-en-page";

/**
 * Zone du contenu animé : la ZONE UTILE (`mise-en-page.ts`), sous l'en-tête et au-dessus de la bande des sous-titres,
 * marges latérales de 5 % comprises. Chaque objet s'y centre et la remplit.
 */
export const ZONE_OBJETS_IV: ZoneIV = Object.freeze(zoneUtile());

/**
 * Chasse moyenne d'un signe (fraction de la taille) : Anton en capitales (mesurée à 0,49 sur « 19 MIN/COMMANDE »
 * rendu), Inter Bold en minuscules ; avec marge.
 */
export const CHASSE_IV = Object.freeze({ anton: 0.5, inter: 0.58 });

/** Comme `tailleQuiTient`, mesuré avec la chasse RÉELLE d'Anton en capitales (`chasse-anton.ts`). */
export function tailleAnton(texte: string, largeur: number, max: number): number {
  return Math.max(PLANCHER_IV * ECRAN_IV.hauteur, Math.min(max, largeur / largeurAnton(texte, 1)));
}

/** Plus grande taille (pixels) qui tient `texte` sur une ligne de `largeur` px, entre le plancher et `max`. */
export function tailleQuiTient(texte: string, largeur: number, max: number, chasse: number = CHASSE_IV.anton): number {
  const plancher = PLANCHER_IV * ECRAN_IV.hauteur;
  return Math.max(plancher, Math.min(max, largeur / (Math.max(1, [...texte].length) * chasse)));
}

/**
 * Répartition régulière de `nombre` objets parmi `quantite` : `true` = dans le groupe (coché, sorti à gauche…).
 * Les objets hors du groupe sont espacés (pour 16 sur 20 : un sur cinq), jamais tous à la fin.
 */
export function repartition(quantite: number, nombre: number): boolean[] {
  const n = Math.max(0, Math.min(quantite, nombre));
  return Array.from({ length: quantite }, (_, i) => Math.floor(((i + 1) * n) / quantite) > Math.floor((i * n) / quantite));
}

/** `nombre` heures régulières de `debut` à `fin` (une seule : `debut`). */
export function heuresRegulieres(nombre: number, debut: number, fin: number): number[] {
  if (nombre <= 0) return [];
  if (nombre === 1) return [debut];
  return Array.from({ length: nombre }, (_, i) => debut + ((fin - debut) * i) / (nombre - 1));
}

/* ------------------------------------------------------------------ */
/* K07 · Nuée                                                           */
/* ------------------------------------------------------------------ */

export type ProprietesNuee = {
  /** 2 à 30 objets identiques. */
  quantite: number;
  /** Nombre d'objets cochés en cascade (16 sur 20). */
  cochees: number;
  /** Icône de l'objet (nom de la table d'icônes, déjà résolu). */
  icone: string;
  /** Heure où la grille commence à entrer (cascade rapide). */
  apparition: number;
  /** Première et dernière coche : les coches suivent la voix, régulièrement entre les deux. */
  debutCoches: number;
  finCoches: number;
  /**
   * Heures où les objets NON cochés (ceux « pour vous ») se distinguent un par un (contour orange) : chacune fait
   * apparaître quelque chose de nouveau (rythme, Q14). Absent : ils restent blancs.
   */
  distinctions?: number[];
  zone?: ZoneIV;
};

export const BORNES_NUEE = Object.freeze({ min: 2, max: 30 });

export type ObjetNuee = {
  i: number;
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  entree: number;
  coche: number;
  dansGroupe: boolean;
  heureCoche: number | null;
  /** Objet hors du groupe qui se distingue (0 à 1) à `heureDistinction`. */
  distinction: number;
  heureDistinction: number | null;
};

/** Instants où la nuée fait apparaître quelque chose de nouveau : chaque coche, chaque objet qui se distingue. */
export function instantsNuee(p: Pick<ProprietesNuee, "quantite" | "cochees" | "debutCoches" | "finCoches" | "distinctions">): number[] {
  const q = Math.max(BORNES_NUEE.min, Math.min(BORNES_NUEE.max, Math.round(p.quantite)));
  const coches = heuresRegulieres(Math.max(0, Math.min(q, p.cochees)), p.debutCoches, p.finCoches);
  return [...coches, ...(p.distinctions ?? []).slice(0, q - coches.length)].sort((a, b) => a - b);
}

export type PlanNuee = { objets: ObjetNuee[]; compteur: { faits: number; total: number; texte: string; taille: number; x: number; y: number; largeur: number; impulsion: number } };

/** Hauteur réservée au compteur « 16/20 » sous la grille (pixels). */
const HAUTEUR_COMPTEUR_NUEE = 150;
/** Rapport largeur / hauteur d'un objet (enveloppe). */
const RAPPORT_OBJET = 1.4;

/** Grille de la nuée : colonnes et taille d'objet qui remplissent le mieux la zone. */
export function grilleNuee(quantite: number, zone: ZoneIV) {
  const H = zone.hauteur - HAUTEUR_COMPTEUR_NUEE;
  let meilleure = { colonnes: 1, lignes: quantite, case: 0 };
  for (let colonnes = 1; colonnes <= quantite; colonnes++) {
    const lignes = Math.ceil(quantite / colonnes);
    const kase = Math.min(zone.largeur / colonnes, (H / lignes) * RAPPORT_OBJET);
    if (kase > meilleure.case) meilleure = { colonnes, lignes, case: kase };
  }
  const largeur = Math.min(190, meilleure.case * 0.78);
  return { ...meilleure, largeur, hauteur: largeur / RAPPORT_OBJET, pasX: meilleure.case, pasY: meilleure.case / RAPPORT_OBJET };
}

export function planNuee(p: ProprietesNuee, t: number): PlanNuee {
  const zone = p.zone ?? ZONE_OBJETS_IV;
  const q = Math.max(BORNES_NUEE.min, Math.min(BORNES_NUEE.max, Math.round(p.quantite)));
  const g = grilleNuee(q, zone);
  const base = repartition(q, p.cochees);
  // Chaque ligne décale sa répartition de deux cases : les objets non cochés forment une diagonale, pas une colonne.
  const groupe = Array.from({ length: q }, (_, i) => {
    const ligne = Math.floor(i / g.colonnes);
    const dansLigne = Math.min(g.colonnes, q - ligne * g.colonnes);
    return base[ligne * g.colonnes + ((i - ligne * g.colonnes + 2 * ligne) % dansLigne)];
  });
  const heures = heuresRegulieres(groupe.filter(Boolean).length, p.debutCoches, p.finCoches);
  const hauteurGrille = g.lignes * g.pasY;
  const haut = zone.y + (zone.hauteur - HAUTEUR_COMPTEUR_NUEE - hauteurGrille) / 2;
  let k = 0;
  let j = 0;
  const objets: ObjetNuee[] = [];
  for (let i = 0; i < q; i++) {
    const ligne = Math.floor(i / g.colonnes);
    const col = i % g.colonnes;
    const dansLigne = Math.min(g.colonnes, q - ligne * g.colonnes);
    const gauche = zone.x + (zone.largeur - dansLigne * g.pasX) / 2;
    const heureCoche = groupe[i] ? heures[k++] : null;
    const heureDistinction = groupe[i] ? null : (p.distinctions?.[j++] ?? null);
    objets.push({
      i,
      x: gauche + col * g.pasX + (g.pasX - g.largeur) / 2,
      y: haut + ligne * g.pasY + (g.pasY - g.hauteur) / 2,
      largeur: g.largeur,
      hauteur: g.hauteur,
      entree: progres(t, p.apparition + i * 0.035, 0.35),
      coche: heureCoche === null ? 0 : progres(t, heureCoche, TEMPS_IV.coche),
      dansGroupe: groupe[i],
      heureCoche,
      distinction: heureDistinction === null ? 0 : progres(t, heureDistinction, TEMPS_IV.coche),
      heureDistinction,
    });
  }
  const faites = heures.filter((h) => h <= t);
  const derniere = faites.length ? faites[faites.length - 1] : null;
  return {
    objets,
    compteur: {
      faits: faites.length,
      total: q,
      texte: `${faites.length}/${q}`,
      taille: 0.065 * ECRAN_IV.hauteur,
      x: zone.x,
      y: zone.y + zone.hauteur - HAUTEUR_COMPTEUR_NUEE + 10,
      largeur: zone.largeur,
      impulsion: derniere === null ? 1 : 1 + 0.08 * Math.sin(Math.PI * progres(t, derniere, 0.25)),
    },
  };
}

/* ------------------------------------------------------------------ */
/* K06 · Entonnoir                                                      */
/* ------------------------------------------------------------------ */

export type SortieEntonnoir = { libelle: string; compte: number; couleur: CouleurSchema };

export type ProprietesEntonnoir = {
  quantite: number;
  icone: string;
  /** Mot écrit dans l'entonnoir (« IA »). */
  moteur: string;
  /** Exactement deux sorties ; la plus nombreuse est posée à gauche. */
  sorties: [SortieEntonnoir, SortieEntonnoir];
  /** Heure où chaque objet entre dans l'entonnoir : une par objet (au rythme de la voix), ou une plage régulière. */
  chutes: number[] | { debut: number; fin: number };
  zone?: ZoneIV;
};

/** Durées d'un objet : chute jusqu'à la bouche, passage du goulot, glissade vers sa sortie (secondes). */
export const TEMPS_ENTONNOIR = Object.freeze({ chute: 0.55, goulot: 0.25, glissade: 0.35 });

/**
 * Géométrie de l'entonnoir dans sa zone (pixels) : proportionnelle à la zone, l'entonnoir en haut, les deux sorties
 * dessous jusqu'au bas de la zone (le bloc la remplit), dans les marges latérales.
 */
export function geometrieEntonnoir(zone: ZoneIV = ZONE_OBJETS_IV) {
  const cx = zone.x + zone.largeur / 2;
  const h = zone.hauteur;
  const bouche = zone.y + 90;
  const goulot = zone.y + Math.round(0.36 * h);
  const sortieGoulot = goulot + 50;
  const bacs = sortieGoulot + 60;
  const hauteurBac = zone.y + zone.hauteur - bacs;
  const ecart = 20;
  const largeurBac = (zone.largeur - ecart) / 2;
  return {
    cx,
    bouche,
    demiBouche: Math.min(300, 0.31 * zone.largeur),
    ryBouche: 34,
    goulot,
    demiGoulot: 54,
    sortieGoulot,
    depart: zone.y - 50,
    bacs: [
      { x: zone.x, y: bacs, largeur: largeurBac, hauteur: hauteurBac },
      { x: zone.x + largeurBac + ecart, y: bacs, largeur: largeurBac, hauteur: hauteurBac },
    ],
    objet: { largeur: 110, hauteur: 78 },
  };
}

/** Marge intérieure latérale d'une sortie de l'entonnoir (pixels). */
export const PADDING_BAC = 18;

/** Problèmes de données (une phrase chacun) : rien n'est corrigé, l'entonnoir ne dessine que ce que dit la carte. */
export function controlerEntonnoir(p: ProprietesEntonnoir): string[] {
  const res: string[] = [];
  const somme = p.sorties[0].compte + p.sorties[1].compte;
  if (somme !== p.quantite) res.push(`Les sorties comptent ${somme} objets pour ${p.quantite} entrés.`);
  if (Array.isArray(p.chutes) && p.chutes.length !== p.quantite) res.push(`${p.chutes.length} heures de chute pour ${p.quantite} objets.`);
  return res;
}

export type ObjetEntonnoir = { i: number; x: number; y: number; echelle: number; opacite: number; rotation: number; phase: "chute" | "goulot" | "glissade"; sortie: 0 | 1 };

export type BacEntonnoir = SortieEntonnoir & ZoneIV & { arrives: number; pourcent: number; taillePart: number; tailleCompte: number; tailleLibelle: number; impulsion: number };

export type PlanEntonnoir = { objets: ObjetEntonnoir[]; bacs: [BacEntonnoir, BacEntonnoir]; rotation: number; actif: number; inclinaison: number };

/** Sorties dans l'ordre d'affichage : la plus nombreuse à gauche (égalité : ordre donné). */
export function sortiesOrdonnees(p: Pick<ProprietesEntonnoir, "sorties">): [SortieEntonnoir, SortieEntonnoir] {
  const [a, b] = p.sorties;
  return b.compte > a.compte ? [b, a] : [a, b];
}

export function planEntonnoir(p: ProprietesEntonnoir, t: number): PlanEntonnoir {
  const zone = p.zone ?? ZONE_OBJETS_IV;
  const G = geometrieEntonnoir(zone);
  const sorties = sortiesOrdonnees(p);
  const heures = Array.isArray(p.chutes) ? [...p.chutes].sort((a, b) => a - b) : heuresRegulieres(p.quantite, p.chutes.debut, p.chutes.fin);
  // Lue à l'envers : les premiers objets triés vont à la sortie majoritaire (sa part ne commence jamais à 0 %).
  const versGauche = repartition(p.quantite, sorties[0].compte).reverse();
  const T = TEMPS_ENTONNOIR;
  const objets: ObjetEntonnoir[] = [];
  const arrivees: number[][] = [[], []];
  heures.forEach((h, i) => {
    const sortie: 0 | 1 = versGauche[i] ? 0 : 1;
    const bac = G.bacs[sortie];
    const arrivee = h + T.goulot + T.glissade;
    arrivees[sortie].push(arrivee);
    const depart = h - T.chute;
    if (t < depart || t >= arrivee) return;
    // Point de départ fixe par objet (règle, pas hasard) : cinq couloirs au-dessus de la bouche.
    const x0 = G.cx + (((i * 3) % 5) - 2) * 85;
    if (t < h) {
      const u = progres(t, depart, T.chute);
      objets.push({ i, x: x0 + (G.cx - x0) * 0.35 * u, y: G.depart + (G.bouche + 30 - G.depart) * u * u, echelle: 1, opacite: c01(u * 4), rotation: (((i * 7) % 5) - 2) * 9 * (1 - u), phase: "chute", sortie });
    } else if (t < h + T.goulot) {
      const u = progres(t, h, T.goulot);
      const xb = x0 + (G.cx - x0) * 0.35;
      objets.push({ i, x: xb + (G.cx - xb) * u, y: G.bouche + 30 + (G.sortieGoulot - G.bouche - 30) * u, echelle: 1 - 0.45 * u, opacite: 1, rotation: 0, phase: "goulot", sortie });
    } else {
      const u = doux(progres(t, h + T.goulot, T.glissade));
      const xf = bac.x + bac.largeur / 2;
      const yf = bac.y + 40;
      objets.push({ i, x: G.cx + (xf - G.cx) * u, y: G.sortieGoulot + (yf - G.sortieGoulot) * u, echelle: 0.55 - 0.2 * u, opacite: 1 - c01((u - 0.7) / 0.3), rotation: 0, phase: "glissade", sortie });
    }
  });
  const triees = arrivees[0].filter((a) => a <= t).length + arrivees[1].filter((a) => a <= t).length;
  const bacs = sorties.map((s, k) => {
    const faites = arrivees[k].filter((a) => a <= t);
    const derniere = faites.length ? faites[faites.length - 1] : null;
    const b = G.bacs[k];
    const interieur = b.largeur - 2 * PADDING_BAC;
    return {
      ...s,
      ...b,
      arrives: faites.length,
      // Part parmi les objets déjà triés : la sortie majoritaire montre « 80 % » dès les premiers, jamais « 20 % ».
      pourcent: triees > 0 ? Math.round((faites.length * 100) / triees) : 0,
      tailleCompte: 0.085 * ECRAN_IV.hauteur,
      taillePart: 0.04 * ECRAN_IV.hauteur,
      // Le libellé peut passer à la ligne entre deux mots, jamais au milieu d'un mot : le plus long mot doit tenir.
      tailleLibelle: Math.min(...s.libelle.split(/\s+/).map((m) => tailleAnton(m, interieur, 0.04 * ECRAN_IV.hauteur))),
      impulsion: derniere === null ? 1 : 1 + 0.07 * Math.sin(Math.PI * progres(t, derniere, 0.22)),
    } satisfies BacEntonnoir;
  }) as [BacEntonnoir, BacEntonnoir];
  // Deux parts arrondies font toujours 100.
  if (triees > 0) bacs[1].pourcent = 100 - bacs[0].pourcent;
  // L'entonnoir tourne pendant le tri (anneau en pointillé qui défile), s'incline d'un rien à chaque entrée.
  const debut = heures.length ? heures[0] - T.chute : 0;
  const fin = heures.length ? heures[heures.length - 1] + T.goulot : 0;
  const actif = Math.min(progres(t, debut, 0.3), 1 - progres(t, fin, 0.5));
  const entree = heures.filter((h) => h <= t).pop();
  const inclinaison = entree === undefined ? 0 : 2.5 * Math.sin(Math.PI * progres(t, entree, 0.3)) * (heures.indexOf(entree) % 2 ? -1 : 1);
  return { objets, bacs, rotation: Math.max(0, t - debut) * 140, actif, inclinaison };
}

/* ------------------------------------------------------------------ */
/* K08 · Écran partagé                                                  */
/* ------------------------------------------------------------------ */

/** Une ligne d'une colonne : un texte (Inter), une valeur (Anton), ou une rangée d'icônes ; posée à son mot. */
export type LigneEcranPartage = { texte?: string; valeur?: string; icones?: string[]; coche?: boolean; t: number };
export type ColonneEcranPartage = { titre: string; lignes: LigneEcranPartage[] };

export type ProprietesEcranPartage = {
  avant: ColonneEcranPartage;
  apres: ColonneEcranPartage;
  /** Heure du volet de bascule (« Maintenant… ») : l'après entre par la droite, l'avant se range à gauche. */
  bascule: number;
  zone?: ZoneIV;
};

export const TEMPS_ECRAN_PARTAGE = Object.freeze({ volet: 0.6, ligne: 0.4, apresVolet: 0.15 });

/** Marge intérieure d'une colonne (pixels). */
export const MARGE_COLONNE = 20;
/** Marge verticale d'une colonne, écart entre les rangs, côté d'une icône de rangée (pixels). */
export const MESURES_ECRAN_PARTAGE = Object.freeze({ margeHaut: 18, ecartRangs: 8, icone: 74, interligneTexte: 1.1, interligneValeur: 1.02 });

export type LignePosee = LigneEcranPartage & { entree: number; tailleTexte: number; tailleValeur: number; icone: number };

export type PlanEcranPartage = {
  volet: number;
  /** Décalage de l'avant vers le centre tant que l'après n'est pas là (pixels). */
  decalageAvant: number;
  rangs: { avant: LignePosee | null; apres: LignePosee | null }[];
  titres: { avant: number; apres: number };
  /** Hauteur estimée du contenu (pixels) : doit tenir dans la zone (test). */
  hauteurEstimee: number;
  /** Côté d'une icône de rangée (pixels). */
  icone: number;
};

/** Hauteur estimée d'une ligne posée dans une colonne de largeur intérieure `interieur`. */
export function hauteurLigne(l: LignePosee | null, interieur: number): number {
  if (!l) return 0;
  const M = MESURES_ECRAN_PARTAGE;
  const icones = l.icones ? Math.ceil((l.icones.length * (l.icone + 10)) / interieur) * (l.icone + 10) : 0;
  const lignes = l.texte ? Math.ceil(([...l.texte].length * CHASSE_IV.inter * l.tailleTexte) / interieur) : 0;
  return icones + lignes * l.tailleTexte * M.interligneTexte + (l.valeur ? l.tailleValeur * M.interligneValeur + 4 : 0);
}

/** Une ligne posée à l'échelle `k` (1 = le plus grand) : textes et icônes rétrécissent ensemble, jamais sous le plancher. */
function poser(l: LigneEcranPartage, entree: number, interieur: number, k: number, iconeMin: number = MESURES_ECRAN_PARTAGE.icone): LignePosee {
  const H = ECRAN_IV.hauteur;
  const plancher = PLANCHER_IV * H;
  return {
    ...l,
    entree,
    tailleTexte: Math.max(plancher, 0.04 * H * k),
    tailleValeur: l.valeur ? tailleAnton(l.valeur, l.coche ? interieur * 0.78 : interieur, Math.max(plancher, 0.066 * H * k)) : 0,
    icone: Math.round(Math.max(iconeMin, 112 * k)),
  };
}

export function planEcranPartage(p: ProprietesEcranPartage, t: number): PlanEcranPartage {
  const zone = p.zone ?? ZONE_OBJETS_IV;
  const T = TEMPS_ECRAN_PARTAGE;
  const volet = va(progres(t, p.bascule, T.volet));
  const interieur = zone.largeur / 2 - 2 * MARGE_COLONNE;
  const n = Math.max(p.avant.lignes.length, p.apres.lignes.length);
  const M = MESURES_ECRAN_PARTAGE;
  // Le plus grand jeu de tailles dont le contenu tient dans la hauteur de la zone (les panneaux la remplissent).
  const disposer = (k: number, iconeMin: number = M.icone) => {
    const rangs = Array.from({ length: n }, (_, i) => {
      const a = p.avant.lignes[i];
      const b = p.apres.lignes[i];
      return {
        avant: a ? poser(a, progres(t, a.t - TEMPS_IV.avanceNoeud, T.ligne), interieur, k, iconeMin) : null,
        // Rien de l'après n'entre avant que le volet soit passé.
        apres: b ? poser(b, progres(t, Math.max(b.t - TEMPS_IV.avanceNoeud, p.bascule + T.volet - T.apresVolet), T.ligne), interieur, k, iconeMin) : null,
      };
    });
    const hauteurEstimee =
      2 * M.margeHaut + TAILLES_DUO.etiquette * ECRAN_IV.hauteur * 1.3 + rangs.reduce((s, r) => s + Math.max(hauteurLigne(r.avant, interieur), hauteurLigne(r.apres, interieur)) + M.ecartRangs, 0);
    return { rangs, hauteurEstimee, icone: Math.round(Math.max(iconeMin, 112 * k)) };
  };
  let d = disposer(1);
  for (let k = 0.95; k >= 0.4 && d.hauteurEstimee > zone.hauteur - 40; k -= 0.05) d = disposer(k);
  // Zone basse (sous-titres remontés) : les icônes de rangée descendent jusqu'au plancher de lisibilité, pas plus bas.
  for (let i = M.icone - 2; i >= Math.ceil(PLANCHER_IV * ECRAN_IV.hauteur) && d.hauteurEstimee > zone.hauteur - 40; i -= 2) d = disposer(0.4, i);
  const { rangs, hauteurEstimee } = d;
  return {
    icone: d.icone,
    hauteurEstimee,
    volet,
    decalageAvant: (zone.largeur / 4) * (1 - volet),
    rangs,
    titres: { avant: progres(t, Math.min(...p.avant.lignes.map((l) => l.t), p.bascule) - 0.3, 0.3), apres: progres(t, p.bascule + T.volet * 0.5, 0.3) },
  };
}

/* ------------------------------------------------------------------ */
/* K09 · Additionneur                                                   */
/* ------------------------------------------------------------------ */

/** Un minuteur : il monte de 0 à `valeur` quand son mot est dit (`t`). */
export type TermeAddition = { libelle: string; valeur: number; t: number };

export type ProprietesAdditionneur = {
  termes: TermeAddition[];
  /** Unité écrite après la somme (« min »). */
  unite: string;
  /** Total LU sur la carte (19) et heure de son mot : le « 19 » se pose à cette heure. */
  total: { valeur: number; t: number };
  /** Compteur de bascule : le total (en minutes) descend jusqu'à `secondes`, puis `texte` (« 45 sec ») se pose. */
  apres?: { secondes: number; texte: string; t: number };
  /**
   * Détail du résultat LU sur la carte (« risque erreur : élevé ») : son libellé se pose sous l'addition à `t`, sa valeur
   * (après les deux-points) claque à `tValeur`. Deux apparitions nouvelles (rythme, Q14).
   */
  detail?: { libelle: string; valeur?: string; t: number; tValeur?: number };
  zone?: ZoneIV;
};

export const TEMPS_ADDITIONNEUR = Object.freeze({ montee: 0.9, pasEquation: 0.09, compteur: 1.4 });

export type MorceauEquation = { texte: string; entree: number; accent: boolean };

export type PlanAdditionneur = {
  minuteurs: { libelle: string; valeur: number; affiche: number; arc: number; entree: number }[];
  equation: MorceauEquation[];
  /** Somme calculée des termes, et écart avec le total lu (signalé, jamais corrigé). */
  somme: number;
  ecart: boolean;
  compteur: { visible: number; texte: string; fini: number; secondes: number } | null;
  /** Montée de l'ensemble minuteurs + équation quand le compteur arrive (0 à 1). */
  retrait: number;
  /** Détail du résultat (libellé, valeur), avec leurs entrées (0 à 1) ; `null` sans détail. */
  detail: { libelle: string; valeur: string | null; entree: number; entreeValeur: number; taille: number } | null;
  tailles: { libelle: number; minuteur: number; equation: number; compteur: number };
  /**
   * Géométrie (pixels) : un rang par minuteur, empilés du haut de la zone (cercle à gauche, libellé à droite), puis la
   * bande du bas où s'écrit l'addition et où le compteur la remplace. Le bloc remplit la zone.
   */
  geometrie: { rangs: ZoneIV[]; diametre: number; bande: ZoneIV; detail: ZoneIV | null };
};

/** Instants où l'additionneur fait apparaître quelque chose de nouveau : chaque minuteur, le total, le détail. */
export function instantsAdditionneur(p: Pick<ProprietesAdditionneur, "termes" | "total" | "apres" | "detail">): number[] {
  const d = p.detail;
  return [...p.termes.map((m) => m.t), p.total.t, ...(p.apres ? [p.apres.t] : []), ...(d ? [d.t, ...(d.valeur && d.tValeur !== undefined ? [d.tValeur] : [])] : [])].sort((a, b) => a - b);
}

/** « 19:00 », « 0:45 » : minutes et secondes d'un compte à rebours. */
export function minutesSecondes(secondes: number): string {
  const s = Math.max(0, Math.round(secondes));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function planAdditionneur(p: ProprietesAdditionneur, t: number): PlanAdditionneur {
  const H = ECRAN_IV.hauteur;
  const zone = p.zone ?? ZONE_OBJETS_IV;
  const T = TEMPS_ADDITIONNEUR;
  const minuteurs = p.termes.map((m) => {
    const u = doux(progres(t, m.t - 0.1, T.montee));
    return { libelle: m.libelle, valeur: m.valeur, affiche: Math.round(m.valeur * u), arc: u, entree: progres(t, m.t - 0.3, 0.3) };
  });
  // L'équation s'écrit mot par mot pour que le total (dernier morceau) se pose À l'heure de son mot.
  const textes = p.termes.flatMap((m, i) => (i === 0 ? [String(m.valeur)] : ["+", String(m.valeur)])).concat(["=", `${p.total.valeur} ${p.unite}`]);
  const equation = textes.map((texte, k) => ({ texte, entree: progres(t, p.total.t - (textes.length - 1 - k) * T.pasEquation, 0.3), accent: k === textes.length - 1 }));
  const somme = p.termes.reduce((s, m) => s + m.valeur, 0);
  let compteur: PlanAdditionneur["compteur"] = null;
  let retrait = 0;
  if (p.apres) {
    const depart = p.total.valeur * 60;
    const u = va(progres(t, p.apres.t, T.compteur));
    const secondes = depart + (p.apres.secondes - depart) * u;
    const fini = progres(t, p.apres.t + T.compteur, 0.3);
    compteur = { visible: progres(t, p.apres.t - 0.3, 0.3), texte: fini > 0 ? p.apres.texte : minutesSecondes(secondes), fini, secondes };
    retrait = doux(progres(t, p.apres.t - 0.3, 0.5));
  }
  const n = Math.max(1, p.termes.length);
  // Bande de l'addition : 13 % de l'écran au plus, 28 % de la zone quand elle est basse (les minuteurs gardent le plancher).
  // Avec un détail, une rangée de plus sous l'addition : la bande se resserre, jamais sous le plancher.
  const plancher = PLANCHER_IV * H;
  const hauteurDetail = p.detail ? Math.round(plancher * 1.3) : 0;
  const ecartDetail = p.detail ? 12 : 0;
  const ecartBande = 24;
  const pasMin = Math.ceil(plancher / 0.48) + 16;
  const hauteurBande = Math.round(
    p.detail ? Math.max(plancher * 1.1, Math.min(0.13 * H, zone.hauteur - ecartBande - hauteurDetail - ecartDetail - n * pasMin)) : Math.min(0.13 * H, 0.28 * zone.hauteur),
  );
  const pas = (zone.hauteur - hauteurBande - ecartBande - hauteurDetail - ecartDetail) / n;
  const diametre = Math.min(240, pas - 16);
  const rangs = p.termes.map((_, i) => ({ x: zone.x, y: zone.y + i * pas, largeur: zone.largeur, hauteur: pas }));
  const largeurLibelle = zone.largeur - diametre - 3 * 40;
  const yBande = zone.y + zone.hauteur - hauteurBande - hauteurDetail - ecartDetail;
  const d = p.detail;
  const texteDetail = d ? `${d.libelle}${d.valeur ? ` : ${d.valeur}` : ""}` : "";
  return {
    minuteurs,
    equation,
    somme,
    ecart: somme !== p.total.valeur,
    compteur,
    retrait,
    detail: d
      ? {
          libelle: d.libelle,
          valeur: d.valeur ?? null,
          entree: progres(t, d.t, 0.35),
          entreeValeur: d.valeur ? progres(t, d.tValeur ?? d.t, 0.3) : 0,
          taille: tailleQuiTient(texteDetail.toUpperCase(), zone.largeur - 2 * 40, hauteurDetail / 1.15),
        }
      : null,
    tailles: {
      libelle: Math.min(...p.termes.map((m) => tailleQuiTient(m.libelle.toUpperCase(), largeurLibelle, 0.075 * H))),
      minuteur: Math.min(0.06 * H, diametre * 0.48),
      // Mesure réelle d'Anton : les morceaux et leurs écarts (0,28 em) remplissent la largeur.
      equation: Math.min(0.08 * H, 0.9 * hauteurBande, (zone.largeur - 80) / (largeurAnton(textes.join("").toUpperCase(), 1) + 0.28 * (textes.length - 1))),
      compteur: Math.min(0.11 * H, hauteurBande * 0.95),
    },
    geometrie: {
      rangs,
      diametre,
      bande: { x: zone.x, y: yBande, largeur: zone.largeur, hauteur: hauteurBande },
      detail: d ? { x: zone.x, y: yBande + hauteurBande + ecartDetail, largeur: zone.largeur, hauteur: hauteurDetail } : null,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Scène d'objets (galerie K20 des images D, E, F)                      */
/* ------------------------------------------------------------------ */

/** Un objet de L8 posé entre `debut` et `fin` (secondes de la scène), avec un fondu d'entrée et de sortie. */
export type ObjetSceneIV = { debut: number; fin: number } & (
  | { sorte: "entonnoir"; proprietes: ProprietesEntonnoir }
  | { sorte: "nuee"; proprietes: ProprietesNuee }
  | { sorte: "ecran-partage"; proprietes: ProprietesEcranPartage }
  | { sorte: "additionneur"; proprietes: ProprietesAdditionneur }
);

/** Propriétés d'une scène d'objets : même cadre que `ProprietesSceneIV` (taille, fond, marque, en-têtes). */
export type ProprietesSceneObjetsIV = {
  largeur: number;
  hauteur: number;
  fps: number;
  dureeSec: number;
  fond: "ivoire" | "sombre";
  marque: "axion-ia.com";
  entetes: { debut: number; fin: number; etiquette: string; titre: string }[];
  objets: ObjetSceneIV[];
};

/** Objets visibles à l'instant `t`, avec leur opacité (fondu de `TEMPS_IV.fondu`). */
export function objetsA(p: Pick<ProprietesSceneObjetsIV, "objets">, t: number): { objet: ObjetSceneIV; opacite: number }[] {
  const f = TEMPS_IV.fondu;
  return p.objets
    .filter((o) => t >= o.debut && t < o.fin)
    .map((objet) => ({ objet, opacite: Math.min(progres(t, objet.debut, f), 1 - progres(t, objet.fin - f, f)) }));
}

/* ================================================================== */
/* Lot L9a                                                              */
/* ================================================================== */

const W = ECRAN_IV.largeur;
const H = ECRAN_IV.hauteur;

/** Plancher de lisibilité en pixels de l'écran de référence (0,03 × 1920 = 57,6 px). */
export const PLANCHER_PX = PLANCHER_IV * H;
/** Taille de l'étiquette en capitales espacées (hors plancher, charte). */
export const TAILLE_ETIQUETTE_PX = TAILLES_DUO.etiquette * H;

/**
 * Largeur moyenne d'un signe, en fraction de la taille : celles de la toile (L2) pour les objets ; `antonCapitales` (0,4)
 * est la chasse mesurée par L7 pour les titres courts de l'en-tête.
 */
export const SIGNES = Object.freeze({ anton: MESURES_TOILE.signeAnton, inter: MESURES_TOILE.signeInter, antonCapitales: 0.4 });
export const INTERLIGNE_IV = 1.1;

/* ------------------------------------------------------------------ */
/* Mesure des textes                                                    */
/* ------------------------------------------------------------------ */

export type TexteAjuste = {
  /** Taille (pixels de l'écran de référence). */
  taille: number;
  /** Mots de chaque ligne (balises `*mot*` gardées, pour l'accent). */
  lignes: string[][];
  /** Phrase pour Will si le texte ne tient pas au plancher ; `null` sinon. */
  alerte: string | null;
};

export type OptionsAjuster = {
  largeur: number;
  tailleMax: number;
  signe: number;
  lignesMax?: number;
  /** Hauteur disponible : la taille de n lignes est bornée par hauteur / (n × interligne). */
  hauteurMax?: number;
  plancher?: number;
  /** Garder le nombre de lignes qui donne la PLUS GRANDE taille (phrase-choc), au lieu du moins de lignes possible. */
  plusGrand?: boolean;
};

const signesDe = (mots: readonly string[]) => mots.reduce((s, m) => s + m.replace(/\*/g, "").length, 0) + Math.max(0, mots.length - 1);

/** Coupe une liste de mots en `n` lignes de longueur la plus égale possible (plus longue ligne minimale ; égalités : coupe la plus tôt). */
export function couperEquilibre(mots: readonly string[], n: number): string[][] {
  if (n <= 1 || mots.length <= 1) return [mots.slice()];
  if (mots.length <= n) return mots.map((m) => [m]);
  let meilleur: string[][] | null = null;
  let score = Infinity;
  for (let k = 1; k <= mots.length - (n - 1); k++) {
    const tete = mots.slice(0, k);
    const reste = couperEquilibre(mots.slice(k), n - 1);
    const s = Math.max(signesDe(tete), ...reste.map(signesDe));
    if (s < score) {
      score = s;
      meilleur = [tete, ...reste];
    }
  }
  return meilleur!;
}

/**
 * Taille d'un texte dans une largeur : la plus grande taille ≤ `tailleMax` qui tient sur UNE ligne, tant qu'elle reste
 * ≥ plancher ; sinon sur 2 lignes, puis 3… jusqu'à `lignesMax`. Si rien ne tient au plancher : taille = plancher,
 * `lignesMax` lignes et une alerte (le texte déborderait : à raccourcir).
 */
export function ajusterTexte(texte: string, o: OptionsAjuster): TexteAjuste {
  const plancher = o.plancher ?? PLANCHER_PX;
  const lignesMax = Math.max(1, o.lignesMax ?? 2);
  const mots = texte.split(/\s+/).filter(Boolean);
  if (mots.length === 0) return { taille: o.tailleMax, lignes: [], alerte: null };
  let meilleur: TexteAjuste | null = null;
  for (let n = 1; n <= Math.min(lignesMax, mots.length); n++) {
    const lignes = couperEquilibre(mots, n);
    const plusLongue = Math.max(...lignes.map(signesDe));
    const parHauteur = o.hauteurMax === undefined ? Infinity : o.hauteurMax / (n * INTERLIGNE_IV);
    const taille = Math.min(o.tailleMax, parHauteur, o.largeur / (plusLongue * o.signe));
    if (taille < plancher - 1e-9) continue;
    if (!o.plusGrand) return { taille, lignes, alerte: null };
    if (!meilleur || taille > meilleur.taille + 1e-9) meilleur = { taille, lignes, alerte: null };
  }
  if (meilleur) return meilleur;
  return {
    taille: plancher,
    lignes: couperEquilibre(mots, Math.min(lignesMax, mots.length)),
    alerte: `« ${texte.replace(/\*/g, "")} » ne tient pas sur ${lignesMax} ligne${lignesMax > 1 ? "s" : ""} au plancher de lisibilité : à raccourcir.`,
  };
}

/** Hauteur occupée par un texte ajusté. */
export const hauteurTexte = (a: Pick<TexteAjuste, "taille" | "lignes">) => a.lignes.length * a.taille * INTERLIGNE_IV;

/* ------------------------------------------------------------------ */
/* En-tête (correction de L7 : plancher du titre)                       */
/* ------------------------------------------------------------------ */

/** Taille du titre sur une ligne (fraction de la hauteur) : le titre v4 réduit pour laisser la toile en dessous. */
export const TAILLE_TITRE_IV = 0.068;
/** Haut de l'en-tête, marge sous l'étiquette, bas de l'en-tête (fractions de la hauteur). */
export const HAUT_ENTETE = 0.135;
/** 17/10 : 0,006 laissait les accents des capitales (É, À) toucher l'étiquette ; 0,016 ≈ 31 px les en sépare. */
export const ECART_ETIQUETTE = 0.016;
export const BAS_TITRE = 0.245;
/** Écart après chaque mot du titre rendu mot par mot (`Entete.tsx` : `marginRight: 0.22em`). */
export const ECART_MOT_TITRE = 0.22;

/** Largeur RÉELLE (px) d'une ligne de titre telle que l'en-tête la rend : chasse d'Anton + écart après chaque mot. */
export function largeurLigneTitre(mots: readonly string[], taille: number): number {
  return mots.reduce((s, m) => s + largeurAnton(m.replace(/\*/g, ""), taille) + ECART_MOT_TITRE * taille, 0);
}

/**
 * Le titre ajusté par la moyenne des signes, vérifié à la chasse réelle d'Anton (intégration, défaut vu à l'œil :
 * « BON DE COMMANDE MARTIN » sortait du cadre) : réduit pour tenir dans `largeur`, jamais coupé ; `null` s'il
 * passerait sous le plancher.
 */
function tenirLargeur(a: TexteAjuste, largeur: number, plancher: number): TexteAjuste | null {
  const plusLarge = Math.max(0, ...a.lignes.map((l) => largeurLigneTitre(l, a.taille)));
  if (plusLarge <= largeur + 1e-6) return a;
  const taille = Math.floor(((a.taille * largeur) / plusLarge) * 100) / 100;
  return taille < plancher - 1e-9 ? null : { ...a, taille };
}

/**
 * Titre de l'en-tête : sur UNE ligne, réduit pour tenir dans 88 % de la largeur, mais JAMAIS sous le plancher
 * (0,03 × hauteur) ; s'il le faudrait, il passe sur 2 lignes (taille bornée pour ne pas déborder sous l'en-tête) ; si
 * même 2 lignes ne tiennent pas au plancher, alerte BLOQUANTE (le rendu est refusé).
 */
export function planTitre(titre: string, largeur: number, hauteur: number): TexteAjuste {
  const plancher = PLANCHER_IV * hauteur;
  // Mêmes mots que le mot par mot de l'en-tête (`motsBalises`), pour que chaque ligne rende les bons mots.
  titre = motsBalises(titre).map((m) => m.mot).join(" ");
  const hauteurDispo = (BAS_TITRE - HAUT_ENTETE - TAILLES_DUO.etiquette - ECART_ETIQUETTE) * hauteur;
  const une = ajusterTexte(titre, { largeur: 0.88 * largeur, tailleMax: TAILLE_TITRE_IV * hauteur, signe: SIGNES.antonCapitales, lignesMax: 1, plancher });
  const uneTenue = une.alerte ? null : tenirLargeur(une, 0.88 * largeur, plancher);
  if (uneTenue) return uneTenue;
  // Une ligne tenue à l'estimation mais pas à la chasse réelle : deux lignes équilibrées, à la plus grande taille permise.
  const mots = titre.split(/\s+/).filter(Boolean);
  const deux: TexteAjuste = une.alerte
    ? ajusterTexte(titre, { largeur: 0.88 * largeur, tailleMax: TAILLE_TITRE_IV * hauteur, signe: SIGNES.antonCapitales, lignesMax: 2, hauteurMax: hauteurDispo, plancher })
    : mots.length < 2
      ? { ...une, alerte: "un seul mot" }
      : { taille: Math.min(TAILLE_TITRE_IV * hauteur, hauteurDispo / (2 * INTERLIGNE_IV)), lignes: couperEquilibre(mots, 2), alerte: null };
  // Le titre est tranché (une ligne a déjà échoué) : on ne garde que la tentative sur deux lignes, tenue à la chasse réelle.
  const deuxTenue = !deux.alerte && deux.lignes.length === 2 ? tenirLargeur(deux, 0.88 * largeur, plancher) : null;
  if (deuxTenue) return deuxTenue;
  return { ...deux, alerte: `Titre trop long pour l'écran, même sur 2 lignes au plancher de lisibilité : « ${titre} ». À raccourcir.` };
}

/** Alertes bloquantes des en-têtes d'une scène (le rendu est refusé s'il y en a une). */
export function controlerEntetes(p: { entetes?: readonly EnteteSceneIV[]; largeur: number; hauteur: number }): string[] {
  return (p.entetes ?? []).map((e) => planTitre(e.titre, p.largeur, p.hauteur).alerte).filter((a): a is string => a !== null);
}

/* ------------------------------------------------------------------ */
/* Entrées et compteurs                                                 */
/* ------------------------------------------------------------------ */

/** « Claque » d'un chiffre : très grand puis posé avec rebond, éclair au contact. */
export function planClaque(t: number, t0: number) {
  const x = progres(t, t0, 0.32);
  return { opacite: c01(x * 4), echelle: t < t0 ? 0 : 1.6 - 0.6 * rebond(x), eclair: t >= t0 && t < t0 + 0.18 ? 1 - (t - t0) / 0.18 : 0 };
}

/** Un chiffre qui compte : « 80 % » compte de 0 à 80 ; un chiffre composé (« 24h/24 », « 23h14 ») claque tel quel. */
export function chiffreCompte(texte: string, avance: number): string {
  const m = /^(\D*?)(\d+(?:[.,]\d+)?)(.*)$/.exec(texte);
  if (!m || /\d/.test(m[3])) return texte;
  const valeur = Number(m[2].replace(",", "."));
  if (!(valeur > 1)) return texte;
  const decimales = (m[2].split(/[.,]/)[1] ?? "").length;
  const courant = valeur * (1 - Math.pow(1 - c01(avance), 3));
  const ecrit = decimales ? courant.toFixed(decimales).replace(".", m[2].includes(",") ? "," : ".") : String(Math.round(courant));
  return `${m[1]}${ecrit}${m[3]}`;
}

/** Texte tapé à l'instant `t` (frappe régulière, `vitesse` signes/s) et curseur qui clignote. */
/**
 * Frappe MOT PAR MOT : chaque mot commence à son heure (`heures[i]`) et se tape à `vitesse` signes/s ; un mot ne
 * commence qu'une fois le précédent fini. Chaque début de mot fait apparaître quelque chose de nouveau (rythme, Q14).
 */
export function planFrappeMots(texte: string, t: number, heures: readonly number[], vitesse = VITESSE_FRAPPE) {
  const mots = texte.split(/\s+/).filter(Boolean);
  let tape = "";
  let fin = -Infinity;
  let fini = true;
  for (let i = 0; i < mots.length; i++) {
    const debut = Math.max(heures[Math.min(i, heures.length - 1)] ?? 0, fin);
    if (t < debut) {
      fini = false;
      break;
    }
    const n = Math.min(mots[i].length, Math.floor((t - debut) * vitesse));
    tape += (i ? " " : "") + mots[i].slice(0, n);
    fin = debut + mots[i].length / vitesse;
    if (n < mots[i].length) {
      fini = false;
      break;
    }
  }
  const premier = heures[0] ?? 0;
  if (t < premier) return { texte: "", fini: false, curseur: false };
  return { texte: tape, fini, curseur: !fini || Math.floor((t - premier) * 2.5) % 2 === 0 };
}

/** Instants où la recherche fait apparaître quelque chose de nouveau : le début de chaque mot tapé, puis « Trouvé ». */
export function instantsRecherche(p: { requete: string; debut: number; mots?: readonly number[]; trouve?: { t: number } }): number[] {
  const heures = p.mots?.length ? [...p.mots] : [p.debut];
  return [...heures, ...(p.trouve ? [p.trouve.t] : [])].sort((a, b) => a - b);
}

export function planFrappe(texte: string, t: number, debut: number, vitesse = VITESSE_FRAPPE) {
  if (t < debut) return { texte: "", fini: false, curseur: false };
  const n = Math.min(texte.length, Math.floor((t - debut) * vitesse));
  return { texte: texte.slice(0, n), fini: n >= texte.length, curseur: n < texte.length || Math.floor((t - debut) * 2.5) % 2 === 0 };
}

/* ------------------------------------------------------------------ */
/* K10 · Cartes bénéfices et récapitulatif                              */
/* ------------------------------------------------------------------ */

/** Un bénéfice : titre, phrase concrète, icône LUE sur l'image (table de L1), micro-objet qui le joue (banque L9b). */
export type BeneficeIV = { id: string; titre: string; ligne?: string; icone?: string; micro?: NomMicroObjet };

/** Bande de contenu sous un en-tête (fractions de la hauteur) : la zone utile (`mise-en-page.ts`). */
export const BANDE_SOUS_ENTETE = Object.freeze({ haut: ZONE_OBJETS_IV.y / H, bas: (ZONE_OBJETS_IV.y + ZONE_OBJETS_IV.hauteur) / H });

export type PlanCarteBenefice = {
  boite: { x: number; y: number; largeur: number; hauteur: number };
  titre: TexteAjuste;
  ligne: TexteAjuste | null;
  icone: number;
  /** Place du micro-objet (L9b), sous la carte : un carré centré, au plus `MICRO_MAX` de côté. */
  microObjet: { x: number; y: number; largeur: number; hauteur: number } | null;
  alertes: string[];
};

const PADDING_CARTE = 52;
const ICONE_CARTE = 120;
const ECART_MICRO = 36;
/** Côté du micro-objet sous la carte : entre 200 et 420 px (la carte et lui remplissent la zone). */
const MICRO_MIN = 200;
const MICRO_MAX = 420;
/** Côté visé pour le micro-objet : le texte de la carte rétrécit (jamais sous le plancher) pour le lui laisser. */
const MICRO_VOULU = 300;

/**
 * Grande carte d'un bénéfice : la pastille d'icône À GAUCHE du titre (Anton), la phrase concrète (Inter) dessous ; le
 * micro-objet sous la carte. Carte + micro-objet forment UN bloc centré verticalement dans la zone utile ; le
 * micro-objet prend la place qui reste (≤ 420 px), la carte grandit d'autant si elle est seule.
 */
export function planCarteBenefice(b: BeneficeIV, zone: ZoneIV = ZONE_OBJETS_IV): PlanCarteBenefice {
  const largeur = zone.largeur;
  const interieur = largeur - 2 * PADDING_CARTE;
  const largeurTitre = interieur - ICONE_CARTE - 32;
  // Le plus grand texte qui laisse au micro-objet au moins `MICRO_VOULU` ; sinon la plus petite version (≥ plancher).
  const mesurer = (tailleTitre: number, tailleLigne: number) => {
    const titre = ajusterTexte(b.titre.toUpperCase(), { largeur: largeurTitre, tailleMax: tailleTitre, signe: SIGNES.anton, lignesMax: 2, plusGrand: true, hauteurMax: 2 * tailleTitre * INTERLIGNE_IV });
    const ligne = b.ligne ? ajusterTexte(b.ligne, { largeur: interieur, tailleMax: tailleLigne, signe: SIGNES.inter, lignesMax: 4 }) : null;
    const tete = Math.max(ICONE_CARTE, hauteurTexte(titre));
    return { titre, ligne, naturelle: Math.round(PADDING_CARTE * 2 + tete + (ligne ? 30 + hauteurTexte(ligne) : 0)) };
  };
  const versions = [mesurer(0.056 * H, 0.036 * H), mesurer(0.046 * H, 0.033 * H), mesurer(0.04 * H, PLANCHER_PX)];
  const { titre, ligne, naturelle } = (b.micro && versions.find((v) => zone.hauteur - v.naturelle - ECART_MICRO >= MICRO_VOULU)) || (b.micro ? versions[versions.length - 1] : versions[0]);
  const reste = zone.hauteur - naturelle - ECART_MICRO;
  const avecMicro = b.micro !== undefined && reste >= MICRO_MIN;
  const cote = avecMicro ? Math.min(MICRO_MAX, reste) : 0;
  // Sans micro-objet, la carte s'étire jusqu'à 70 % de la zone (texte centré dedans) pour ne pas laisser un bas vide.
  const hauteur = avecMicro ? naturelle : Math.max(naturelle, Math.round(0.72 * zone.hauteur));
  const bloc = hauteur + (avecMicro ? ECART_MICRO + cote : 0);
  const y = Math.round(centrer(bloc, zone));
  const boite = { x: zone.x, y, largeur, hauteur };
  const alertes = [titre.alerte, ligne?.alerte ?? null].filter((a): a is string => a !== null);
  if (y + bloc > zone.y + zone.hauteur + 1e-6) alertes.push(`Carte « ${b.titre} » trop haute pour la zone utile.`);
  return {
    boite,
    titre,
    ligne,
    icone: ICONE_CARTE,
    microObjet: avecMicro ? { x: zone.x + (largeur - cote) / 2, y: y + hauteur + ECART_MICRO, largeur: cote, hauteur: cote } : null,
    alertes,
  };
}

/** État de la séquence des cartes à l'instant `t` : carte courante, son entrée (0 à 1), la sortie de la précédente (0 à 1). */
export function etatBenefices(heures: readonly number[], t: number) {
  let courante = -1;
  heures.forEach((h, i) => {
    if (t >= h - 0.15) courante = i;
  });
  const entree = courante < 0 ? 0 : progres(t, heures[courante] - 0.15, 0.5);
  return { courante, entree, sortie: courante > 0 ? progres(t, heures[courante] - 0.15, 0.35) : 0 };
}

export type LigneRecap = { id: string; y: number; hauteur: number; titre: TexteAjuste; icone: number; entree: number };

/**
 * Récapitulatif : les N cartes en ligne (l'image reconstituée), une rangée chacune : pastille d'icône + titre (≥ plancher,
 * 2 lignes au plus ; la rangée grandit pour un titre sur 2 lignes) ; entrée en cascade (0,12 s d'écart) depuis `debut`.
 * Les rangées se partagent la zone utile (170 px au plus chacune) et le bloc y est centré.
 */
export function planRecap(benefices: readonly BeneficeIV[], t: number, debut: number, zone: ZoneIV = ZONE_OBJETS_IV) {
  const dispo = zone.hauteur;
  const n = Math.max(1, benefices.length);
  // Écart, marge intérieure et pastille suivent la hauteur de la zone (une rangée par bénéfice) : 22, 28 et 96 px au plus,
  // la pastille jamais plus petite que le plancher de lisibilité.
  const ecart = Math.min(22, Math.floor(dispo / (n * 8)));
  const pad = Math.min(28, Math.floor(dispo / (n * 6)));
  const plancherIcone = Math.ceil(PLANCHER_PX);
  let icone = Math.max(plancherIcone, Math.min(96, Math.floor((dispo - (n - 1) * ecart) / n) - pad));
  const mesurer = (tailleMax: number) => benefices.map((b) => ajusterTexte(b.titre.toUpperCase(), { largeur: zone.largeur - 2 * 32 - icone - 32, tailleMax, signe: SIGNES.anton, lignesMax: 2 }));
  const hauteurs = (ts: TexteAjuste[]) => ts.map((x) => Math.max(icone + pad, hauteurTexte(x) + pad));
  const total = (ts: TexteAjuste[]) => hauteurs(ts).reduce((a, b) => a + b, 0) + (n - 1) * ecart;
  // Taille commune la plus grande (pas de 2 px, jamais sous le plancher) pour que toutes les rangées tiennent ; si le
  // texte est déjà au plancher, la pastille rétrécit (jamais sous le plancher) pour laisser une rangée sur 2 lignes.
  let tailleMax = 0.046 * H;
  for (;;) {
    while (tailleMax - 2 >= PLANCHER_PX && total(mesurer(tailleMax)) > dispo) tailleMax -= 2;
    if (total(mesurer(tailleMax)) <= dispo || icone - 2 < plancherIcone) break;
    icone -= 2;
  }
  const titres = mesurer(tailleMax);
  // Chaque rangée prend la hauteur de son titre (icône comprise) ; la place qui reste est partagée, 170 px au plus.
  const minimum = hauteurs(titres);
  const surplus = Math.max(0, (dispo - (n - 1) * ecart - minimum.reduce((a, b) => a + b, 0)) / n);
  const hauteursFinales = minimum.map((m) => Math.max(m, Math.min(170, m + surplus)));
  const bloc = hauteursFinales.reduce((a, b) => a + b, 0) + (n - 1) * ecart;
  let y = centrer(bloc, zone);
  const lignes: LigneRecap[] = benefices.map((b, i) => {
    const l = { id: b.id, y, hauteur: hauteursFinales[i], icone, titre: titres[i], entree: progres(t, debut + i * 0.12, 0.45) };
    y += hauteursFinales[i] + ecart;
    return l;
  });
  const alertes = titres.map((x) => x.alerte).filter((a): a is string => a !== null);
  if (y - ecart > zone.y + zone.hauteur + 1e-6) alertes.push("Récapitulatif trop haut pour la zone utile : titres à raccourcir.");
  return { lignes, x: zone.x, largeur: zone.largeur, alertes };
}

/**
 * Le paperboard de l'image A redessiné (jamais la photo : des personnes y figurent) : étapes reliées par des flèches.
 * Tableau + pieds remplissent la zone utile (centrés), dans les marges.
 */
export function planPaperboard(etapes: readonly string[], t: number, debut: number, zone: ZoneIV = ZONE_OBJETS_IV) {
  const largeur = Math.min(800, zone.largeur);
  const n = Math.max(1, etapes.length);
  // Pieds et marge du tableau suivent la hauteur de la zone (130 et 60 px au plus) : les étapes gardent le plancher.
  const pieds = Math.min(130, Math.round(0.16 * zone.hauteur));
  const marge = Math.min(60, Math.round(0.06 * zone.hauteur));
  const hauteurTableau = zone.hauteur - pieds;
  // Étapes et flèches se partagent la hauteur du tableau : une étape = 1,7 × la taille, une flèche = 0,55 étape.
  const hauteurEtape = (hauteurTableau - 2 * marge) / (n + 0.55 * (n - 1));
  const ecart = 0.55 * hauteurEtape;
  const tailles = etapes.map((e) => ajusterTexte(e.toUpperCase(), { largeur: largeur - 200, tailleMax: Math.min(0.06 * H, hauteurEtape / 1.7), signe: SIGNES.anton, lignesMax: 1 }));
  const taille = Math.min(...tailles.map((x) => x.taille));
  return {
    x: zone.x + (zone.largeur - largeur) / 2,
    y: zone.y,
    largeur,
    hauteurTableau,
    hauteurEtape,
    ecart,
    marge,
    pieds,
    taille,
    etapes: etapes.map((e, i) => ({ texte: e, entree: progres(t, debut + 0.25 + i * 0.35, 0.4), fleche: i === 0 ? 1 : doux(progres(t, debut + 0.1 + i * 0.35, 0.3)) })),
    alertes: tailles.map((x) => x.alerte).filter((a): a is string => a !== null),
  };
}

/* ------------------------------------------------------------------ */
/* K12 · Bandeau des chiffres                                           */
/* ------------------------------------------------------------------ */

export type ChiffreBandeau = { texte: string; legende?: string; t: number };

export function planBandeau(chiffres: readonly ChiffreBandeau[], t: number) {
  const n = Math.max(1, Math.min(4, chiffres.length));
  // Sous l'étiquette (0,15 × hauteur) jusqu'au bas de la zone utile : les rangées remplissent l'écran.
  const haut = 0.2 * H;
  const bas = ZONE_OBJETS_IV.y + ZONE_OBJETS_IV.hauteur;
  const rang = (bas - haut) / n;
  const colChiffre = 0.5 * (W - 2 * MARGE_IV);
  const colLegende = W - 2 * MARGE_IV - colChiffre - 40;
  const rangees = chiffres.slice(0, 4).map((c, i) => {
    const chiffre = ajusterTexte(c.texte.toUpperCase(), { largeur: colChiffre, tailleMax: Math.min(0.1 * H, rang * 0.8), signe: SIGNES.anton, lignesMax: 1 });
    const legende = c.legende ? ajusterTexte(c.legende, { largeur: colLegende, tailleMax: 0.034 * H, signe: SIGNES.inter, lignesMax: 2 }) : null;
    const claque = planClaque(t, c.t);
    return {
      y: haut + i * rang,
      hauteur: rang,
      chiffre,
      legende,
      texte: chiffreCompte(c.texte.toUpperCase(), progres(t, c.t, 0.7)),
      claque,
      legendeEntree: progres(t, c.t + 0.15, 0.35),
      orange: i === 0,
    };
  });
  const alertes = rangees.flatMap((r) => [r.chiffre.alerte, r.legende?.alerte ?? null]).filter((a): a is string => a !== null);
  if (chiffres.length < 2 || chiffres.length > 4) alertes.push(`Bandeau : ${chiffres.length} chiffre(s), il en faut 2 à 4.`);
  return { rangees, colChiffre, colLegende, alertes };
}

/* ------------------------------------------------------------------ */
/* K13 · Repère de progression « 2/3 »                                  */
/* ------------------------------------------------------------------ */

/** Haut du repère (fraction de la hauteur) : sous la marque, au-dessus de l'étiquette de l'en-tête. */
export const HAUT_REPERE = 0.08;

export type ChangementRepere = { t: number; numero: number };

/** Repère à l'instant `t` : numéro courant (et le précédent pendant la bascule), avancée de la bascule (0 à 1). */
export function planRepere(changements: readonly ChangementRepere[], total: number, t: number, prefixe?: string) {
  const tries = [...changements].sort((a, b) => a.t - b.t || a.numero - b.numero);
  let i = -1;
  tries.forEach((c, k) => {
    if (t >= c.t) i = k;
  });
  if (i < 0) return null;
  const courant = tries[i];
  const precedent = i > 0 ? tries[i - 1].numero : null;
  const bascule = progres(t, courant.t, 0.45);
  const texte = (n: number) => `${prefixe ? `${prefixe} ` : ""}${n}/${total}`;
  const taille = PLANCHER_PX;
  // Chiffres Anton plus larges que la moyenne : 0,5 de la taille par signe.
  const largeur = Math.max(texte(courant.numero).length, precedent === null ? 0 : texte(precedent).length) * 0.5 * taille + 2 * 34;
  return {
    texte: texte(courant.numero),
    ancien: precedent === null ? null : texte(precedent),
    bascule,
    entree: i === 0 ? progres(t, courant.t, 0.35) : 1,
    taille,
    largeur,
    segments: Array.from({ length: total }, (_, k) => (k + 1 < courant.numero ? 1 : k + 1 === courant.numero ? doux(bascule) : 0)),
  };
}

/* ------------------------------------------------------------------ */
/* K14 · Recherche                                                      */
/* ------------------------------------------------------------------ */

/**
 * Recherche : la barre en haut de la zone utile, le résultat (grande carte : coche verte, « TROUVÉ — 3 SECONDES » sur
 * une ou deux lignes) qui remplit le reste de la zone. Rien d'inventé : seuls la requête et le résultat lus.
 */
export function planRecherche(p: { requete: string; debut: number; mots?: readonly number[]; trouve?: { texte: string; t: number } }, t: number, zone: ZoneIV = ZONE_OBJETS_IV) {
  const largeurBarre = zone.largeur;
  const requete = ajusterTexte(p.requete, { largeur: largeurBarre - 2 * 40 - 90, tailleMax: 0.036 * H, signe: SIGNES.inter, lignesMax: 1 });
  const hauteurBarre = Math.round(requete.taille * 2.4);
  const ecart = 40;
  const resultatY = zone.y + hauteurBarre + ecart;
  const hauteurResultat = zone.y + zone.hauteur - resultatY;
  const trouve = p.trouve ? ajusterTexte(p.trouve.texte.toUpperCase(), { largeur: largeurBarre - 2 * 60, tailleMax: 0.075 * H, signe: SIGNES.anton, lignesMax: 2, plusGrand: true, hauteurMax: hauteurResultat - 320 }) : null;
  return {
    largeurBarre,
    barre: { x: zone.x, y: zone.y, largeur: largeurBarre, hauteur: hauteurBarre },
    resultatBoite: { x: zone.x, y: resultatY, largeur: largeurBarre, hauteur: hauteurResultat },
    requete,
    trouve,
    entree: progres(t, p.debut - 0.3, 0.4),
    // Mot par mot quand la mise en scène donne une heure par mot ; sinon d'un trait depuis `debut`.
    frappe: p.mots?.length ? planFrappeMots(p.requete, t, p.mots) : planFrappe(p.requete, t, p.debut),
    resultat: p.trouve ? progres(t, p.trouve.t, 0.45) : 0,
    coche: p.trouve ? progres(t, p.trouve.t + 0.2, 0.35) : 0,
    alertes: [requete.alerte, trouve?.alerte ?? null].filter((a): a is string => a !== null),
  };
}

/* ------------------------------------------------------------------ */
/* K15 · Alerte (notification qui tombe et secoue l'écran)              */
/* ------------------------------------------------------------------ */

/** Secousse de l'écran à l'arrivée d'une alerte (pixels) : amortie, 0,45 s, déterministe. */
export function secousseAlerte(t: number, t0: number) {
  const arrivee = t0 + 0.35;
  if (t < arrivee || t > arrivee + 0.45) return { x: 0, y: 0 };
  const u = (t - arrivee) / 0.45;
  const amplitude = 18 * (1 - u);
  return { x: Math.round(amplitude * Math.sin(u * Math.PI * 7) * 10) / 10, y: Math.round(amplitude * 0.4 * Math.cos(u * Math.PI * 9) * 10) / 10 };
}

/** Écart vertical entre deux déclencheurs, et entre le dernier et la notification. */
const ECART_DECLENCHEURS = 24;

/**
 * Alerte : un téléphone (écran verrouillé) remplit la zone utile, centré ; la notification tombe dedans, en haut de
 * l'écran, et la cloche s'agite au centre.
 */
export function planAlerte(p: { source: string; moment?: string; message: string; t: number; declencheurs?: readonly DeclencheurAlerte[]; tampon?: TamponIV; frappe?: number }, t: number, zone: ZoneIV = ZONE_OBJETS_IV) {
  const telephone = { x: zone.x + (zone.largeur - 720) / 2, y: zone.y, largeur: 720, hauteur: zone.hauteur };
  const largeur = telephone.largeur - 2 * 30;
  const message = ajusterTexte(p.message, { largeur: largeur - 2 * 36 - 150, tailleMax: 0.036 * H, signe: SIGNES.inter, lignesMax: 2 });
  const chute = progres(t, p.t, 0.35);
  // Avec des déclencheurs, la notification ne tombe que de l'écart qui la sépare du dernier (sinon elle traverserait la ligne
  // « Envoyé équipe concernée » en chutant de 420 px) ; sans déclencheur, elle tombe d'en haut de l'écran.
  const hauteurChute = (p.declencheurs ?? []).length ? ECART_DECLENCHEURS : 420;
  // Déclencheurs : en haut de l'écran verrouillé, dans l'ordre où ils sont dits, chacun monte et s'allume sur son mot ;
  // la notification tombe juste dessous (elle prend la place de la cloche, qui ne tient plus).
  let y = telephone.y + HAUT_DECLENCHEURS_ALERTE;
  const declencheurs = (p.declencheurs ?? []).map((d, i, tous) => {
    const texte = ajusterTexte(d.texte, { largeur: largeur - 2 * 32 - PUCE_DECLENCHEUR - 24, tailleMax: PLANCHER_PX, signe: SIGNES.inter, lignesMax: 2 });
    const hauteur = Math.max(PUCE_DECLENCHEUR, hauteurTexte(texte)) + 2 * 26;
    const entree = progres(t, d.t, 0.35);
    // Le dernier déclencheur ne monte plus de 40 px une fois la notification là (elle n'est qu'à ECART_DECLENCHEURS dessous) :
    // sa montée s'éteint dans les 0,1 s qui précèdent la chute, il ne fait alors que s'allumer en place.
    const montee = i === tous.length - 1 ? 40 * (1 - progres(t, p.t - 0.1, 0.1)) : 40;
    const b = { x: telephone.x + 30, y, largeur, hauteur, texte, opacite: c01(entree * 2), decalageY: montee * (1 - doux(entree)) };
    y += hauteur + ECART_DECLENCHEURS;
    return b;
  });
  const notification = { x: telephone.x + 30, y: declencheurs.length ? y : telephone.y + 150 };
  const hauteurNotification = 2 * 30 + Math.max(116, TAILLE_ETIQUETTE_PX * 1.2 + 10 + hauteurTexte(message));
  const deborde = notification.y + hauteurNotification > telephone.y + telephone.hauteur - 30;
  return {
    declencheurs,
    hauteurNotification,
    cloche: declencheurs.length === 0,
    telephone,
    notification,
    largeur,
    message,
    etiquette: [p.source, p.moment].filter(Boolean).join(" · "),
    opacite: c01(chute * 3),
    decalageY: t < p.t ? -hauteurChute : -hauteurChute * (1 - (chute < 1 ? chute * chute : 1)) + (chute >= 1 ? -14 * Math.sin(Math.PI * progres(t, p.t + 0.35, 0.25)) : 0),
    secousse: secousseAlerte(t, p.t),
    // Message écrit après la chute (`frappe`, alerte nommée tard) : trois points « en train d'écrire » jusque-là.
    opaciteMessage: p.frappe === undefined ? 1 : progres(t, p.frappe, 0.25),
    // « Lu ✓ » : s'allume en haut à droite de la notification (dans sa carte, rien ne déborde), jamais avant qu'elle tombe.
    tampon: p.tampon ? planTampon(p.tampon, t, p.t + 0.35) : null,
    angleCloche: t < p.t + 0.35 ? 0 : 16 * Math.sin((t - p.t - 0.35) * 18) * Math.max(0, 1 - (t - p.t - 0.35) / 0.9),
    alertes: [message.alerte, ...declencheurs.map((d) => d.texte.alerte), deborde ? "L'alerte et ce qui la déclenche ne tiennent pas sur le téléphone : à raccourcir." : null].filter((a): a is string => a !== null),
  };
}

/**
 * Tampon d'un objet (« Lu ✓ » sur la notification, « Envoyé ✓ » dans l'en-tête de l'e-mail) : relance du rythme (Q14)
 * quand plus rien d'autre n'arrive, en une ou deux étapes (« Reçu » puis « Lu »). Invisible avant sa première heure (et
 * avant `apres`) ; chaque étape remplace la précédente avec un petit rebond.
 */
export type TamponIV = { texte: string; t: number }[];
function planTampon(p: TamponIV, t: number, apres: number) {
  const heures = p.map((x) => Math.max(x.t, apres));
  const i = heures.reduce((k, h, j) => (t >= h ? j : k), -1);
  const entree = progres(t, heures[Math.max(0, i)], 0.25);
  const echelle = i < 0 ? 0.6 : i === 0 && entree < 1 ? 0.6 + 0.55 * doux(entree) : entree < 1 ? 1 + 0.15 * doux(entree) : 1 + 0.15 * (1 - doux(progres(t, heures[i] + 0.25, 0.2)));
  return { texte: p[Math.max(0, i)]?.texte ?? "", opacite: i < 0 ? 0 : i === 0 ? c01(entree) : 1, echelle };
}

/** Ce qui déclenche l'alerte (« le client écrit ») : un nœud cité, montré sur le mot qui le nomme. */
export type DeclencheurAlerte = { texte: string; t: number };
/** Haut du premier déclencheur (sous l'encoche) depuis le haut du téléphone ; diamètre de sa puce. */
export const HAUT_DECLENCHEURS_ALERTE = 110;
export const PUCE_DECLENCHEUR = 64;

/* ------------------------------------------------------------------ */
/* K16 · E-mail structuré                                               */
/* ------------------------------------------------------------------ */

/**
 * Un champ de l'e-mail ; sans `valeur` (rien d'écrit sur l'image), une ligne se remplit sans texte inventé. `libre` :
 * un bloc de la carte posé dans l'e-mail (« Envoyé équipe concernée ») : son libellé s'écrit sur toute la largeur, sur
 * son mot, sans barres.
 */
export type ChampEmail = { nom: string; valeur?: string; t: number; libre?: true };

/** Deux barres d'un champ sans valeur (26 + 16 + 26 px) ; écart entre le nom et sa valeur quand ils sont sur une ligne. */
export const HAUTEUR_BARRES_EMAIL = 68;
export const ECART_NOM_EMAIL = 24;
/** Icône d'envoi devant un champ libre. */
export const ICONE_LIBRE_EMAIL = 56;

/**
 * E-mail structuré : la carte remplit la zone utile ; les champs se partagent sa hauteur. Le nom d'un champ est écrit au
 * plancher de lisibilité (jamais en petite étiquette) ; sans valeur lue sur l'image, deux barres se remplissent.
 */
export function planEmail(p: { champs: readonly ChampEmail[]; debut: number; tampon?: TamponIV }, t: number, zone: ZoneIV = ZONE_OBJETS_IV) {
  const largeur = zone.largeur;
  const interieur = largeur - 2 * 48;
  // Bandeau d'en-tête : 130 px au plus, moins quand la zone est basse (jamais sous 1,6 × le plancher, son texte y tient).
  const enTete = Math.round(Math.min(130, Math.max(1.6 * PLANCHER_PX, 0.16 * zone.hauteur)));
  const n = Math.max(1, p.champs.length);
  const pas = (zone.hauteur - enTete - 30) / n;
  // Zone basse : si un champ ne tient pas avec son nom AU-DESSUS (nom, puis valeur ou barres), le nom passe À GAUCHE et
  // la valeur (ou les barres) à sa droite, sur la même hauteur. Le nom reste au plancher.
  const nommes = p.champs.filter((c) => !c.libre);
  const largeurNom = Math.ceil(Math.max(0, ...nommes.map((c) => [...c.nom].length)) * CHASSE_IV.inter * PLANCHER_PX);
  const empile = (v: TexteAjuste | null) => PLANCHER_PX * INTERLIGNE_IV + 16 + (v ? hauteurTexte(v) : HAUTEUR_BARRES_EMAIL);
  const valeurDe = (c: ChampEmail, largeur: number) => (c.valeur ? ajusterTexte(c.valeur, { largeur, tailleMax: PLANCHER_PX, signe: SIGNES.inter, lignesMax: 2 }) : null);
  const enLigne = nommes.some((c) => empile(valeurDe(c, interieur)) > pas - 12);
  const champs = p.champs.map((c, i) => {
    const valeur = valeurDe(c, enLigne ? interieur - largeurNom - ECART_NOM_EMAIL : interieur);
    const libre = c.libre ? ajusterTexte(c.nom, { largeur: interieur - ICONE_LIBRE_EMAIL - ECART_NOM_EMAIL, tailleMax: PLANCHER_PX, signe: SIGNES.inter, lignesMax: 2 }) : null;
    return {
      nom: c.nom,
      tailleNom: libre?.taille ?? PLANCHER_PX,
      libre,
      // Écrit en entier en 0,2 s au plus : le libellé est lisible même posé en fin d'écran.
      frappeLibre: c.libre ? planFrappe(c.nom, t, c.t, Math.max(30, c.nom.length / 0.2)) : null,
      y: enTete + 20 + i * pas,
      hauteur: pas - 12,
      valeur,
      frappe: c.valeur ? planFrappe(c.valeur, t, c.t, 30) : null,
      remplissage: doux(progres(t, c.t, 0.5)),
      entree: progres(t, Math.min(c.t - 0.2, p.debut + 0.25 + i * 0.1), 0.3),
    };
  });
  const alertes = champs.map((c) => c.valeur?.alerte ?? c.libre?.alerte ?? null).filter((a): a is string => a !== null);
  const requis = (c: (typeof champs)[number]) => (c.libre ? hauteurTexte(c.libre) : enLigne ? Math.max(c.tailleNom * INTERLIGNE_IV, c.valeur ? hauteurTexte(c.valeur) : HAUTEUR_BARRES_EMAIL) : empile(c.valeur));
  if (champs.some((c) => requis(c) > c.hauteur)) alertes.push("E-mail trop haut pour la zone utile : moins de champs ou des valeurs plus courtes.");
  // « Envoyé ✓ » : à droite dans le bandeau d'en-tête (rien ne déborde), jamais avant l'e-mail lui-même.
  const tampon = p.tampon ? planTampon(p.tampon, t, p.debut + 0.4) : null;
  return { boite: { x: zone.x, y: zone.y, largeur, hauteur: zone.hauteur }, enTete, champs, enLigne, largeurNom: enLigne ? largeurNom : null, entree: progres(t, p.debut, 0.4), tampon, alertes };
}

/* ------------------------------------------------------------------ */
/* K17 · Dossiers                                                       */
/* ------------------------------------------------------------------ */

export type DossierIV = { nom: string; t: number };

/** Dossiers : 2 colonnes, les rangées se partagent la zone utile, le bloc y est centré. */
export function planDossiers(p: { dossiers: readonly DossierIV[]; debut: number }, t: number, zone: ZoneIV = ZONE_OBJETS_IV) {
  const n = p.dossiers.length;
  const colonnes = n <= 2 ? n : 2;
  const rangs = Math.ceil(n / Math.max(1, colonnes));
  const largeurCase = zone.largeur / Math.max(1, colonnes);
  const hauteurCase = zone.hauteur / Math.max(1, rangs);
  const noms = p.dossiers.map((d) => ajusterTexte(d.nom, { largeur: largeurCase - 20, tailleMax: 0.036 * H, signe: SIGNES.inter, lignesMax: 2 }));
  const hauteurNom = Math.max(0, ...noms.map(hauteurTexte));
  // Le dossier est 0,78 fois plus haut que large ; sous lui, son nom (22 px d'écart), 30 px de marge entre les rangs.
  const cote = Math.max(0, Math.min(largeurCase - 60, (hauteurCase - hauteurNom - 22 - 30) / 0.78, 400));
  const hauteurDossier = cote * 0.78 + 22 + hauteurNom;
  const pasRang = hauteurDossier + 30;
  const haut = centrer(rangs * pasRang - 30, zone);
  const dossiers = p.dossiers.map((d, i) => {
    const col = i % colonnes;
    const rang = Math.floor(i / colonnes);
    const nom = noms[i];
    const cx = zone.x + (col + 0.5) * largeurCase;
    const y = haut + rang * pasRang;
    // La feuille part du haut de l'écran (au-dessus des dossiers) et tombe dans son dossier sur son mot.
    const vol = progres(t, d.t - 0.35, 0.55);
    return {
      nom,
      cx,
      y,
      cote,
      hauteur: hauteurDossier,
      entree: progres(t, p.debut + i * 0.08, 0.4),
      ouverture: t < d.t - 0.45 ? 0 : t < d.t + 0.35 ? doux(progres(t, d.t - 0.45, 0.25)) : 1 - doux(progres(t, d.t + 0.35, 0.3)),
      feuille: { avance: doux(vol), visible: vol > 0 && vol < 1, depart: { x: W / 2, y: zone.y - 40 } },
      rangee: t >= d.t + 0.2,
    };
  });
  return { dossiers, alertes: dossiers.map((d) => d.nom.alerte).filter((a): a is string => a !== null) };
}

/* ------------------------------------------------------------------ */
/* K18 · Sources qui convergent                                         */
/* ------------------------------------------------------------------ */

export type SourceIV = { icone: string; nom?: string; t: number };

/**
 * Sources qui convergent : les sources en quinconce (deux rangs) en haut de la zone utile, leur nom dessous s'il est
 * donné (au plancher, sur la largeur de deux cases : les voisines sont sur l'autre rang), la cible en bas de la zone.
 */
export function planSources(p: { sources: readonly SourceIV[]; cible: { icone: string } }, t: number, zone: ZoneIV = ZONE_OBJETS_IV) {
  const n = Math.max(1, p.sources.length);
  const largeurCase = zone.largeur / n;
  const rayon = Math.min(92, largeurCase * 0.46);
  const largeurNom = Math.min(zone.largeur, 2 * largeurCase - 20);
  const noms = p.sources.map((s) => (s.nom ? ajusterTexte(s.nom, { largeur: largeurNom, tailleMax: PLANCHER_PX, signe: SIGNES.inter, lignesMax: 1 }) : null));
  const hauteurNom = Math.max(0, ...noms.map((x) => (x ? 12 + hauteurTexte(x) : 0)));
  const cible = { x: zone.x + zone.largeur / 2, y: zone.y + zone.hauteur - 130, rayon: 130 };
  const rang1 = zone.y + rayon;
  const rang2 = rang1 + rayon + hauteurNom + 40 + rayon;
  const sources = p.sources.map((s, i) => {
    const x = zone.x + (i + 0.5) * largeurCase;
    // Quinconce : une source sur deux un rang plus bas (les noms ne se chevauchent jamais).
    const sy = n >= 4 && i % 2 === 1 ? rang2 : rang1;
    const nom = noms[i];
    const trajet = progres(t, s.t + 0.25, 0.75);
    return {
      x,
      y: sy,
      rayon,
      nom,
      entree: progres(t, s.t - 0.1, 0.4),
      fil: doux(progres(t, s.t + 0.15, 0.6)),
      feuille: { avance: doux(trajet), visible: trajet > 0 && trajet < 1 },
      arrivee: t >= s.t + 1,
    };
  });
  const premiere = Math.min(...p.sources.map((s) => s.t));
  const arrivees = p.sources.map((s) => s.t + 1).filter((a) => t >= a);
  // La cible bat à chaque feuille reçue (impulsion de 6 % en 0,3 s).
  const derniere = arrivees.length ? Math.max(...arrivees) : null;
  return {
    sources,
    hauteurNom,
    cible: { ...cible, entree: progres(t, premiere - 0.2, 0.4), impulsion: derniere === null ? 1 : 1 + 0.06 * Math.sin(Math.PI * progres(t, derniere, 0.3)), recus: arrivees.length },
    alertes: sources.map((s) => s.nom?.alerte ?? null).filter((a): a is string => a !== null),
  };
}

/* ------------------------------------------------------------------ */
/* K19 · Phrase-choc                                                    */
/* ------------------------------------------------------------------ */

const OPTIONS_PHRASE_CHOC = { largeur: W - 2 * MARGE_IV, tailleMax: 0.1 * H, signe: SIGNES.anton, lignesMax: 4, hauteurMax: 0.36 * H, plusGrand: true };

/**
 * Lignes de la phrase-choc : la coupe la plus grande (4 lignes au plus), sauf si une coupe qui fait commencer chaque
 * proposition (après « . , ; : ! ? ») sur une nouvelle ligne garde au moins 60 % de cette taille — elle se lit mieux.
 */
export function coupePhraseChoc(mots: readonly string[]): TexteAjuste {
  const libre = ajusterTexte(mots.join(" "), OPTIONS_PHRASE_CHOC);
  const propositions: string[][] = [];
  for (const m of mots) {
    if (propositions.length === 0 || /[.,;:!?]$/.test(propositions[propositions.length - 1].slice(-1)[0] ?? "")) propositions.push([]);
    propositions[propositions.length - 1].push(m);
  }
  if (propositions.length < 2 || propositions.length > OPTIONS_PHRASE_CHOC.lignesMax) return libre;
  let meilleur: TexteAjuste | null = null;
  // Toutes les répartitions de 1 à 4 lignes entre les propositions (chacune au moins une ligne).
  const repartir = (i: number, reste: number, parts: number[]) => {
    if (i === propositions.length) {
      const lignes = propositions.flatMap((pr, k) => couperEquilibre(pr, parts[k]));
      const plusLongue = Math.max(...lignes.map(signesDe));
      const taille = Math.min(OPTIONS_PHRASE_CHOC.tailleMax, OPTIONS_PHRASE_CHOC.hauteurMax / (lignes.length * INTERLIGNE_IV), OPTIONS_PHRASE_CHOC.largeur / (plusLongue * OPTIONS_PHRASE_CHOC.signe));
      if (!meilleur || taille > meilleur.taille + 1e-9) meilleur = { taille, lignes, alerte: null };
      return;
    }
    for (let n = 1; n <= reste - (propositions.length - i - 1); n++) repartir(i + 1, reste - n, [...parts, n]);
  };
  repartir(0, OPTIONS_PHRASE_CHOC.lignesMax, []);
  const propre = meilleur as TexteAjuste | null;
  return propre && propre.taille >= PLANCHER_PX && (libre.alerte || propre.taille >= 0.6 * libre.taille) ? propre : libre;
}

/**
 * Phrase-choc mot à mot (`*mot*` = l'accent orange) : chaque mot entre à son heure (`heures[i]`, sinon `debut` + i × pas),
 * le dernier s'allume (lueur), puis la marque apparaît. Lignes équilibrées, le plus grand possible, 4 lignes au plus.
 */
export function planPhraseChoc(p: { phrase: string; debut: number; heures?: readonly number[] }, t: number) {
  const mots = motsBalises(p.phrase);
  const ajuste = coupePhraseChoc(mots.map((m) => m.mot.toUpperCase()));
  const heure = (i: number) => p.heures?.[i] ?? p.debut + i * 0.32;
  let k = 0;
  const lignes = ajuste.lignes.map((l) =>
    l.map(() => {
      const i = k++;
      const m = mots[i] ?? { mot: "", accent: false };
      const x = progres(t, heure(i) - 0.08, 0.34);
      return { mot: m.mot, accent: m.accent, opacite: x, decalageY: (1 - doux(x)) * 60, flou: x < 1 ? (1 - x) * 12 : 0, echelle: 1 + 0.12 * (1 - doux(x)) };
    }),
  );
  const dernier = heure(mots.length - 1);
  const lueur = doux(progres(t, dernier + 0.2, 0.5));
  const alertes = ajuste.alerte ? [ajuste.alerte] : [];
  if (p.heures && p.heures.length !== mots.length) alertes.push(`Phrase-choc : ${mots.length} mots mais ${p.heures.length} heures.`);
  return { taille: ajuste.taille, lignes, lueur, eclair: t >= dernier && t < dernier + 0.14 ? 0.55 * (1 - (t - dernier) / 0.14) : 0, marque: progres(t, dernier + 0.6, 0.4), alertes };
}

/* ------------------------------------------------------------------ */
/* K21 · Ensemble : vue d'ensemble lisible                              */
/* ------------------------------------------------------------------ */

export type OptionsPlanEnsemble = { allumes?: readonly string[]; chiffresCles?: readonly string[]; bande?: { haut: number; bas: number }; zone?: ZoneIV };

export type ChiffreEnsemblePlan = { texte: string; x: number; y: number; largeur: number; hauteur: number; taille: number; couleur: string; branche: string | null };

/** Un bloc de la vue d'ensemble : pastille en forme de carte, icône lue sur l'image, LIBELLÉ COURT lisible. */
export type BlocEnsemble = ZoneIV & { id: string; couleur: CouleurSchema; allume: boolean; icone?: string; libelle: TexteAjuste; badge: number };

export type FlecheEnsemble = { id: string; de: { x: number; y: number }; vers: { x: number; y: number }; couleur: CouleurSchema; extremites: [string, string] };

export type PlanEnsemble = {
  zone: ZoneIV;
  blocs: BlocEnsemble[];
  fleches: FlecheEnsemble[];
  /** Rang d'apparition de chaque bloc (ordre de lecture). */
  rang: Map<string, number>;
  chiffres: ChiffreEnsemblePlan[];
  alertes: string[];
};

/** Mots outils sur lesquels une coupe ne s'arrête pas. */
const MOTS_OUTILS = new Set(["le", "la", "les", "l'", "un", "une", "des", "de", "du", "d'", "à", "au", "aux", "en", "et", "ou", "sur", "pour", "par", "avec", "sans", "dans"]);

/** Mots de fin sans valeur pour un libellé court (« Ticket clôturé auto » → « Ticket clôturé »). */
const MOTS_DE_FIN = new Set(["auto", "automatique", "automatiquement", "entrant", "entrante"]);

/**
 * Libellé COURT d'un nœud (≤ `unitesMax` unités de sens, 3 par défaut) : `court` s'il est donné et assez court ; sinon
 * le libellé sans préfixe « Branche : », ni ponctuation finale (« Alerte Telegram: »), ni mot de fin sans valeur, réduit
 * à ses premières unités. La coupe ne finit jamais sur un mot outil, un mot de fin ni un tiret.
 */
export function libelleCourt(n: Pick<SchemaEntree["noeuds"][number], "libelle" | "court">, unitesMax: number = MOTS_MAX_ENSEMBLE): string {
  const court = n.court?.trim();
  if (court && unitesDeSens(court).length <= unitesMax) return court;
  let texte = (court || n.libelle.replace(/^[^:]{1,30}\s:\s*/u, "").trim() || n.libelle).replace(/[\s:;,.]+$/u, "");
  let mots = texte.split(/\s+/).filter(Boolean);
  while (mots.length > 1 && MOTS_DE_FIN.has(mots[mots.length - 1].toLowerCase())) mots = mots.slice(0, -1);
  let unites = unitesDeSens(mots.join(" "));
  if (unites.length > unitesMax) {
    unites = unites.slice(0, Math.max(1, unitesMax));
    // « IA trie la demande » → « IA trie » ; « Message client entrant — 23h14 » → « Message client ».
    const finInutile = (u: string) => MOTS_OUTILS.has(u.toLowerCase()) || MOTS_DE_FIN.has(u.toLowerCase()) || /^[—–-]$/u.test(u);
    while (unites.length > 1 && finInutile(unites[unites.length - 1])) unites = unites.slice(0, -1);
  }
  texte = unites.join(" ").replace(/\s+[—–-]$/u, "");
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/** Mots d'un libellé court, un nombre et son unité comptant pour un (« 4 sec ») : la coupe ne tombe jamais entre eux. */
export function unitesDeSens(texte: string): string[] {
  const mots = texte.split(/\s+/).filter(Boolean);
  const res: string[] = [];
  for (let i = 0; i < mots.length; i++) res.push(/^\d/.test(mots[i]) && i + 1 < mots.length ? `${mots[i]} ${mots[++i]}` : mots[i]);
  return res;
}

/** Libellé en Anton capitales dans `largeur` : la plus grande taille ≤ `tailleMax` sur 1 ligne, sinon 2 ; jamais sous le plancher. */
function ajusterAnton(texte: string, largeur: number, tailleMax: number): TexteAjuste {
  const mots = texte.toUpperCase().split(/\s+/).filter(Boolean);
  for (let n = 1; n <= Math.min(2, mots.length); n++) {
    const lignes = couperEquilibre(mots, n);
    const plusLongue = Math.max(...lignes.map((l) => largeurAnton(l.join(" "), 1)));
    const taille = Math.min(tailleMax, largeur / plusLongue);
    if (taille >= PLANCHER_PX - 1e-9) return { taille, lignes, alerte: null };
  }
  return { taille: PLANCHER_PX, lignes: couperEquilibre(mots, Math.min(2, mots.length)), alerte: `Libellé « ${texte} » trop long pour son bloc au plancher de lisibilité : à raccourcir.` };
}

const PAD_BLOC = Object.freeze({ x: 12, y: 8 });
/** Marge verticale d'un bloc quand la vue doit se serrer pour tenir au plancher. */
const PAD_BLOC_SERRE = Object.freeze({ y: 4 });
const ECART_COLONNES = 16;
/** Pastille d'icône d'un bloc (pixels) et son écart au libellé. */
const BADGE_BLOC = 52;
const ECART_BADGE = 8;
const INTERLIGNE_BLOC = 1.04;

/**
 * Vue d'ensemble LISIBLE (B3, K21) : tout le schéma redessiné dans la ZONE UTILE, qu'il remplit et où il est centré.
 * Le tronc en haut (pleine largeur), puis une colonne par branche (la majoritaire à gauche) coiffée de sa part
 * (« 80 % », pastille à la couleur de la branche), puis ce qui suit les branches. Chaque bloc porte son icône (lue sur
 * l'image) et un LIBELLÉ COURT (≤ 3 mots) au plancher de lisibilité ou au-dessus ; l'icône s'efface d'abord si le
 * libellé ne tient pas avec elle ; une icône déjà portée par un bloc précédent n'est pas répétée. Les autres
 * chiffres-clés (≤ 3 mots) ferment le bloc. Le bloc courant est allumé, le reste atténué.
 * La vue TIENT TOUJOURS dans la zone : quand ni la taille, ni le serrage, ni les paires ne suffisent (schéma dense, ex.
 * 12 blocs aux libellés longs de v-dd3049053f88), elle est RÉDUITE (voir plus bas), jamais sous le plancher.
 */
export function planEnsemble(schema: SchemaEntree, options: OptionsPlanEnsemble = {}): PlanEnsemble {
  // La vue d'ensemble prend toute la largeur permise (marges de 5 % exactement) : ses libellés tiennent au plancher.
  const marge = Math.ceil(MARGE_LATERALE_MIN_IV * W);
  const base = options.zone ?? (options.bande ? { x: 0, y: options.bande.haut * H, largeur: W, hauteur: (options.bande.bas - options.bande.haut) * H } : ZONE_OBJETS_IV);
  const zone = { x: marge, y: base.y, largeur: W - 2 * marge, hauteur: base.hauteur };
  const alertes: string[] = [];
  const parId = new Map(schema.noeuds.map((n) => [n.id, n]));
  const ordre = [...schema.noeuds].sort((a, b) => a.ordre - b.ordre || a.id.localeCompare(b.id));
  const rang = new Map(ordre.map((n, i) => [n.id, i]));
  const allumes = new Set(options.allumes ?? schema.noeuds.map((n) => n.id));

  // Branches : groupes « branche » (la majoritaire d'abord, puis par part décroissante, puis ordre du schéma).
  const partDe = (g: GroupeEntreeIV) => Math.max(0, ...schema.liens.filter((l) => l.part !== undefined && g.noeuds.includes(l.vers)).map((l) => l.part!));
  const branches = schema.groupes
    .filter((g) => g.sorte === "branche" && g.noeuds.some((id) => parId.has(id)))
    .sort((a, b) => Number(!!b.majoritaire) - Number(!!a.majoritaire) || partDe(b) - partDe(a) || schema.groupes.indexOf(a) - schema.groupes.indexOf(b));
  const dansBranche = new Set(branches.flatMap((g) => g.noeuds));
  const colonnes = branches.map((g) => g.noeuds.filter((id) => parId.has(id)).sort((a, b) => rang.get(a)! - rang.get(b)!));
  const premierBranche = Math.min(...[...dansBranche].map((id) => rang.get(id) ?? Infinity));
  const hors = ordre.filter((n) => !dansBranche.has(n.id)).map((n) => n.id);
  const avant = branches.length ? hors.filter((id) => rang.get(id)! < premierBranche) : hors;
  const apres = branches.length ? hors.filter((id) => rang.get(id)! > premierBranche) : [];

  // Chiffres : les parts des branches deviennent la tête de leur colonne ; les autres ferment le bloc.
  const cles = (options.chiffresCles ?? [...new Set((schema.chiffres ?? []).filter((c) => c.aDire).map((c) => c.brut))]).filter((t) => nombreDeMots(t) <= MOTS_MAX_ENSEMBLE).slice(0, 3);
  const normalise = (t: string) => t.replace(/\s/g, "");
  const partsBranches = branches.map((g) => {
    const l = schema.liens.find((x) => x.part !== undefined && g.noeuds.includes(x.vers));
    return l && cles.some((c) => normalise(c) === normalise(`${l.part} %`)) ? { texte: `${l.part} %`, couleur: l.couleur ?? parId.get(l.vers)?.couleur ?? "noir" } : null;
  });
  const autres = cles.filter((c) => !partsBranches.some((p) => p && normalise(p.texte) === normalise(c)));
  // Une icône n'est portée que par le PREMIER bloc qui l'a (ordre de lecture) : jamais deux éléments, une même icône.
  const porteurs = new Map<string, string>();
  for (const n of ordre) if (n.icone && !porteurs.has(n.icone)) porteurs.set(n.icone, n.id);
  const iconeDe = (id: string) => {
    const icone = parId.get(id)?.icone;
    return icone && porteurs.get(icone) === id ? icone : undefined;
  };
  // Unités de sens permises par libellé (3 ; moins pour un libellé raccourci par la vue réduite).
  const unitesMax = new Map<string, number>();
  const texteDe = (id: string) => libelleCourt(parId.get(id)!, unitesMax.get(id) ?? MOTS_MAX_ENSEMBLE);

  const nb = Math.max(1, branches.length);
  const largeurColonne = (zone.largeur - (nb - 1) * ECART_COLONNES) / nb;
  const largeurTronc = branches.length ? Math.min(zone.largeur, Math.max(largeurColonne, zone.largeur * 0.62)) : Math.min(zone.largeur, 760);

  // Mesure à une taille donnée : un bloc = badge d'icône (si le libellé tient avec lui) + libellé.
  // Les icônes restent sur TOUS les blocs ou sur aucun : si un libellé ne tient pas avec la sienne, toutes s'effacent.
  let padY: number = PAD_BLOC.y;
  let serre = false;
  // Vue RÉDUITE (dernier recours, voir plus bas) : chiffres-clés à la taille des libellés.
  let reduite = false;
  // En dernier recours (le tronc seul dépasse encore), les blocs du tronc vont DEUX PAR RANGÉE, côte à côte.
  let paires = false;
  const largeurPaire = (zone.largeur - ECART_COLONNES) / 2;
  const largeurDe = (id: string) => (dansBranche.has(id) ? largeurColonne : paires ? largeurPaire : largeurTronc);
  const iconesTiennent = () => schema.noeuds.every((n) => !iconeDe(n.id) || !ajusterAnton(texteDe(n.id), largeurDe(n.id) - 2 * PAD_BLOC.x - BADGE_BLOC - ECART_BADGE, PLANCHER_PX).alerte);
  let avecIcones = iconesTiennent();
  const mesurer = (id: string, largeur: number, tailleMax: number) => {
    const texte = texteDe(id);
    const interieur = largeur - 2 * PAD_BLOC.x;
    const badge = iconeDe(id) && avecIcones ? BADGE_BLOC : 0;
    // L'icône reste tant que le libellé tient avec elle (2 lignes au plus) ; sinon elle s'efface, le libellé d'abord.
    const avec = badge ? ajusterAnton(texte, interieur - badge - ECART_BADGE, tailleMax) : null;
    const libelle = avec && !avec.alerte ? avec : ajusterAnton(texte, interieur, tailleMax);
    return { libelle, badge: avec && !avec.alerte ? badge : 0, hauteur: Math.max(libelle.lignes.length * libelle.taille * INTERLIGNE_BLOC, avec && !avec.alerte ? badge : 0) + 2 * padY };
  };

  type Rangee = { sorte: "tronc" | "parts" | "branches" | "chiffres"; ids: (string | null)[]; hauteur: number };
  const construire = (tailleMax: number) => {
    const mesures = new Map<string, ReturnType<typeof mesurer>>();
    const rangees: Rangee[] = [];
    const tronc = (ids: string[]) => {
      for (let k = 0; k < ids.length; k += paires ? 2 : 1) {
        const rangee = ids.slice(k, k + (paires ? 2 : 1));
        let h = 0;
        for (const id of rangee) {
          const m = mesurer(id, largeurDe(id), tailleMax);
          mesures.set(id, m);
          h = Math.max(h, m.hauteur);
        }
        rangees.push({ sorte: "tronc", ids: rangee, hauteur: h });
      }
    };
    tronc(avant);
    const taillePart = Math.min(0.05 * H, tailleMax * (serre ? 1.15 : 1.3));
    if (partsBranches.some(Boolean)) rangees.push({ sorte: "parts", ids: [], hauteur: taillePart * (serre ? 1.2 : 1.25) });
    const profondeur = Math.max(0, ...colonnes.map((c) => c.length));
    for (let k = 0; k < profondeur; k++) {
      const ids = colonnes.map((c) => c[k] ?? null);
      let h = 0;
      for (const id of ids) {
        if (!id) continue;
        const m = mesurer(id, largeurColonne, tailleMax);
        mesures.set(id, m);
        h = Math.max(h, m.hauteur);
      }
      rangees.push({ sorte: "branches", ids, hauteur: h });
    }
    tronc(apres);
    if (autres.length) rangees.push({ sorte: "chiffres", ids: [], hauteur: Math.min(0.06 * H, tailleMax * (reduite ? 1 : 1.5)) * 1.15 });
    const total = rangees.reduce((s, r) => s + r.hauteur, 0);
    return { mesures, rangees, total, taillePart };
  };

  // La plus grande taille (pas de 2 px, ≥ plancher) dont les rangées, avec un écart minimal de 12 px, tiennent. Si le
  // plancher ne suffit pas (zone utile basse, sous-titres remontés), la vue se SERRE : marges des blocs, écart et parts
  // réduits, jamais les libellés (toujours au plancher ou au-dessus).
  let ECART_MIN = 12;
  let tailleMax = 0.036 * H;
  let c = construire(tailleMax);
  const tropHaut = () => c.total + (c.rangees.length - 1) * ECART_MIN > zone.hauteur;
  // Vue réduite : les blocs d'UNE rangée dont le libellé prend 2 lignes, à raccourcir d'une unité de sens. La rangée
  // choisie est celle qui perd le moins de mots (un libellé réduit à un seul mot compte un de plus) ; à égalité, la
  // première. `null` : plus rien à raccourcir.
  const raccourcir = (v: ReturnType<typeof construire>): string[] | null => {
    let meilleur: { ids: string[]; perte: number } | null = null;
    for (const r of v.rangees) {
      const ids = r.ids.filter((id): id is string => !!id && (v.mesures.get(id)?.libelle.lignes.length ?? 1) > 1);
      if (!ids.length || ids.some((id) => (unitesMax.get(id) ?? MOTS_MAX_ENSEMBLE) <= 1)) continue;
      const perte = ids.reduce((s, id) => {
        const apres = unitesDeSens(libelleCourt(parId.get(id)!, (unitesMax.get(id) ?? MOTS_MAX_ENSEMBLE) - 1)).length;
        return s + unitesDeSens(texteDe(id)).length - apres + (apres <= 1 ? 1 : 0);
      }, 0);
      if (!meilleur || perte < meilleur.perte) meilleur = { ids, perte };
    }
    return meilleur?.ids ?? null;
  };
  while (tailleMax - 2 >= PLANCHER_PX && tropHaut()) c = construire((tailleMax -= 2));
  if (tropHaut()) {
    serre = true;
    padY = PAD_BLOC_SERRE.y;
    ECART_MIN = 6;
    tailleMax = 0.036 * H;
    c = construire(tailleMax);
    while (tailleMax - 2 >= PLANCHER_PX && tropHaut()) c = construire((tailleMax -= 2));
  }
  if (tropHaut() && (avant.length > 1 || apres.length > 1)) {
    paires = true;
    avecIcones = iconesTiennent();
    tailleMax = 0.036 * H;
    c = construire(tailleMax);
    while (tailleMax - 2 >= PLANCHER_PX && tropHaut()) c = construire((tailleMax -= 2));
  }
  // Vue RÉDUITE, quand rien de tout cela ne suffit (schéma dense : 12 blocs aux libellés longs, deux colonnes de 454 px
  // utiles où un libellé de 3 mots prend 2 lignes au plancher) : tout au plancher, les chiffres-clés à la taille des
  // libellés ; puis, rangée par rangée, les libellés sur 2 lignes perdent leur dernière unité de sens (« Envoyé équipe
  // concernée » → « Envoyé équipe ») jusqu'à tenir sur une ligne, la rangée qui perd le moins d'abord ; en tout dernier
  // recours, les chiffres-clés qui ne tiennent plus sont retirés (le dernier d'abord), jamais un bloc ni le plancher.
  if (tropHaut()) {
    reduite = true;
    avecIcones = iconesTiennent();
    tailleMax = PLANCHER_PX;
    c = construire(tailleMax);
    for (let choix = raccourcir(c); tropHaut() && choix; choix = raccourcir(c)) {
      for (const id of choix) unitesMax.set(id, (unitesMax.get(id) ?? MOTS_MAX_ENSEMBLE) - 1);
      avecIcones = iconesTiennent();
      c = construire(tailleMax);
    }
    while (tropHaut() && autres.length) {
      alertes.push(`« ${autres.pop()} » : chiffre-clé retiré de la vue d'ensemble (place) ; il reste montré quand il est dit.`);
      c = construire(tailleMax);
    }
  }
  // Une seule taille de libellé pour tous les blocs (la plus petite trouvée) : la vue se lit d'un bloc.
  c = construire(Math.max(PLANCHER_PX, Math.min(...[...c.mesures.values()].map((m) => m.libelle.taille))));
  // La place qui reste devient l'écart entre rangées (50 px au plus) ; le bloc est centré dans la zone.
  const n = c.rangees.length;
  const ecart = n > 1 ? Math.max(ECART_MIN, Math.min(50, (zone.hauteur - c.total) / (n - 1))) : 0;
  const hauteurBloc = c.total + (n - 1) * ecart;
  if (hauteurBloc > zone.hauteur + 1e-6) alertes.push("Vue d'ensemble trop haute pour la zone utile au plancher de lisibilité : schéma à alléger.");
  let y = centrer(hauteurBloc, zone);

  const xColonne = (k: number) => zone.x + k * (largeurColonne + ECART_COLONNES);
  const blocs: BlocEnsemble[] = [];
  const chiffres: ChiffreEnsemblePlan[] = [];
  const poser = (id: string, x: number, largeur: number, yRangee: number, hRangee: number) => {
    const nd = parId.get(id)!;
    const m = c.mesures.get(id)!;
    if (m.libelle.alerte) alertes.push(m.libelle.alerte);
    blocs.push({ id, x, y: yRangee, largeur, hauteur: hRangee, couleur: nd.couleur, allume: allumes.has(id), icone: m.badge ? nd.icone : undefined, libelle: m.libelle, badge: m.badge });
  };
  for (const r of c.rangees) {
    if (r.sorte === "tronc" && r.ids.length === 1) poser(r.ids[0]!, zone.x + (zone.largeur - largeurDe(r.ids[0]!)) / 2, largeurDe(r.ids[0]!), y, r.hauteur);
    if (r.sorte === "tronc" && r.ids.length === 2) r.ids.forEach((id, k) => poser(id!, zone.x + k * (largeurPaire + ECART_COLONNES), largeurPaire, y, r.hauteur));
    if (r.sorte === "branches") r.ids.forEach((id, k) => id && poser(id, xColonne(k), largeurColonne, y, r.hauteur));
    if (r.sorte === "parts")
      partsBranches.forEach((p, k) => {
        if (!p) return;
        const largeur = Math.min(largeurColonne * 0.62, largeurAnton(p.texte, c.taillePart) + 70);
        chiffres.push({ texte: p.texte, x: xColonne(k) + (largeurColonne - largeur) / 2, y, largeur, hauteur: r.hauteur, taille: c.taillePart / H, couleur: couleurTrait(p.couleur), branche: branches[k].id });
      });
    if (r.sorte === "chiffres") {
      const largeurCase = zone.largeur / autres.length;
      autres.forEach((texte, i) => {
        const taille = Math.min(r.hauteur / 1.15, (largeurCase * 0.9 * c.taillePart) / largeurAnton(texte, c.taillePart));
        if (taille < PLANCHER_PX) return alertes.push(`« ${texte} » : sous le plancher.`);
        chiffres.push({ texte, x: zone.x + i * largeurCase, y, largeur: largeurCase, hauteur: r.hauteur, taille: taille / H, couleur: i === 0 ? COULEURS_DUO.orange : COULEURS_DUO.encre, branche: null });
      });
    }
    y += r.hauteur + ecart;
  }

  // Flèches : du bas d'un bloc au haut du suivant ; un lien porteur de part passe par la pastille de sa branche.
  const blocDe = new Map(blocs.map((b) => [b.id, b]));
  const fleches: FlecheEnsemble[] = [];
  for (const l of schema.liens) {
    const a = blocDe.get(l.de);
    const b = blocDe.get(l.vers);
    if (!a || !b) continue;
    const part = chiffres.find((x) => x.branche !== null && branches.find((g) => g.id === x.branche)!.noeuds.includes(l.vers) && !branches.find((g) => g.id === x.branche)!.noeuds.includes(l.de));
    const bas = (z: ZoneIV) => ({ x: z.x + z.largeur / 2, y: z.y + z.hauteur });
    const haut = (z: ZoneIV) => ({ x: z.x + z.largeur / 2, y: z.y });
    if (a.y === b.y) {
      // Deux blocs côte à côte (tronc serré) : la flèche va du bord de l'un au bord de l'autre.
      const [g, d] = a.x < b.x ? [a, b] : [b, a];
      const milieu = a.y + a.hauteur / 2;
      const bords = [{ x: g.x + g.largeur, y: milieu }, { x: d.x, y: milieu }];
      fleches.push({ id: l.id, de: a === g ? bords[0] : bords[1], vers: a === g ? bords[1] : bords[0], couleur: l.couleur, extremites: [l.de, l.vers] });
    } else if (part) {
      fleches.push({ id: `${l.id}-a`, de: bas(a), vers: haut(part), couleur: l.couleur, extremites: [l.de, l.vers] });
      fleches.push({ id: `${l.id}-b`, de: bas(part), vers: haut(b), couleur: l.couleur, extremites: [l.de, l.vers] });
    } else fleches.push({ id: l.id, de: bas(a), vers: haut(b), couleur: l.couleur, extremites: [l.de, l.vers] });
  }

  for (const ch of chiffres) if (nombreDeMots(ch.texte) > MOTS_MAX_ENSEMBLE) alertes.push(`« ${ch.texte} » : plus de ${MOTS_MAX_ENSEMBLE} mots.`);
  for (const b of blocs) if (unitesDeSens(texteDe(b.id)).length > MOTS_MAX_ENSEMBLE) alertes.push(`Libellé de ${b.id} : plus de ${MOTS_MAX_ENSEMBLE} mots.`);
  return { zone, blocs, fleches, rang, chiffres, alertes: [...new Set(alertes)] };
}

type GroupeEntreeIV = SchemaEntree["groupes"][number];

/** Apparition des blocs en cascade (ordre de lecture) dans les 0,5 premières secondes, puis tout reste posé. */
export function entreePastille(rang: number, nombre: number, ecoule: number): number {
  const pas = Math.min(0.06, 0.4 / Math.max(1, nombre));
  return progres(ecoule, rang * pas, 0.3);
}
