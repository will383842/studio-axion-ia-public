/**
 * Variété « Image → vidéo » · axe OBJETS : habillage de la carte e-mail « Nouveau message » et de l'alerte (OBJ-A,
 * référence = rendu d'aujourd'hui ; OBJ-B boîte claire ; OBJ-C notification ; OBJ-D fiche). PUR : couleurs, rayons,
 * ombre, style du tampon et de l'icône. La géométrie (`planEmail`, `planAlerte`) et le texte du tampon ne changent pas.
 */
import type { Fond } from "../../../../../src/briques/ecrans-motion";
import { COULEURS_DUO } from "../../../../../src/briques/habillage/charte-duo";
import type { CodesParAxe } from "../../../../../src/briques/schema-motion/variete";

export type CodeObjet = CodesParAxe["objets"];

export interface HabillageObjet {
  /** Bandeau d'en-tête de la carte e-mail. */
  enTete: {
    fond: string;
    texte: string;
    /** Couleur de l'icône « mail ». */
    icone: string;
    epaisseurIcone: number;
    /** Filet vertical à gauche du bandeau (couleur), sinon `null`. */
    filetGauche: string | null;
    /** Point d'accent avant le titre (couleur), sinon `null`. */
    point: string | null;
    /** Le titre passe en MAJUSCULES espacées (référence) ou en casse normale. */
    majuscules: boolean;
  };
  /** Rayon de la carte e-mail. */
  rayon: number;
  /** Ombre de la carte (la couleur d'encre est teintée par l'appelant : alpha clair / sombre). */
  ombre: { decalageY: number; flou: number; alphaClair: number; alphaSombre: number };
  /** Tampon (« PRÊT ✓ » / « Lu ✓ ») : seule sa forme change, jamais son texte. */
  tampon: {
    fond: string | null;
    texte: string;
    contour: string | null;
    rayon: number;
    /** Rotation en degrés. */
    angle: number;
    /** Padding vertical / horizontal : au plus celui d'aujourd'hui (10 × 22). */
    paddingV: number;
    paddingH: number;
  };
  /** Carte de l'alerte (notification sur l'écran verrouillé). */
  alerte: {
    fond: string;
    bordure: string;
    epaisseurBordure: number;
    /** Filet orange à gauche de la notification, sinon `null`. */
    filetGauche: string | null;
    rayon: number;
    tamponTexte: string;
  };
}

const { blanc, encre, ivoireHaut, orange, orangeVif } = COULEURS_DUO;

const OMBRE_REFERENCE = Object.freeze({ decalageY: 28, flou: 64, alphaClair: 0.14, alphaSombre: 0.5 });

const TAMPON_REFERENCE = Object.freeze({ fond: orangeVif, texte: blanc, contour: null, rayon: 40, angle: 0, paddingV: 10, paddingH: 22 });

const HABILLAGES: { readonly [C in CodeObjet]: HabillageObjet } = Object.freeze({
  "OBJ-A": Object.freeze({
    enTete: { fond: encre, texte: blanc, icone: orangeVif, epaisseurIcone: 2.8, filetGauche: null, point: null, majuscules: true },
    rayon: 40,
    ombre: OMBRE_REFERENCE,
    tampon: TAMPON_REFERENCE,
    alerte: { fond: blanc, bordure: encre, epaisseurBordure: 6, filetGauche: null, rayon: 40, tamponTexte: "#2AABEE" },
  }),
  "OBJ-B": Object.freeze({
    enTete: { fond: ivoireHaut, texte: encre, icone: orange, epaisseurIcone: 2.8, filetGauche: orangeVif, point: null, majuscules: true },
    rayon: 24,
    ombre: { decalageY: 14, flou: 36, alphaClair: 0.1, alphaSombre: 0.4 },
    tampon: { fond: null, texte: encre, contour: orangeVif, rayon: 12, angle: 0, paddingV: 8, paddingH: 18 },
    alerte: { fond: ivoireHaut, bordure: encre, epaisseurBordure: 3, filetGauche: orangeVif, rayon: 24, tamponTexte: encre },
  }),
  "OBJ-C": Object.freeze({
    enTete: { fond: blanc, texte: encre, icone: orangeVif, epaisseurIcone: 2.4, filetGauche: null, point: orangeVif, majuscules: false },
    rayon: 64,
    ombre: { decalageY: 20, flou: 80, alphaClair: 0.18, alphaSombre: 0.55 },
    tampon: { fond: orange, texte: blanc, contour: null, rayon: 40, angle: -8, paddingV: 10, paddingH: 22 },
    alerte: { fond: blanc, bordure: encre, epaisseurBordure: 2, filetGauche: null, rayon: 64, tamponTexte: orange },
  }),
  "OBJ-D": Object.freeze({
    enTete: { fond: orange, texte: blanc, icone: blanc, epaisseurIcone: 3, filetGauche: null, point: null, majuscules: true },
    rayon: 16,
    ombre: { decalageY: 10, flou: 24, alphaClair: 0.2, alphaSombre: 0.6 },
    tampon: { fond: encre, texte: blanc, contour: null, rayon: 8, angle: 0, paddingV: 8, paddingH: 18 },
    alerte: { fond: blanc, bordure: orange, epaisseurBordure: 6, filetGauche: null, rayon: 16, tamponTexte: orange },
  }),
});

/** Habillage d'un code de l'axe objets (code inconnu : référence). `fond` règle l'ombre portée (voir `ombreCss`). */
export function habillageObjet(code: CodeObjet, fond: Fond): HabillageObjet & { sombre: boolean } {
  return { ...(HABILLAGES[code] ?? HABILLAGES["OBJ-A"]), sombre: fond === "sombre" };
}
