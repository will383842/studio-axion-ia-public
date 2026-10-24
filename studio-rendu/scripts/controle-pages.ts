/**
 * Contrôles de rendu réel des types de pages : contenu MAXIMAL du schéma (aucun débordement : le rendu réussit) et contenu MINIMAL
 * (aucune zone vide de plus de 15 % de la hauteur sur au moins la moitié de la largeur, la bande de droite x ≥ 912 ignorée). Partagé par le
 * script d'essai et les tests.
 */
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { PAGES, type TypePage } from "../../src/briques/visuels/registre-pages.js";
import { CHARTE_CARROUSEL } from "../../src/briques/visuels/charte-carrousel.js";
import { BORD_DROIT_TEXTE, FORMAT } from "../compositions/visuels/commun/constantes.js";
import { decoderPng, plusHauteZoneVide, type ImageRgb, type ZoneVide } from "./analyse-image.js";
import { casMax, casMin, specAutour } from "./contenu-essai-visuel.js";
import type { Rendeur } from "./rendu-visuel.js";

/** Part de la hauteur de page au-delà de laquelle une zone vide est refusée. */
export const PART_ZONE_VIDE_MAX = 0.15;
/**
 * Largeur minimale (part de la largeur de PAGE) d'une zone vide comptée : la moitié. La bande de droite (x ≥ `BORD_DROIT_TEXTE` = 912) est
 * ignorée : elle reste sans texte par règle (flèche de LinkedIn, compteur de Meta), ce blanc voulu n'est pas une zone vide ; une page remplie
 * seulement à gauche échoue. Le vide du corps de page est aussi mesuré dans le DOM réel et publié dans les mesures de chaque rendu (`vide`,
 * contrôlé par les scripts d'essai) : le rendu ne le refuse pas.
 */
export const PART_LARGEUR_ZONE_VIDE = 0.5;

/** Image rognée à ses `largeur` premières colonnes de pixels. */
function rogner(image: ImageRgb, largeur: number): ImageRgb {
  const l = Math.min(largeur, image.largeur);
  const rgb = new Uint8Array(l * image.hauteur * 3);
  for (let y = 0; y < image.hauteur; y++) rgb.set(image.rgb.subarray(y * image.largeur * 3, (y * image.largeur + l) * 3), y * l * 3);
  return { largeur: l, hauteur: image.hauteur, rgb };
}

/** Plus haute zone vide d'une page rendue, sur sa partie à texte (x < 912), d'au moins la moitié de la largeur de page. Fonction PURE. */
export function zoneVideDuCorps(image: ImageRgb, fonds: readonly (readonly [number, number, number])[]): ZoneVide {
  return plusHauteZoneVide(rogner(image, BORD_DROIT_TEXTE), fonds, FORMAT.largeur * PART_LARGEUR_ZONE_VIDE);
}

const dossier = () => mkdtempSync(resolve(tmpdir(), "controle-pages-"));

export interface ResultatMax {
  nom: string;
  /** `null` si le rendu réussit ; sinon le message d'échec (par exemple « déborde de son cadre »). */
  erreur: string | null;
}

/** Rend chaque cas MAXIMAL du type : un débordement fait échouer le rendu, l'échec est rapporté tel quel. */
export async function controlerMax(rendeur: Rendeur, type: TypePage): Promise<ResultatMax[]> {
  const sortie = resolve(dossier(), "page.jpg");
  const resultats: ResultatMax[] = [];
  for (const cas of casMax(type)) {
    try {
      const { spec, index } = specAutour(cas.page);
      await rendeur.page(spec, index, sortie);
      resultats.push({ nom: cas.nom, erreur: null });
    } catch (e) {
      resultats.push({ nom: cas.nom, erreur: String(e instanceof Error ? e.message : e).slice(0, 300) });
    }
  }
  return resultats;
}

export interface ResultatMin {
  nom: string;
  /** Hauteur (px) de la plus haute zone vide, et part de la hauteur de page. */
  hauteurVidePx: number;
  part: number;
  /** Coin haut gauche (px) de cette zone, pour la retrouver sur l'image. */
  x: number;
  y: number;
}

/** Rend chaque cas MINIMAL du type en PNG et mesure la plus haute zone vide. */
export async function controlerMin(rendeur: Rendeur, type: TypePage): Promise<ResultatMin[]> {
  const sortie = resolve(dossier(), "page.png");
  const pale = hexVersRgb(CHARTE_CARROUSEL.couleurs.pale);
  const resultats: ResultatMin[] = [];
  for (const cas of casMin(type)) {
    const { spec, index } = specAutour(cas.page);
    await rendeur.page(spec, index, sortie, "png");
    const zone = zoneVideDuCorps(decoderPng(readFileSync(sortie)), [pale]);
    resultats.push({ nom: cas.nom, hauteurVidePx: zone.hauteurPx, part: zone.hauteurPx / FORMAT.hauteur, x: zone.x, y: zone.y });
  }
  return resultats;
}

function hexVersRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

/** Types contrôlés : tous ceux du registre qui ont un contenu à contrôler. */
export const TYPES_CONTROLES = Object.keys(PAGES) as TypePage[];
