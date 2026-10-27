/**
 * VARIÉTÉ du format « Image → vidéo » : contrat partagé par le moteur (tirage, axes) et les compositions (calques,
 * écrans). PUR, sans alias « @/ » ni dépendance : copié dans l'image Docker du rendu avec `schema-motion`.
 * Codes et verdicts : `docs/formats/image-video/variete/planche/verdict-critique.json` ; plan : `80-PLAN-INTEGRATION.md`.
 */

/** Les 14 axes de variété (ordre d'affichage). */
export const AXES_VARIETE = ["ouverture", "recit", "chiffres", "camera", "texte", "apparition", "transitions", "fin", "matiere", "sousTitres", "fond", "rail", "objets", "entete"] as const;
export type AxeVariete = (typeof AXES_VARIETE)[number];

/** Les codes de chaque axe (gardés, référence et retirés). */
export type CodesParAxe = {
  ouverture: "OUV-A" | "OUV-B" | "OUV-C" | "OUV-D" | "OUV-E";
  recit: "REC-A" | "REC-B" | "REC-C" | "REC-D";
  chiffres: "CHI-A" | "CHI-B" | "CHI-C" | "CHI-D" | "CHI-E";
  camera: "CAM-A" | "CAM-B" | "CAM-C" | "CAM-D" | "CAM-E";
  texte: "TYP-A" | "TYP-B" | "TYP-C" | "TYP-D";
  apparition: "APP-A" | "APP-B" | "APP-C" | "APP-D";
  transitions: "TRA-A" | "TRA-B" | "TRA-C" | "TRA-D" | "TRA-E";
  fin: "FIN-A" | "FIN-B" | "FIN-C" | "FIN-D";
  matiere: "MAT-A" | "MAT-B" | "MAT-C" | "MAT-D";
  sousTitres: "SOU-A" | "SOU-B" | "SOU-C" | "SOU-D" | "SOU-E";
  fond: "FON-A" | "FON-B" | "FON-C" | "FON-D" | "FON-E";
  rail: "RAI-A" | "RAI-B" | "RAI-C" | "RAI-D";
  objets: "OBJ-A" | "OBJ-B" | "OBJ-C" | "OBJ-D";
  entete: "ENT-A" | "ENT-B" | "ENT-C" | "ENT-D";
};
export type CodeVariante<A extends AxeVariete = AxeVariete> = CodesParAxe[A];

/** Une recette : un code par axe. */
export type RecetteVarieteIV = { [A in AxeVariete]: CodesParAxe[A] };

/** Formats d'image de sortie. */
export type FormatIV = "9:16" | "4:5";

/** Cadres en pixels : hauteur utile et bande des sous-titres (doc 76, mesure d'occupation). */
export const CADRES_IV = Object.freeze({
  "9:16": Object.freeze({ largeur: 1080, hauteur: 1920, utile: Object.freeze({ haut: 230, bas: 1536 }), sousTitres: Object.freeze({ haut: 1152, bas: 1286 }) }),
  "4:5": Object.freeze({ largeur: 1080, hauteur: 1350, utile: Object.freeze({ haut: 54, bas: 1215 }), sousTitres: Object.freeze({ haut: 1042, bas: 1176 }) }),
});

/** Variantes gardées (tirables) par axe. */
export const VARIANTES_GARDEES: { readonly [A in AxeVariete]: readonly CodesParAxe[A][] } = Object.freeze({
  ouverture: ["OUV-A", "OUV-B", "OUV-C", "OUV-D", "OUV-E"],
  recit: ["REC-B", "REC-C", "REC-D"],
  chiffres: ["CHI-B", "CHI-C", "CHI-D", "CHI-E"],
  camera: ["CAM-B", "CAM-C", "CAM-E"],
  texte: ["TYP-B", "TYP-C", "TYP-D"],
  apparition: ["APP-B", "APP-C", "APP-D"],
  transitions: ["TRA-B", "TRA-C", "TRA-D"],
  fin: ["FIN-C", "FIN-D"],
  matiere: ["MAT-B", "MAT-C", "MAT-D"],
  sousTitres: ["SOU-C"],
  // fond
  fond: [],
  // rail
  rail: [],
  // objets
  objets: [],
  // entete
  entete: [],
});

/** Référence de chaque axe (le rendu d'aujourd'hui) : sans recette, ou repli. L'ouverture n'en a pas (l'écran actuel ≈ OUV-D). */
export const REFERENCES: { readonly [A in AxeVariete]: CodesParAxe[A] | null } = Object.freeze({
  ouverture: null,
  recit: "REC-A",
  chiffres: "CHI-A",
  camera: "CAM-A",
  texte: "TYP-A",
  apparition: "APP-A",
  transitions: "TRA-A",
  fin: "FIN-A",
  matiere: "MAT-A",
  sousTitres: "SOU-B",
  // fond
  fond: "FON-A",
  // rail
  rail: "RAI-A",
  // objets
  objets: "OBJ-A",
  // entete
  entete: "ENT-A",
});

/** Axes dont la référence est AUSSI tirable (trop peu de variantes gardées, sinon toutes les vidéos se ressembleraient). */
export const REFERENCES_TIRABLES: readonly AxeVariete[] = Object.freeze(["fin", "sousTitres", "fond", "rail", "objets", "entete"]);

/** Variantes retirées : jamais tirées. */
export const RETIREES: { readonly [A in AxeVariete]: readonly CodesParAxe[A][] } = Object.freeze({
  ouverture: [],
  recit: [],
  chiffres: [],
  camera: ["CAM-D"],
  texte: [],
  apparition: [],
  transitions: ["TRA-E"],
  fin: ["FIN-B"],
  matiere: [],
  sousTitres: ["SOU-A"],
  // fond
  fond: [],
  // rail
  rail: [],
  // objets
  objets: [],
  // entete
  entete: [],
});

/** Axes qui peuvent poser un écran propre (bloc `sorte: "variete"`, composition `ImageVideoVariete`). */
export type AxeEcranVariete = Extract<AxeVariete, "ouverture" | "texte" | "chiffres" | "camera" | "fin">;

/** Données d'un bloc `variete` : l'axe qui l'a posé, son code et ce que son écran dessine. */
export type BlocVarieteDonnees = { [A in AxeEcranVariete]: { axe: A; code: CodesParAxe[A]; donnees: unknown } }[AxeEcranVariete];

/** Ce que porte chaque bloc d'une ligne de temps AVEC recette (et que reçoit sa composition). */
export interface VarieteBlocIV {
  recette: RecetteVarieteIV;
  format: FormatIV;
  /** Données propres à un axe pour ce bloc (posées par l'axe, lues par son calque). */
  donnees?: Partial<Record<AxeVariete, unknown>>;
}

/** Propriétés d'une composition qui peut recevoir la variété (absente = rendu de référence). */
export type AvecVarieteIV = { variete?: VarieteBlocIV };

/** Codes tirables d'un axe : ses variantes gardées, plus sa référence si elle est aussi tirable. */
export function tirablesDe<A extends AxeVariete>(axe: A): CodesParAxe[A][] {
  const ref = REFERENCES[axe];
  return [...(ref && REFERENCES_TIRABLES.includes(axe) ? [ref] : []), ...VARIANTES_GARDEES[axe]];
}

/** Code d'un axe dans une recette, qui peut être ancienne (sans les axes ajoutés depuis) : à défaut, la référence de l'axe. */
export function codeDe<A extends AxeVariete>(r: Partial<RecetteVarieteIV> | undefined, axe: A): CodesParAxe[A] {
  return (r?.[axe] ?? REFERENCES[axe]) as CodesParAxe[A];
}
