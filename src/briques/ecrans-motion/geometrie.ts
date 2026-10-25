/**
 * GÉOMÉTRIE DES ÉCRANS À DEUX FONDS (brique `ecrans-motion`) : deux zones et les boîtes de chaque type d'écran.
 *   - Zone de texte = la zone sûre des réseaux visés ; les textes de l'écran sont posés dans sa partie utile (au-dessus
 *     de la bande des sous-titres). Tout texte porteur de sens y reste, objets qui portent un texte compris.
 *   - Zone de dessin = plus large (`ZONE_DESSIN`) : un objet sans texte porteur de sens peut en déborder.
 * Les proportions viennent de la vidéo de référence (`tests/cas-concret/temoin/reference/v8-a.html`, 1080 × 1920),
 * à la taille de la charte. Quand la place manque, textes et objets réduisent ENSEMBLE, dans le même rapport (au plus
 * jusqu'à 0,6) ; un objet n'est jamais réduit à moins de 85 % du rapport des textes.
 * PUR, sans alias « @/ » : lu par le moteur (contrôle avant rendu) et par les compositions.
 */
import { TAILLE_PLANCHER_DUO, TAILLES_DUO } from "../habillage/charte-duo";
import type { PoliceEcrans } from "./mesure";
import type { BoitePx, TypeEcran } from "./types";

/** Zone protégée d'un ou plusieurs réseaux, en POURCENTAGES de l'image (forme de `src/reseaux`, recopiée). */
export type ZoneProtegeePct = { haut: number; droite: number; bas: number; gauche: number };

/** Bande des sous-titres par défaut, en fraction de la hauteur, au bas de la zone sûre. */
export const BANDE_SOUS_TITRES = 0.14;

/**
 * Zone de dessin : plus large que la zone sûre. Un objet sans texte porteur de sens peut en déborder jusqu'à 4 % des
 * bords sur les côtés et jusqu'à 86 % de la hauteur vers le bas (comme la vidéo de référence) ; recouvert en partie par
 * les boutons d'un réseau, il ne perd aucune information.
 */
export const ZONE_DESSIN = Object.freeze({ cotes: 0.04, bas: 0.86 });

/** Zone utile en px : la zone sûre, moins la bande des sous-titres (`bande`, 14 % de la hauteur par défaut) prise à son bas. */
export function zoneUtile(zoneProtegee: ZoneProtegeePct, largeur: number, hauteur: number, bande: number = BANDE_SOUS_TITRES): BoitePx {
  const x = (largeur * zoneProtegee.gauche) / 100;
  const y = (hauteur * zoneProtegee.haut) / 100;
  const l = largeur * (1 - (zoneProtegee.gauche + zoneProtegee.droite) / 100);
  const h = hauteur * (1 - (zoneProtegee.haut + zoneProtegee.bas) / 100) - hauteur * bande;
  return { x, y, largeur: Math.max(0, l), hauteur: Math.max(0, h) };
}

/** Les zones d'un écran, en px. */
export type ZonesEcran = {
  /** Zone de texte : la zone sûre commune aux réseaux visés. Tout texte porteur de sens y reste. */
  texte: BoitePx;
  /** Zone utile : la zone de texte moins la bande des sous-titres. Les textes de l'écran y sont posés. */
  utile: BoitePx;
  /** Bande des sous-titres, au bas de la zone de texte. */
  sousTitres: BoitePx;
  /** Zone de dessin : où un objet sans texte porteur de sens peut aller (`ZONE_DESSIN`). */
  dessin: BoitePx;
};

/** Zones de texte, utile, des sous-titres et de dessin d'une image, pour une zone protégée et une bande données. */
export function zonesEcran(zoneProtegee: ZoneProtegeePct, largeur: number, hauteur: number, bande: number = BANDE_SOUS_TITRES): ZonesEcran {
  const texte = zoneUtile(zoneProtegee, largeur, hauteur, 0);
  const utile = zoneUtile(zoneProtegee, largeur, hauteur, bande);
  const sousTitres = { x: texte.x, y: utile.y + utile.hauteur, largeur: texte.largeur, hauteur: Math.max(0, texte.hauteur - utile.hauteur) };
  return { texte, utile, sousTitres, dessin: zoneDessin(texte, largeur, hauteur) };
}

/** Zone de dessin d'une image : la zone de texte élargie aux limites de `ZONE_DESSIN` (jamais plus étroite qu'elle). */
export function zoneDessin(texte: BoitePx, largeur: number, hauteur: number): BoitePx {
  const x = Math.min(texte.x, largeur * ZONE_DESSIN.cotes);
  const droite = Math.max(texte.x + texte.largeur, largeur * (1 - ZONE_DESSIN.cotes));
  const bas = Math.max(texte.y + texte.hauteur, hauteur * ZONE_DESSIN.bas);
  return { x, y: texte.y, largeur: droite - x, hauteur: bas - texte.y };
}

export type NiveauDuo = keyof typeof TAILLES_DUO;

/** Ce que la géométrie lit de la charte : la hauteur de l'image, les tailles par niveau et le plancher (fractions). */
export type ChartePlacement = {
  hauteurImage: number;
  tailles: Readonly<Record<NiveauDuo, number>>;
  plancher: number;
};

/** Charte `charte-duo/1` pour une image de hauteur donnée. */
export const charteDuoPour = (hauteurImage: number): ChartePlacement => ({ hauteurImage, tailles: TAILLES_DUO, plancher: TAILLE_PLANCHER_DUO });

/** Boîte d'un texte : où il s'écrit, dans quelle police, à quelle taille (avant ajustement à la largeur). */
export type BoiteTexteEcran = {
  nom: string;
  police: PoliceEcrans;
  niveau: NiveauDuo;
  /** Taille de départ (px) : celle de la charte, ramenée à la boîte. */
  taille: number;
  /** Taille sous laquelle le texte n'a pas le droit de descendre (px). */
  plancher: number;
  /** Le plancher de la charte s'applique (texte d'affiche porteur de sens). */
  soumisAuPlancher: boolean;
  lignesMax: number;
  interligne: number;
  /** Approche (`letter-spacing`), en em. */
  approche: number;
  /** Écrit en capitales (affiche). */
  capitales: boolean;
  boite: BoitePx;
};

export type BoiteObjetEcran = {
  nom: string;
  boite: BoitePx;
  /** L'objet porte un texte utile (liste, barres, champ, bulle, nombre) : il reste dans la zone utile. Sinon, il peut
   * aller jusqu'au bord de la zone de dessin. */
  porteTexte: boolean;
};

export type BoitesEcran = {
  marque: BoiteTexteEcran;
  textes: BoiteTexteEcran[];
  objets: BoiteObjetEcran[];
  /** Fil d'avancement des étapes (type `etape`). */
  fil?: BoitePx;
  /** Rapports de réduction appliqués (1 = taille de la charte et de la référence). */
  reduction: { textes: number; objets: number };
};

/** Options de gabarit qui dépendent du contenu (nombre de lignes géantes, de puces, de tâches, de pastilles, variante). */
export type OptionsBoites = {
  lignes?: number;
  puces?: number;
  taches?: number;
  pastilles?: number;
  compteur?: boolean;
  /** Promesse : le cadeau trop long est coupé, sa suite s'écrit en ligne sous l'affiche (boîte `cadeau-suite`). */
  suiteCadeau?: boolean;
  /** Le contenu est centré verticalement dans la place qu'il a (sous la marque, au-dessus de la bande), au lieu de partir
   * du premier écart du gabarit (accroche de la référence `s1`). */
  centrer?: boolean;
  /** Question : hauteur de référence (px) à laquelle se mesure la taille du texte « question » (niveau « ligne »), au lieu de
   * la hauteur de l'image. Posée seulement par Image → vidéo en 4:5 (1920 : la question garde sa taille du 9:16) ; absente :
   * comportement inchangé (cas concret, 9:16). */
  hauteurLigneRef?: number;
};

/** Cadre de l'écran au-delà de la zone utile : la zone de dessin (absente : les objets restent dans la zone utile). */
export type CadreBoites = {
  dessin?: BoitePx;
  /** Bas du fil des étapes, en px (absent : le bas de la zone de dessin). Plus bas que la zone de dessin, il ne donne
   * aucune place de plus aux objets : ils restent dans la zone de dessin. */
  basFil?: number;
};

/* ------------------------------------------------------------------ */
/* Gabarits, en px de la référence (contenu de 1000 × 1410 px)          */
/* ------------------------------------------------------------------ */

/** Rapport de réduction le plus bas des textes (0,6 de la taille de la charte pour l'affiche). */
export const REDUCTION_MIN = 0.6;
/** Un objet n'est jamais réduit à moins de 85 % du rapport appliqué aux textes. */
export const REDUCTION_OBJET_MIN = 0.85;
/** Pas de recherche des rapports de réduction. */
const PAS_REDUCTION = 0.01;
/** Le texte (Inter) écrit dans un objet peut descendre jusqu'à 60 % de sa taille (42 → 26 px dans la bulle de la référence). */
const PLANCHER_TEXTE_INTERIEUR = 0.6;
/** Le texte (Inter) hors objet ne descend pas sous 75 % de sa taille : il passe d'abord à la ligne. */
const PLANCHER_TEXTE = 0.75;
/** Hauteur d'image de la référence (les tailles de la charte y sont exactes). */
const IMAGE_REFERENCE = 1920;

type Texte = {
  sorte: "texte";
  nom: string;
  police: PoliceEcrans;
  niveau: NiveauDuo;
  lignesMax?: number;
  interligne?: number;
  approche?: number;
  capitales?: boolean;
  /** Écart avant l'élément, px de la référence. */
  ecart: number;
};
type Interieur = {
  nom: string;
  police: PoliceEcrans;
  niveau: NiveauDuo;
  capitales?: boolean;
  approche?: number;
  lignesMax?: number;
  interligne?: number;
  /** Retraits dans l'objet, en fraction de sa largeur (pastille ronde à gauche, bouton à droite). */
  retraits?: { gauche: number; droite: number };
  /** Le texte remplit toute la hauteur de sa rangée (nombre géant), sans la marge de 10 %. */
  plein?: boolean;
};
type Objet = {
  sorte: "objet";
  nom: string;
  largeurRef: number;
  hauteurRef: number;
  ecart: number;
  /** Rangées de texte posées dans l'objet, de haut en bas, sur toute sa hauteur. */
  rangees?: Interieur[];
  /** Largeur indépendante de la hauteur (bulle, champ, barre) : la part de la largeur utile de la référence (1000 px). */
  largeurLibre?: boolean;
  /** Pastilles posées sur le bas de l'objet (puces, total). */
  dessus?: Interieur[];
};
type Element = Texte | Objet;

const AFFICHE = (nom: string, niveau: NiveauDuo, ecart: number, autre: Partial<Texte> = {}): Texte => ({ sorte: "texte", nom, police: "anton", niveau, capitales: true, interligne: 1.04, ecart, ...autre });
const ETIQUETTE = (ecart = 0): Texte => ({ sorte: "texte", nom: "etiquette", police: "inter-gras", niveau: "etiquette", capitales: true, approche: 0.32, interligne: 1.3, ecart });
const LIGNE = (nom: string, ecart: number, lignesMax = 2): Texte => ({ sorte: "texte", nom, police: "inter-gras", niveau: "ligne", lignesMax, interligne: 1.25, ecart });
const PUCES = (n: number): Interieur[] => Array.from({ length: n }, (_, i) => ({ nom: `puce-${i + 1}`, police: "inter-gras" as const, niveau: "ligne" as const, interligne: 1.9 }));
const borne = (n: number | undefined, min: number, max: number, defaut: number) => Math.max(min, Math.min(max, Math.round(n ?? defaut)));

function gabarit(type: TypeEcran, o: OptionsBoites): Element[] {
  switch (type) {
    case "accroche": {
      const n = borne(o.lignes, 1, 3, 3);
      return [ETIQUETTE(), ...Array.from({ length: n }, (_, i) => AFFICHE(`titre-${i + 1}`, "affiche", i ? 0 : 30))];
    }
    case "chiffre":
      return [
        o.compteur
          ? { sorte: "objet", nom: "anneau", largeurRef: 740, hauteurRef: 740, ecart: 140, rangees: [{ nom: "nombre", police: "anton", niveau: "geant" }] }
          : // Sans anneau (référence `s2`) : la boîte serre le nombre (les chiffres d'Anton font près de 0,9 de leur taille).
            { sorte: "objet", nom: "anneau", largeurRef: 1000, hauteurRef: 660, ecart: 140, largeurLibre: true, rangees: [{ nom: "nombre", police: "anton", niveau: "geant", interligne: 0.92, plein: true }] },
        AFFICHE("unite", "affiche", o.compteur ? 20 : 0),
        ...(borne(o.pastilles, 0, 3, 3) ? [{ sorte: "texte", nom: "pastilles", police: "inter-gras", niveau: "marque", ecart: 40, interligne: 2 } as Texte] : []),
      ];
    case "liste-avant":
      return [
        ETIQUETTE(60),
        AFFICHE("titre", "titre", 0),
        {
          sorte: "objet",
          nom: "liste",
          largeurRef: 860,
          hauteurRef: 720,
          ecart: 80,
          rangees: Array.from({ length: borne(o.taches, 2, 6, 4) }, (_, i) => ({ nom: `tache-${i + 1}`, police: "inter-gras" as const, niveau: "ligne" as const, interligne: 1.5 })),
          dessus: [{ nom: "total", police: "anton", niveau: "titre", capitales: true }],
        },
      ];
    case "titre": {
      const n = borne(o.lignes, 1, 2, 2);
      return Array.from({ length: n }, (_, i) => AFFICHE(`titre-${i + 1}`, "affiche", i ? 20 : 450));
    }
    case "etape":
      return [
        ETIQUETTE(60),
        AFFICHE("titre", "titre", 0),
        LIGNE("ligne", 40),
        { sorte: "objet", nom: "visuel", largeurRef: 470, hauteurRef: 920, ecart: 40, dessus: PUCES(borne(o.puces, 0, 2, 2)) },
      ];
    case "objet":
      return [AFFICHE("titre", "titre", 100), LIGNE("ligne", 30), { sorte: "objet", nom: "visuel", largeurRef: 600, hauteurRef: 760, ecart: 60 }];
    case "preuve":
      return [
        ETIQUETTE(60),
        AFFICHE("titre", "affiche", 0),
        { sorte: "objet", nom: "bouclier", largeurRef: 400, hauteurRef: 400, ecart: 90 },
        ...PUCES(2).map((p, i): Texte => ({ sorte: "texte", ...p, ecart: i ? 30 : 100 })),
      ];
    case "resultat":
      return [
        ETIQUETTE(60),
        AFFICHE("titre", "titre", 0),
        { sorte: "texte", nom: "etiquette-avant", police: "inter-gras", niveau: "etiquette", capitales: true, approche: 0.32, interligne: 1.3, ecart: 120 },
        { sorte: "objet", nom: "barre-avant", largeurRef: 900, hauteurRef: 190, ecart: 14, largeurLibre: true, rangees: [{ nom: "avant", police: "anton", niveau: "affiche", capitales: true }] },
        { sorte: "texte", nom: "etiquette-maintenant", police: "inter-gras", niveau: "etiquette", capitales: true, approche: 0.32, interligne: 1.3, ecart: 80 },
        { sorte: "objet", nom: "barre-maintenant", largeurRef: 900, hauteurRef: 190, ecart: 14, largeurLibre: true, rangees: [{ nom: "maintenant", police: "anton", niveau: "affiche", capitales: true }] },
        LIGNE("ligne", 80),
      ];
    case "question": {
      const n = borne(o.lignes, 1, 2, 2);
      return [...Array.from({ length: n }, (_, i) => AFFICHE(`titre-${i + 1}`, "affiche", i ? 20 : 370)), LIGNE("question", 60)];
    }
    case "appel-mot":
      return [
        ETIQUETTE(140),
        AFFICHE("invite", "affiche", 0),
        // Toute la largeur de la zone (la référence : 800 px sur 1 080, la zone commune : 821 sur 1 080) : un mot de dix
        // lettres (« DIAGNOSTIC ») tient entre la pastille et le bouton d'envoi.
        { sorte: "objet", nom: "champ", largeurRef: 1000, hauteurRef: 260, ecart: 110, largeurLibre: true, rangees: [{ nom: "mot", police: "anton", niveau: "affiche", capitales: true, approche: 0.055, retraits: { gauche: 270 / 800, droite: 230 / 800 } }] },
        AFFICHE("suite", "titre", 80),
      ];
    case "promesse":
      // Cadeau coupé (référence `s20` : « TOUTE LA STRUCTURE » en grand, puis « de cette automatisation, à mettre en
      // place chez vous » en ligne) : sa suite se pose juste sous l'affiche, la ligne la suit de près.
      return o.suiteCadeau
        ? [AFFICHE("invite", "titre", 330), AFFICHE("cadeau", "affiche", 30), LIGNE("cadeau-suite", 30, 1), LIGNE("ligne", 6)]
        : [AFFICHE("invite", "titre", 330), AFFICHE("cadeau", "affiche", 30), LIGNE("ligne", 30)];
    case "lien":
      return [
        ETIQUETTE(140),
        AFFICHE("titre", "titre", 0, { lignesMax: 2 }),
        { sorte: "objet", nom: "bulle", largeurRef: 860, hauteurRef: 210, ecart: 100, largeurLibre: true, rangees: [{ nom: "lien", police: "inter-gras", niveau: "ligne", retraits: { gauche: 210 / 860, droite: 40 / 860 } }] },
        AFFICHE("signature", "titre", 110, { capitales: false }),
      ];
  }
}

/* ------------------------------------------------------------------ */
/* Placement                                                           */
/* ------------------------------------------------------------------ */

const arrondi = (b: BoitePx): BoitePx => ({ x: Math.round(b.x * 100) / 100, y: Math.round(b.y * 100) / 100, largeur: Math.round(b.largeur * 100) / 100, hauteur: Math.round(b.hauteur * 100) / 100 });

/**
 * Boîtes d'un type d'écran : marque en haut de la zone utile `zone`, puis les éléments du gabarit de haut en bas, à la
 * taille de la charte et de la référence. Le premier écart centre le contenu dans la place qu'il a.
 *   - Textes et objets qui portent un texte : dans la zone utile.
 *   - Objet sans texte utile : jusqu'au bas de la zone de dessin `cadre.dessin` (et, sur les côtés, jusqu'à ses bords,
 *     centré sur la zone utile) ; ses pastilles (puces, total) restent dans la zone utile.
 *   - Fil des étapes : au bas de la zone de dessin (sous les sous-titres, comme la référence).
 * Si la place manque, textes et objets réduisent ensemble : le plus grand rapport commun (de 1 à `REDUCTION_MIN`, par
 * pas de 0,01) qui fait tout tenir ; s'il n'y en a pas, au rapport le plus bas, les objets descendent encore, jusqu'à
 * `REDUCTION_OBJET_MIN` fois celui des textes (et le contrôle dira ce qui dépasse). Les textes
 * en Inter ne descendent pas sous 75 % de leur taille ; la marque et les étiquettes gardent la leur.
 */
export function boites(type: TypeEcran, zone: BoitePx, charte: ChartePlacement, options: OptionsBoites = {}, cadre: CadreBoites = {}): BoitesEcran {
  const H = charte.hauteurImage;
  const echelleImage = H / IMAGE_REFERENCE;
  const plancherAffiche = charte.plancher * H;
  const nominal = (niveau: NiveauDuo) => charte.tailles[niveau] * H;

  const tailleMarque = nominal("marque");
  const hMarque = tailleMarque * 1.3;
  const marque: BoiteTexteEcran = {
    nom: "marque",
    police: "inter-gras",
    niveau: "marque",
    taille: tailleMarque,
    plancher: tailleMarque,
    soumisAuPlancher: false,
    lignesMax: 1,
    interligne: 1.3,
    approche: 0.083,
    capitales: false,
    boite: arrondi({ x: zone.x, y: zone.y, largeur: zone.largeur, hauteur: hMarque }),
  };

  const elements = gabarit(type, options);
  const centreX = zone.x + zone.largeur / 2;
  const U = zone.y + zone.hauteur;
  const dessin = cadre.dessin;
  const D = dessin ? Math.max(U, dessin.y + dessin.hauteur) : U;
  // Largeur permise à un objet sans texte : symétrique autour du centre de la zone utile, dans la zone de dessin.
  const largeurLibreMax = dessin ? Math.max(zone.largeur, 2 * Math.min(centreX - dessin.x, dessin.x + dessin.largeur - centreX)) : zone.largeur;
  const etape = type === "etape";
  const hFil = etape ? Math.max(4, 6 * echelleImage) : 0;
  const ecartFil = etape ? 20 * echelleImage : 0;
  const yFil = (cadre.basFil !== undefined ? Math.max(D, cadre.basFil) : D) - hFil;
  /** Bas permis aux objets sans texte, et aux textes (et objets qui en portent). */
  const basObjet = etape ? Math.min(D, yFil - ecartFil) : D;
  const basTexte = Math.min(U, basObjet);
  const porte = (o: Objet) => (o.rangees?.length ?? 0) > 0;

  /** Taille d'un texte au rapport `r` : l'affiche suit `r`, l'Inter ne descend pas sous 75 %, marque et étiquette fixes. */
  const tailleTexte = (police: PoliceEcrans, niveau: NiveauDuo, r: number, nom?: string) => {
    if (niveau === "marque" || niveau === "etiquette") return nominal(niveau);
    if (police === "anton") return Math.max(Math.min(plancherAffiche, nominal(niveau)), nominal(niveau) * r);
    // Question d'Image → vidéo en 4:5 : lettres à la taille du 9:16 (référence 1920), pas à celle de la hauteur du cadre.
    const base = nom === "question" && options.hauteurLigneRef ? charte.tailles[niveau] * options.hauteurLigneRef : nominal(niveau);
    return base * Math.max(r, PLANCHER_TEXTE);
  };
  // Hauteur minimale d'un objet : celle qui garde l'affiche écrite dedans au plancher (barres, champ, anneau).
  const minimum = (o: Objet) => {
    const rangees = o.rangees ?? [];
    if (rangees.some((r) => r.police === "anton")) return (rangees.length * plancherAffiche * 1.2) / 0.9;
    return rangees.reduce((s, r) => s + nominal(r.niveau) * 1.5, 0);
  };
  /** Boîte d'un objet au rapport `ro` : hauteur de la référence, largeur bornée (l'objet aux proportions fixes est serré). */
  const tailleObjet = (o: Objet, ro: number) => {
    let h = Math.max(minimum(o), o.hauteurRef * echelleImage * ro);
    const max = porte(o) ? zone.largeur : largeurLibreMax;
    if (o.largeurLibre) return { h, l: zone.largeur * Math.min(1, o.largeurRef / 1000) };
    const l = Math.min(max, (h * o.largeurRef) / o.hauteurRef);
    h = Math.max(minimum(o), Math.min(h, (l * o.hauteurRef) / o.largeurRef));
    return { h, l };
  };

  type Place = { e: Element; y: number; h: number; l: number; taille: number };
  /** Pose les éléments aux rapports donnés, avec le premier écart `premier` ; dit si tout tient. */
  const poser = (r: number, ro: number, premier: number) => {
    let y = zone.y + hMarque;
    let tient = true;
    const places: Place[] = [];
    elements.forEach((e, i) => {
      y += i === 0 ? premier : e.ecart * echelleImage * r;
      if (e.sorte === "texte") {
        const taille = tailleTexte(e.police, e.niveau, r, e.nom);
        const h = taille * (e.interligne ?? 1.2) * (e.lignesMax ?? 1);
        places.push({ e, y, h, l: zone.largeur, taille });
        y += h;
        if (y > basTexte + 0.01) tient = false;
      } else {
        const { h, l } = tailleObjet(e, ro);
        places.push({ e, y, h, l, taille: 0 });
        if (y + h > (porte(e) ? basTexte : basObjet) + 0.01) tient = false;
        // Les pastilles posées sur l'objet restent dans la zone utile.
        if ((e.dessus?.length ?? 0) > 0 && Math.min(y + h, basTexte) - y < e.dessus!.reduce((s, d) => s + tailleTexte(d.police, d.niveau, r) * (d.interligne ?? 1.2), 0) - 0.01) tient = false;
        y += h;
      }
    });
    return { places, tient, fin: y };
  };
  /** Premier écart : celui du gabarit, réduit pour centrer le contenu dans la place qu'il a (`centrer` : tout l'écart qui le centre). */
  const dernier = elements[elements.length - 1];
  const basContenu = dernier && dernier.sorte === "objet" && !porte(dernier) ? basObjet : basTexte;
  const premierEcart = (r: number, ro: number) => {
    const sans = poser(r, ro, 0);
    const centre = (basContenu - sans.fin) / 2;
    return Math.max(0, options.centrer ? centre : Math.min((elements[0]?.ecart ?? 0) * echelleImage * r, centre));
  };

  // Même rapport pour tous d'abord ; au rapport le plus bas, les objets peuvent encore descendre à 85 % de celui des textes.
  let choix = { r: REDUCTION_MIN, ro: REDUCTION_MIN * REDUCTION_OBJET_MIN };
  for (let r = 1; r >= REDUCTION_MIN - 1e-9; r = Math.round((r - PAS_REDUCTION) * 100) / 100) {
    if (poser(r, r, 0).tient) {
      choix = { r, ro: r };
      break;
    }
  }
  if (choix.r === REDUCTION_MIN && !poser(REDUCTION_MIN, REDUCTION_MIN, 0).tient) {
    for (let ro = Math.round((REDUCTION_MIN - PAS_REDUCTION) * 100) / 100; ro > REDUCTION_MIN * REDUCTION_OBJET_MIN; ro = Math.round((ro - PAS_REDUCTION) * 100) / 100) {
      if (poser(REDUCTION_MIN, ro, 0).tient) {
        choix = { r: REDUCTION_MIN, ro };
        break;
      }
    }
  }
  const { r, ro } = choix;
  const { places } = poser(r, ro, premierEcart(r, ro));

  const interieur = (i: Interieur, boite: BoitePx, tailleMax: number): BoiteTexteEcran => {
    const nom0 = tailleTexte(i.police, i.niveau, r);
    const lignes = i.lignesMax ?? 1;
    const inter = i.interligne ?? 1.2;
    const taille = Math.min(nom0, tailleMax / (inter * lignes));
    const soumis = i.police === "anton";
    return {
      nom: i.nom,
      police: i.police,
      niveau: i.niveau,
      taille,
      plancher: soumis ? plancherAffiche : Math.min(taille, nominal(i.niveau) * PLANCHER_TEXTE_INTERIEUR),
      soumisAuPlancher: soumis,
      lignesMax: lignes,
      interligne: inter,
      approche: i.approche ?? 0,
      capitales: i.capitales ?? false,
      boite: arrondi(boite),
    };
  };

  const textes: BoiteTexteEcran[] = [];
  const objetsPlaces: BoiteObjetEcran[] = [];
  for (const { e, y, h, l, taille } of places) {
    if (e.sorte === "texte") {
      const soumis = e.police === "anton" && e.niveau !== "etiquette" && e.niveau !== "marque";
      textes.push({
        nom: e.nom,
        police: e.police,
        niveau: e.niveau,
        taille,
        plancher: soumis ? plancherAffiche : Math.min(taille, (e.nom === "question" && options.hauteurLigneRef ? charte.tailles[e.niveau] * options.hauteurLigneRef : nominal(e.niveau)) * PLANCHER_TEXTE),
        soumisAuPlancher: soumis,
        lignesMax: e.lignesMax ?? 1,
        interligne: e.interligne ?? 1.2,
        approche: e.approche ?? 0,
        capitales: e.capitales ?? false,
        boite: arrondi({ x: zone.x, y, largeur: zone.largeur, hauteur: h }),
      });
      continue;
    }
    const boite: BoitePx = { x: centreX - l / 2, y, largeur: l, hauteur: h };
    objetsPlaces.push({ nom: e.nom, boite: arrondi(boite), porteTexte: porte(e) });
    const rangees = e.rangees ?? [];
    rangees.forEach((rg, i) => {
      const hr = h / rangees.length;
      const g = (rg.retraits?.gauche ?? 0) * l;
      const d = (rg.retraits?.droite ?? 0) * l;
      textes.push(interieur(rg, { x: boite.x + g, y: y + i * hr, largeur: l - g - d, hauteur: hr }, hr * (rg.plein ? 1 : 0.9)));
    });
    const dessus = e.dessus ?? [];
    const basDessus = Math.min(y + h, basTexte);
    dessus.forEach((ds, i) => {
      const hd = Math.min(tailleTexte(ds.police, ds.niveau, r) * (ds.interligne ?? 1.2), (basDessus - y) / Math.max(1, dessus.length));
      const yd = basDessus - (dessus.length - i) * hd;
      textes.push(interieur(ds, { x: zone.x, y: yd, largeur: zone.largeur, hauteur: hd }, hd));
    });
  }

  const fil = etape ? arrondi({ x: zone.x, y: yFil, largeur: zone.largeur, hauteur: hFil }) : undefined;
  return { marque, textes, objets: objetsPlaces, ...(fil ? { fil } : {}), reduction: { textes: r, objets: ro } };
}

/** Une boîte est dans une autre (tolérance d'un centième de px, l'arrondi des boîtes). */
export const boiteDans = (b: BoitePx, z: BoitePx): boolean =>
  b.x >= z.x - 0.01 && b.y >= z.y - 0.01 && b.x + b.largeur <= z.x + z.largeur + 0.01 && b.y + b.hauteur <= z.y + z.hauteur + 0.01;
