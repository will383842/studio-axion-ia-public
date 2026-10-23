/**
 * Contrôles de rendu réel des types de pages : contenu MAXIMAL du schéma (aucun débordement : le rendu réussit) et contenu MINIMAL
 * (aucune zone vide de plus de 15 % de la hauteur sur au moins la moitié de la largeur). Partagé par le script d'essai et les tests.
 */
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { PAGES, type TypePage } from "../../src/briques/visuels/registre-pages.js";
import { CHARTE_CARROUSEL } from "../../src/briques/visuels/charte-carrousel.js";
import { FORMAT } from "../compositions/visuels/commun/constantes.js";
import { decoderPng, plusHauteZoneVide } from "./analyse-image.js";
import { casMax, casMin, specAutour } from "./contenu-essai-visuel.js";
import type { Rendeur } from "./rendu-visuel.js";

/** Part de la hauteur de page au-delà de laquelle une zone vide est refusée. */
export const PART_ZONE_VIDE_MAX = 0.15;
/** Largeur minimale (part de la largeur de page) d'une zone vide comptée. */
export const PART_LARGEUR_ZONE_VIDE = 0.5;

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
    const zone = plusHauteZoneVide(decoderPng(readFileSync(sortie)), [pale], FORMAT.largeur * PART_LARGEUR_ZONE_VIDE);
    resultats.push({ nom: cas.nom, hauteurVidePx: zone.hauteurPx, part: zone.hauteurPx / FORMAT.hauteur, x: zone.x, y: zone.y });
  }
  return resultats;
}

function hexVersRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

/** Types contrôlés : tous ceux du registre qui ont un contenu à contrôler. */
export const TYPES_CONTROLES = Object.keys(PAGES) as TypePage[];
