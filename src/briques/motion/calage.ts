/**
 * CALAGE DES CARTES SUR LA PAROLE (brique `motion`) : chaque élément d'une carte apparaît quand la voix le dit. Les
 * horodatages viennent de l'aligneur (mots de la transcription, en secondes de la vidéo). PUR, sans alias « @/ ».
 */
import type { CarteModele, DonneesParModele } from "./types";

export interface MotCalage {
  mot: string;
  debutSec: number;
  finSec: number;
}

const normaliser = (m: string) =>
  m
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

/** Mots vides ignorés pour retrouver un élément dans la parole. */
const VIDES = new Set(["le", "la", "les", "l", "un", "une", "des", "de", "du", "d", "et", "a", "au", "aux", "en", "pour", "par", "sur", "avec", "est", "ce", "qu", "que", "qui", "on", "vous", "votre", "vos", "se", "sa", "son", "ses", "y"]);

/** Mots porteurs de sens d'un texte (normalisés). */
export function motsCles(texte: string): string[] {
  return texte
    .split(/[\s'’\-]+/)
    .map(normaliser)
    .filter((m) => m.length > 1 && !VIDES.has(m));
}

/**
 * Instant (s, relatif à `debutCarteSec`) où la parole commence à dire `texte` : premier mot porteur de sens retrouvé
 * après `apresSec` (les éléments se suivent). Un chiffre écrit (« 3 ») retrouve aussi le mot dit (« trois »).
 */
export function instantDit(texte: string, mots: MotCalage[], debutCarteSec: number, apresSec = 0): number | undefined {
  const cles = motsCles(texte).map((m) => NOMBRES_DITS[m] ?? m);
  if (!cles.length) return undefined;
  const candidats = mots.filter((m) => m.debutSec - debutCarteSec >= apresSec - 1e-6);
  for (const cle of cles) {
    const trouve = candidats.find((m) => {
      const n = normaliser(m.mot);
      return n === cle || (cle.length >= 5 && n.length >= 5 && (n.startsWith(cle.slice(0, 5)) || cle.startsWith(n.slice(0, 5))));
    });
    if (trouve) return +(trouve.debutSec - debutCarteSec).toFixed(3);
  }
  return undefined;
}

const NOMBRES_DITS: Record<string, string> = { "1": "un", "2": "deux", "3": "trois", "4": "quatre", "5": "cinq", "6": "six", "7": "sept", "8": "huit", "9": "neuf", "10": "dix", "12": "douze", "15": "quinze", "20": "vingt", "30": "trente", "45": "quarante", "50": "cinquante", "100": "cent" };

/** `n` instants régulièrement répartis entre `debut` et `fin` (s). */
export function repartir(n: number, debut: number, fin: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [debut];
  return Array.from({ length: n }, (_, i) => +(debut + ((fin - debut) * i) / (n - 1)).toFixed(3));
}

/**
 * Horaires d'office d'une carte de `dureeSec` : le titre tout de suite, puis les éléments répartis sur les 60 %
 * suivants, pour laisser une seconde pleine et la chute à la fin.
 */
export function horairesParDefaut(n: number, dureeSec: number, avecTitre: boolean): number[] {
  const debut = avecTitre ? 0.8 : 0.25;
  const fin = Math.max(debut, Math.min(dureeSec - 1.7, debut + (n - 1) * 1.1));
  return repartir(n, debut, fin);
}

/**
 * Cale une carte sur la parole : chaque `aSec` absent est retrouvé dans les mots (sinon réparti d'office). Les
 * instants restent croissants, au moins 0,35 s d'écart, et laissent la chute finale libre.
 */
export function calerCarte(carte: CarteModele, mots: MotCalage[], debutCarteSec: number, dureeSec: number): CarteModele {
  const fin = Math.max(0.5, dureeSec - 1.4);
  const suite = (textes: string[], existants: (number | undefined)[], avecTitre: boolean) => {
    const defaut = horairesParDefaut(textes.length, dureeSec, avecTitre);
    let dernier = avecTitre ? 0.45 : -0.35;
    return textes.map((tx, i) => {
      const v = existants[i] ?? instantDit(tx, mots, debutCarteSec, Math.max(0, dernier)) ?? defaut[i];
      const borne = Math.min(fin, Math.max(dernier + 0.35, v));
      dernier = borne;
      return +borne.toFixed(3);
    });
  };
  switch (carte.modele) {
    case "liste": {
      const d = carte.donnees;
      const a = suite(
        d.elements.map((e) => e.texte),
        d.elements.map((e) => e.aSec),
        !!d.titre,
      );
      return { modele: "liste", donnees: { ...d, elements: d.elements.map((e, i) => ({ ...e, aSec: a[i] })) } };
    }
    case "ligne-de-temps": {
      const d = carte.donnees;
      const a = suite(
        d.etapes.map((e) => e.titre),
        d.etapes.map((e) => e.aSec),
        !!d.titre,
      );
      return { modele: "ligne-de-temps", donnees: { ...d, etapes: d.etapes.map((e, i) => ({ ...e, aSec: a[i] })) } };
    }
    case "chiffre": {
      const d = carte.donnees;
      const v = d.aSec ?? instantDit(String(d.valeur), mots, debutCarteSec) ?? 0.3;
      return { modele: "chiffre", donnees: { ...d, aSec: Math.min(fin, v) } };
    }
    case "avant-apres": {
      const d = carte.donnees;
      const v = d.aSecApres ?? instantDit(`${d.apres.valeur} ${d.apres.libelle ?? ""}`, mots, debutCarteSec, 0.6) ?? Math.min(1.8, dureeSec * 0.35);
      return { modele: "avant-apres", donnees: { ...d, aSecApres: Math.min(fin, Math.max(1.1, v)) } };
    }
    case "deux-colonnes": {
      const d = carte.donnees;
      const droite = d.aSecDroite ?? instantDit(d.droite.titre, mots, debutCarteSec, 0.6) ?? Math.min(1.5, dureeSec * 0.3);
      const commun = d.aSecCommun ?? instantDit(d.commun.titre ?? d.commun.points[0] ?? "", mots, debutCarteSec, droite + 0.5) ?? Math.min(fin, droite + 1.2);
      return { modele: "deux-colonnes", donnees: { ...d, aSecDroite: Math.min(fin, droite), aSecCommun: Math.min(fin, Math.max(droite + 0.6, commun)) } };
    }
    default:
      return carte;
  }
}

export type { DonneesParModele };
