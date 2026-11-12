/**
 * Mise en page PURE des infographies (L2-06) : aucune dépendance de rendu, mesurable sans navigateur. Trois gabarits (chiffres clés, étapes,
 * comparaison) sur deux ratios (1:1, 9:16). Toute couleur vient de la charte 2026. Un texte qui ne tient pas dans sa boîte à 26 px au moins est REFUSÉ
 * (jamais coupé en silence). La largeur est la mesure réelle de Manrope ExtraBold (`largeurMot`), comme la porte qualité des carrousels.
 */
import { PALETTE } from "../../../../../src/briques/charte/axion-2026";
import { largeurMot, motsInsecables } from "../../../../../src/briques/visuels/largeur-mot";
import type { InfographieSpecType } from "../../../../../src/domaine/visuels/schema-infographie";

export type Gabarit = "chiffres-cles" | "etapes" | "comparaison";
export type RatioInfographie = "1:1" | "9:16";

export const GABARITS_INFOGRAPHIE: readonly Gabarit[] = ["chiffres-cles", "etapes", "comparaison"];
export const FORMATS_INFOGRAPHIE: Record<RatioInfographie, { largeur: number; hauteur: number }> = {
  "1:1": { largeur: 1080, hauteur: 1080 },
  "9:16": { largeur: 1080, hauteur: 1920 },
};
export const TAILLE_MIN_INFOGRAPHIE = 26;
export const ID_COMPOSITION_INFOGRAPHIE = "Infographie";

const MARGE = 64;
const ECART = 24;
export const INTERLIGNE_INFOGRAPHIE = 1.2;
const INTERLIGNE = INTERLIGNE_INFOGRAPHIE;

export class ErreurDebordementInfographie extends Error {
  constructor(zone: string, texte: string) {
    super(`Le texte de « ${zone} » déborde de sa boîte (${texte.slice(0, 40)}) : il serait coupé`);
    this.name = "ErreurDebordementInfographie";
  }
}

export interface Forme { x: number; y: number; largeur: number; hauteur: number; fond: string }
export interface TexteMis {
  zone: string;
  x: number; y: number; largeur: number; hauteur: number;
  taille: number; lignes: string[];
  couleur: string; surFond: string;
  graisse: 500 | 800;
}
export interface MiseEnPage { gabarit: Gabarit; ratio: RatioInfographie; largeur: number; hauteur: number; fond: string; formes: Forme[]; textes: TexteMis[] }

/** Coupe aux espaces ordinaires (les insécables restent collées au mot, typographie française) ; `null` si un mot dépasse la largeur. */
function lignesDe(texte: string, largeur: number, taille: number): string[] | null {
  const lignes: string[] = [];
  let cour = "";
  for (const mot of motsInsecables(texte)) {
    if (largeurMot(mot, taille) > largeur) return null;
    // Après un trait d'union la coupure reste permise en fin de ligne, mais le mot se recolle sans espace.
    const essai = cour ? (/[-\u2010]$/.test(cour) ? cour + mot : `${cour} ${mot}`) : mot;
    if (largeurMot(essai, taille) <= largeur) cour = essai;
    else { lignes.push(cour); cour = mot; }
  }
  if (cour) lignes.push(cour);
  return lignes;
}

function poser(zone: string, texte: string, boite: Forme, tailles: readonly number[], couleur: string, surFond: string, graisse: 500 | 800): TexteMis {
  for (const taille of tailles) {
    if (taille < TAILLE_MIN_INFOGRAPHIE) continue;
    const lignes = lignesDe(texte, boite.largeur, taille);
    if (lignes && lignes.length * taille * INTERLIGNE <= boite.hauteur) return { zone, x: boite.x, y: boite.y, largeur: boite.largeur, hauteur: boite.hauteur, taille, lignes, couleur, surFond, graisse };
  }
  throw new ErreurDebordementInfographie(zone, texte);
}

const TAILLES_TITRE = [84, 72, 64, 56, 48, 40, 34, 30, 28, 26];
const TAILLES_VALEUR = [132, 112, 96, 80, 64, 52, 44, 36, 30, 26];
const TAILLES_SOUS_TITRE = [44, 40, 36, 32, 30, 28, 26];
const TAILLES_CORPS = [34, 32, 30, 28, 26];

const dedans = (b: Forme, p: number): Forme => ({ x: b.x + p, y: b.y + p, largeur: b.largeur - 2 * p, hauteur: b.hauteur - 2 * p, fond: b.fond });
const part = (b: Forme, y0: number, h: number): Forme => ({ ...b, y: b.y + y0, hauteur: h });

/** Mise en page d'un spec dans un gabarit et un ratio. Lève `ErreurDebordementInfographie` ou une `Error` claire si le spec ne convient pas au gabarit. */
export function miseEnPageInfographie(gabarit: Gabarit, ratio: RatioInfographie, spec: InfographieSpecType): MiseEnPage {
  const { largeur, hauteur } = FORMATS_INFOGRAPHIE[ratio];
  const n = spec.blocs.length;
  if (gabarit === "chiffres-cles" && spec.blocs.some((b) => !b.valeur)) throw new Error("Le gabarit chiffres clés demande une valeur dans chaque bloc");
  if (gabarit === "comparaison" && n !== 2) throw new Error("Le gabarit comparaison demande exactement deux blocs");
  const formes: Forme[] = [];
  const textes: TexteMis[] = [];
  const fond = PALETTE.ivoire;

  const hTitre = ratio === "1:1" ? 200 : 300;
  textes.push(poser("titre", spec.titre, { x: MARGE, y: MARGE, largeur: largeur - 2 * MARGE, hauteur: hTitre, fond }, TAILLES_TITRE, PALETTE.noir, fond, 800));
  const zone: Forme = { x: MARGE, y: MARGE + hTitre + ECART, largeur: largeur - 2 * MARGE, hauteur: hauteur - 2 * MARGE - hTitre - ECART, fond };

  if (gabarit === "etapes") {
    const h = (zone.hauteur - ECART * (n - 1)) / n;
    spec.blocs.forEach((b, i) => {
      const y = zone.y + i * (h + ECART);
      const disque = Math.min(96, h);
      formes.push({ x: zone.x, y, largeur: disque, hauteur: disque, fond: PALETTE.noir });
      textes.push(poser(`étape ${i + 1} numéro`, String(i + 1), { x: zone.x, y: y + (disque - 40 * INTERLIGNE) / 2, largeur: disque, hauteur: 40 * INTERLIGNE, fond: PALETTE.noir }, [40, 36, 30, 26], PALETTE.orange, PALETTE.noir, 800));
      const x = zone.x + disque + ECART;
      const l = zone.largeur - disque - ECART;
      textes.push(poser(`étape ${i + 1} titre`, b.titre, { x, y, largeur: l, hauteur: h * 0.4, fond }, TAILLES_SOUS_TITRE, PALETTE.noir, fond, 800));
      textes.push(poser(`étape ${i + 1} texte`, b.texte, { x, y: y + h * 0.4, largeur: l, hauteur: h * 0.6, fond }, TAILLES_CORPS, PALETTE.noir, fond, 500));
    });
  } else {
    const colonnes = gabarit === "comparaison" ? (ratio === "1:1" ? 2 : 1) : ratio === "1:1" ? (n <= 2 ? n : n <= 4 ? 2 : 3) : n <= 2 ? 1 : 2;
    const lignes = Math.ceil(n / colonnes);
    const lc = (zone.largeur - ECART * (colonnes - 1)) / colonnes;
    const hc = (zone.hauteur - ECART * (lignes - 1)) / lignes;
    spec.blocs.forEach((b, i) => {
      const sombre = gabarit === "comparaison" && i === 1;
      const fondCarte = sombre ? PALETTE.noir : PALETTE.blanc;
      const carte: Forme = { x: zone.x + (i % colonnes) * (lc + ECART), y: zone.y + Math.floor(i / colonnes) * (hc + ECART), largeur: lc, hauteur: hc, fond: fondCarte };
      formes.push(carte);
      const c = dedans(carte, 28);
      const encre = sombre ? PALETTE.ivoire : PALETTE.noir;
      const accent = sombre ? PALETTE.orange : PALETTE.terracotta;
      const nom = `bloc ${i + 1}`;
      if (b.valeur) {
        textes.push(poser(`${nom} valeur`, b.valeur, part(c, 0, c.hauteur * 0.34), TAILLES_VALEUR, accent, fondCarte, 800));
        textes.push(poser(`${nom} titre`, b.titre, part(c, c.hauteur * 0.34, c.hauteur * 0.2), TAILLES_SOUS_TITRE, encre, fondCarte, 800));
        textes.push(poser(`${nom} texte`, b.texte, part(c, c.hauteur * 0.54, c.hauteur * 0.46), TAILLES_CORPS, encre, fondCarte, 500));
      } else {
        textes.push(poser(`${nom} titre`, b.titre, part(c, 0, c.hauteur * 0.3), TAILLES_SOUS_TITRE, accent, fondCarte, 800));
        textes.push(poser(`${nom} texte`, b.texte, part(c, c.hauteur * 0.3, c.hauteur * 0.7), TAILLES_CORPS, encre, fondCarte, 500));
      }
    });
  }
  return { gabarit, ratio, largeur, hauteur, fond, formes, textes };
}
