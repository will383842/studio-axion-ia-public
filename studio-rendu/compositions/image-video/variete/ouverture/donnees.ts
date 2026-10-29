/**
 * Données de l'écran d'ouverture (lot OUV-FIN), telles que les pose le moteur (`variete/axes/ouverture.ts`, type
 * `DonneesOuvertureIV`, recopié ici : une composition n'importe jamais `src/moteurs/**`). Un test vérifie que les
 * données du moteur s'y assignent.
 */
import { largeurAnton } from "../../../../../src/briques/schema-motion/chasse-anton";
import { couperEquilibre } from "../../../../../src/briques/schema-motion/plan-objets";
export type CouleurNoeudOuverture = "orange" | "noir" | "vert" | "neutre";
export type ChiffreOuverture = { texte: string; nombre: string; unite: string; cle: string };
export type CoteOuverture = { chiffre: ChiffreOuverture; libelle: string | null; icone: string | null };
export type NoeudSchemaOuverture = { icone: string | null; couleur: CouleurNoeudOuverture; detail?: true };

export type DonneesOuverture = { situation: boolean; duree: number; bascule: number } & (
  | {
      code: "OUV-A";
      resultat: { chiffre: ChiffreOuverture; libelle: string | null; part: number | null };
      depart: { chiffre: ChiffreOuverture | null; libelle: string; icone: string | null };
      suite: (string | null)[];
    }
  | { code: "OUV-B"; avant: CoteOuverture; apres: CoteOuverture }
  | { code: "OUV-C"; heure: { h: number; m: number; texte: string } | null; objet: { libelle: string; icone: string; chiffre: ChiffreOuverture | null }; moteur: string | null }
  | { code: "OUV-D"; mots: { texte: string; t: number; orange: boolean }[]; nuit: boolean; icone: string | null }
  | {
      code: "OUV-E";
      detail: { libelle: string; detail: string | null; icone: string | null };
      suivant: string | null;
      schema: { haut: NoeudSchemaOuverture[]; colonnes: NoeudSchemaOuverture[][] };
    }
);

/**
 * OUV-E · gros plan : la carte du nœud et son libellé (px de l'écran de référence 1080 × 1920). En 9:16, la carte
 * déborde de l'écran à droite (maquette OUV-E-1) ; en 4:5 (intégration, défaut vu à l'œil : « carte ALERTE TELEGRAM
 * coupée à droite »), elle est fermée dans le cadre. Le libellé n'est JAMAIS coupé : réduit pour tenir (58 px au moins),
 * sinon sur 2 lignes.
 */
export function grosPlanOuvE(libelle: string, format: "9:16" | "4:5") {
  const carte = format === "4:5" ? { x: 40, l: 1000 } : { x: 40, l: 1200 };
  const texte = { x: 110, largeur: format === "4:5" ? 840 : 900 };
  const tient = (l: string) => Math.floor(texte.largeur / Math.max(0.01, largeurAnton(l, 1)));
  const une = Math.min(116, tient(libelle));
  if (une >= 58) return { carte, texte: { ...texte, taille: une, lignes: [libelle] } };
  const mots = libelle.split(/\s+/).filter(Boolean);
  let lignes = [libelle];
  let taille = une;
  for (let k = 1; k < mots.length; k++) {
    const essai = [mots.slice(0, k).join(" "), mots.slice(k).join(" ")];
    const t = Math.min(96, ...essai.map(tient));
    if (t > taille) [lignes, taille] = [essai, t];
  }
  return { carte, texte: { ...texte, taille, lignes } };
}

/** Affiche de la première image (recopie de `AfficheIV` du moteur, `variete/axes/ouverture.ts`) : l'OUV-D dans son état final. */
export type AfficheIV = { donnees: Extract<DonneesOuverture, { code: "OUV-D" }>; fond: "ivoire" | "sombre"; images: number };
/** Propriétés d'une composition dont la première image est l'affiche (absente ou `null` : rien de posé). */
export type AvecAfficheIV = { affiche?: AfficheIV | null };

/**
 * OUV-E · recul : le libellé de la carte centrale (460 px). Une ligne tant qu'elle tient à 58 px au moins (code d'avant,
 * `lc` 530) ; sinon 2 lignes équilibrées à 64 px au plus ; sinon la carte s'élargit (900 px au plus, `lc` = ligne la plus
 * large à 58 px + 90) ; sinon la taille qui tient, sous 58 px, avec une remarque (jamais un blocage).
 */
export function libelleRecul(libelle: string): { lignes: string[]; taille: number; lc: number } {
  const dispo = 440;
  const tient = (l: string, largeur: number) => Math.floor(largeur / Math.max(0.01, largeurAnton(l, 1)));
  const une = tient(libelle, dispo);
  if (une >= 58) return { lignes: [libelle], taille: Math.min(64, une), lc: 530 };
  const mots = libelle.split(/\s+/).filter(Boolean);
  const lignes = couperEquilibre(mots, 2).map((m) => m.join(" "));
  const large = Math.max(0.01, ...lignes.map((l) => largeurAnton(l, 1)));
  const deux = Math.floor(Math.min(64, dispo / large));
  if (deux >= 58) return { lignes, taille: deux, lc: 530 };
  const lc = Math.min(900, Math.ceil(large * 58) + 90);
  const taille = Math.floor(Math.min(64, (lc - 90) / large));
  if (taille >= 58) return { lignes, taille, lc };
  console.warn(`OUV-E recul : le libellé « ${libelle} » ne tient pas à 58 px (${taille} px)`);
  return { lignes, taille, lc };
}
