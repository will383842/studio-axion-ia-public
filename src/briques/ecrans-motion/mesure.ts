/**
 * MESURE DU TEXTE DES ÉCRANS À DEUX FONDS (brique `ecrans-motion`) : largeur réelle d'un texte dans les polices que le
 * rendu DESSINE (charte `charte-duo/1` : Anton pour l'affiche, Inter Bold pour le texte), d'après la chasse lue dans
 * les fichiers de police (`metriques-anton.ts`, `metriques-inter-gras.ts`, générés). Le rendu écrit sans crénage ni
 * ligatures : la chasse fait la largeur. L'approche (`letter-spacing`) s'ajoute après CHAQUE caractère, espaces
 * compris, comme en CSS. Le balisage d'accent `*mot*` n'est pas mesuré.
 * PUR, sans alias « @/ » : importable par Remotion.
 */
import { ANTON, CARACTERES as CARACTERES_ANTON } from "./metriques-anton";
import { CARACTERES as CARACTERES_INTER, INTER_GRAS } from "./metriques-inter-gras";

/** Police des écrans : « anton » (affiche, en capitales à l'écran) ou « inter-gras » (texte). */
export type PoliceEcrans = "anton" | "inter-gras";

/** Pas de réduction de `ajuster`, en px (celui de la vidéo de référence). */
export const PAS_AJUSTEMENT_PX = 4;

type Table = { caracteres: string; unitesParEm: number; largeurs: readonly number[]; index: Map<string, number> };

function table(caracteres: string, t: { unitesParEm: number; largeurs: readonly number[] }): Table {
  const index = new Map<string, number>();
  Array.from(caracteres).forEach((c, i) => {
    if (!index.has(c)) index.set(c, i);
  });
  return { caracteres, unitesParEm: t.unitesParEm, largeurs: t.largeurs, index };
}

const TABLES: Record<PoliceEcrans, Table> = {
  anton: table(CARACTERES_ANTON, ANTON),
  "inter-gras": table(CARACTERES_INTER, INTER_GRAS),
};

/** Chasse d'un caractère, en em (lettre accentuée absente : sa lettre de base ; inconnu : « n »). */
function chasse(police: PoliceEcrans, c: string): number {
  const t = TABLES[police];
  const i = t.index.get(c) ?? t.index.get(c.normalize("NFD")[0]) ?? t.index.get("n")!;
  return t.largeurs[i] / t.unitesParEm;
}

/** Le texte sans le balisage d'accent `*mot*`. */
export const sansBalises = (texte: string): string => texte.replace(/\*/g, "");

/** Le texte en capitales, comme l'affiche (`text-transform: uppercase`) le rend. */
export const enCapitales = (texte: string): string => texte.toLocaleUpperCase("fr-FR");

/**
 * Mots d'un texte balisé, avec leur accent : « Le *rendez-vous* » → Le (non), rendez-vous (oui). Comme la v4, un mot qui
 * porte une balise prend l'accent en entier, même au milieu (« L'*annonce* ») ; une fermeture égarée n'ouvre rien.
 */
export function motsBalises(texte: string): { mot: string; accent: boolean }[] {
  const res: { mot: string; accent: boolean }[] = [];
  let dansAccent = false;
  for (const brut of texte.split(/\s+/).filter(Boolean)) {
    const etoiles = brut.split("*").length - 1;
    // Hors accent : deux balises ferment le mot sur lui-même ; une seule ouvre, sauf en dernière position (fermeture égarée).
    const ouvre: boolean = !dansAccent && (etoiles >= 2 || (etoiles === 1 && (brut.length === 1 || !brut.endsWith("*"))));
    const accent: boolean = dansAccent || ouvre;
    const mot = sansBalises(brut);
    if (mot) res.push({ mot, accent });
    dansAccent = dansAccent ? etoiles === 0 : ouvre && etoiles === 1;
  }
  return res;
}

/** Largeur (px) d'un texte sur une ligne (espaces compris) à la taille donnée, approche (em) comprise. */
export function largeurTexte(texte: string, police: PoliceEcrans, taillePx: number, approche = 0): number {
  let em = 0;
  let n = 0;
  for (const c of sansBalises(texte)) {
    em += chasse(police, c);
    n++;
  }
  return (em + n * approche) * taillePx;
}

/**
 * Taille d'un texte écrit sur UNE ligne : la taille voulue, réduite par pas de 4 px tant qu'il dépasse `largeurMax`,
 * jamais sous `plancher`. `tient` = le texte tient à la taille rendue (faux : il déborde même au plancher).
 */
export function ajuster(
  texte: string,
  police: PoliceEcrans,
  tailleVoulue: number,
  largeurMax: number,
  plancher: number,
  approche = 0,
): { taille: number; tient: boolean } {
  let taille = Math.max(plancher, tailleVoulue);
  while (taille > plancher && largeurTexte(texte, police, taille, approche) > largeurMax) taille = Math.max(plancher, taille - PAS_AJUSTEMENT_PX);
  return { taille, tient: largeurTexte(texte, police, taille, approche) <= largeurMax };
}
