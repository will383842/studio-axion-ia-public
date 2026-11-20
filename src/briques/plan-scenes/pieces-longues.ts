/**
 * VL-10 · Trois pièces 16:9 du plan de scènes d'une vidéo longue : intercalaire de chapitre, schéma de flux ramifié,
 * cadre de capture. PUR (zod seulement, aucun React) : schémas, exemples, toiles et disposition, lus par le catalogue
 * (`catalogue.ts`) et par le rendu (`briques/PiecesLongues.tsx`).
 * Porte fermée : ces pièces figurent dans `PIECES_GARDEES` ; tant que `objetsPermis` ne les cite pas, la consigne du
 * plan, la validation et le chat de retouche restent identiques à aujourd'hui. Aucune n'affiche un texte qui ne soit
 * dans ses paramètres (titre, libellés d'étapes) ; aucun montant, aucune marque, aucune coche, aucune étiquette.
 * Le schéma de flux reprend la grammaire visuelle de `SchemaFlux.tsx` (T-EXT-50) : bloc blanc bordé, étape humaine en
 * bloc noir, flèche noire qui se trace avant le bloc qu'elle atteint. `SchemaFlux.tsx` ne peut pas être importé ici
 * (il vit dans `studio-rendu` et lit les hooks de Remotion) : seule la disposition change, en colonnes de gauche à droite.
 */
import { z } from "zod";
import { TOILES } from "./toiles";

const texteCourt = (max: number) => z.string().trim().min(1).max(max);
const surMot = z.number().int().min(0);
const aMs = z.number().min(0).optional();

export const IDS_PIECES_LONGUES = ["intercalaire-chapitre", "flux-ramifie", "cadre-capture"] as const;
export type IdPieceLongue = (typeof IDS_PIECES_LONGUES)[number];

/** Toiles 16:9 (px de dessin ; le rendu les met à l'échelle dans la zone de la scène), lues dans `toiles.ts`. Cadre de capture : marge 20, barre de titre 64, zone de capture 1440 × 810 (exactement 16:9). */
export const TOILES_LONGUES = {
  "intercalaire-chapitre": TOILES["intercalaire-chapitre"],
  "flux-ramifie": TOILES["flux-ramifie"],
  "cadre-capture": TOILES["cadre-capture"],
} as const;

export const CAPTURE_16_9 = { largeur: 1440, hauteur: 810, barre: 64, marge: 20 } as const;

export const schemaIntercalaireChapitre = z.strictObject({
  /** Numéro du chapitre dans la vidéo (1 à 99). */
  numero: z.number().int().min(1).max(99),
  titre: texteCourt(60),
  surMot,
  aMs,
});

const noeudFlux = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]{1,12}$/),
  texte: texteCourt(30),
  /** Étape faite par une personne : bloc noir. */
  humain: z.boolean(),
  surMot,
  aMs,
});
const lienFlux = z.strictObject({
  de: z.string().regex(/^[a-z0-9-]{1,12}$/),
  vers: z.string().regex(/^[a-z0-9-]{1,12}$/),
  pointille: z.boolean(),
});

/** 3 à 8 étapes, 2 à 10 liens ; au moins une étape qui se sépare en deux (c'est ce qui fait le flux ramifié). */
export const schemaFluxRamifie = z
  .strictObject({
    noeuds: z.array(noeudFlux).min(3).max(8),
    liens: z.array(lienFlux).min(2).max(10),
  })
  .superRefine((p, ctx) => {
    const ids = p.noeuds.map((n) => n.id);
    let nbFautes = 0;
    const faute = (message: string) => {
      nbFautes += 1;
      ctx.addIssue({ code: "custom", message });
    };
    if (new Set(ids).size !== ids.length) faute("Deux étapes portent le même identifiant.");
    const connus = new Set(ids);
    const sortants = new Map<string, number>();
    for (const l of p.liens) {
      if (!connus.has(l.de) || !connus.has(l.vers)) faute("Un lien désigne une étape inconnue.");
      if (l.de === l.vers) faute("Un lien ne peut pas revenir sur sa propre étape.");
      sortants.set(l.de, (sortants.get(l.de) ?? 0) + 1);
    }
    if (![...sortants.values()].some((n) => n >= 2)) faute("Aucune étape ne se sépare en deux : ce n'est pas un flux ramifié.");
    if (p.liens.length > 0 && !profondeurs(p.noeuds, p.liens)) faute("Les liens forment une boucle.");
    // Un plan valide doit se dessiner sans recouvrement : au-delà (trop de colonnes, trop d'étapes dans une colonne), il est refusé.
    if (nbFautes === 0 && !fluxTientDansLeCadre(disposerFluxLarge(p.noeuds, p.liens))) faute("Le schéma ne tient pas dans le cadre : trop de colonnes ou trop d'étapes dans une même colonne.");
  });

export const schemaCadreCapture = z.strictObject({
  titre: texteCourt(40),
  surMot,
  aMs,
});

export const EXEMPLES_LONGUES: {
  "intercalaire-chapitre": z.infer<typeof schemaIntercalaireChapitre>;
  "flux-ramifie": z.infer<typeof schemaFluxRamifie>;
  "cadre-capture": z.infer<typeof schemaCadreCapture>;
} = {
  "intercalaire-chapitre": { numero: 2, titre: "Le suivi des stocks", surMot: 0, aMs: 300 },
  "flux-ramifie": {
    noeuds: [
      { id: "a", texte: "Une demande arrive", humain: false, surMot: 0, aMs: 300 },
      { id: "b", texte: "Le Studio la trie", humain: false, surMot: 2, aMs: 1000 },
      { id: "c", texte: "Réponse envoyée", humain: false, surMot: 4, aMs: 1800 },
      { id: "d", texte: "Vous validez", humain: true, surMot: 6, aMs: 2600 },
    ],
    liens: [
      { de: "a", vers: "b", pointille: false },
      { de: "b", vers: "c", pointille: false },
      { de: "b", vers: "d", pointille: true },
    ],
  },
  "cadre-capture": { titre: "Mon logiciel", surMot: 0, aMs: 300 },
};

export const NOMS_LONGUES: Record<IdPieceLongue, { nom: string; description: string }> = {
  "intercalaire-chapitre": { nom: "Intercalaire de chapitre", description: "Un grand écran de passage « Chapitre n » avec le titre du chapitre, posé quand le chapitre commence." },
  "flux-ramifie": { nom: "Schéma de flux ramifié", description: "Un schéma de 3 à 8 étapes reliées par des flèches, dont une étape se sépare en deux chemins ; chaque étape apparaît au mot où elle est dite." },
  "cadre-capture": { nom: "Cadre de capture 16:9", description: "Une fenêtre de logiciel dont la zone d'image est en 16:9, qui accueille une capture d'écran fournie." },
};

/* ------------------------------ Disposition du schéma ------------------------------ */

type NoeudLien = { id: string };
type LienSimple = { de: string; vers: string };

/** Colonne de chaque étape (chemin le plus long depuis une entrée) ; `null` si les liens forment une boucle. */
export function profondeurs(noeuds: readonly NoeudLien[], liens: readonly LienSimple[]): Map<string, number> | null {
  const prof = new Map<string, number>(noeuds.map((n) => [n.id, 0]));
  for (let tour = 0; tour <= noeuds.length; tour += 1) {
    let change = false;
    for (const l of liens) {
      const d = prof.get(l.de);
      const v = prof.get(l.vers);
      if (d === undefined || v === undefined) continue;
      if (v < d + 1) {
        prof.set(l.vers, d + 1);
        change = true;
      }
    }
    if (!change) return prof;
  }
  return null;
}

export interface BoiteFlux {
  id: string;
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  colonne: number;
}

export const BOITE_FLUX: { largeur: number; hauteur: number } = { largeur: 300, hauteur: 128 };
const MARGE_FLUX = 60;

/** Boîtes posées sur la toile 1600 × 900 : une colonne par profondeur, lignes réparties, tout reste dans le cadre. */
export function disposerFluxLarge(noeuds: readonly NoeudLien[], liens: readonly LienSimple[]): BoiteFlux[] {
  const { largeur: L, hauteur: H } = TOILES_LONGUES["flux-ramifie"];
  const prof = profondeurs(noeuds, liens) ?? new Map(noeuds.map((n, i) => [n.id, i] as const));
  const colonnes = new Map<number, string[]>();
  for (const n of noeuds) {
    const c = prof.get(n.id) ?? 0;
    colonnes.set(c, [...(colonnes.get(c) ?? []), n.id]);
  }
  const rangs = [...colonnes.keys()].sort((a, b) => a - b);
  const nbCol = rangs.length;
  const pas = nbCol > 1 ? (L - 2 * MARGE_FLUX - BOITE_FLUX.largeur) / (nbCol - 1) : 0;
  const boites: BoiteFlux[] = [];
  rangs.forEach((c, i) => {
    const ids = colonnes.get(c) ?? [];
    const zone = H - 2 * MARGE_FLUX;
    const casier = zone / ids.length;
    ids.forEach((id, k) => {
      boites.push({
        id,
        colonne: i,
        largeur: BOITE_FLUX.largeur,
        hauteur: BOITE_FLUX.hauteur,
        x: nbCol > 1 ? MARGE_FLUX + pas * i : (L - BOITE_FLUX.largeur) / 2,
        y: MARGE_FLUX + casier * k + (casier - BOITE_FLUX.hauteur) / 2,
      });
    });
  });
  return boites;
}

/** Aucune boîte ne sort de la toile et aucune n'en recouvre une autre. */
export function fluxTientDansLeCadre(boites: readonly BoiteFlux[]): boolean {
  const { largeur: L, hauteur: H } = TOILES_LONGUES["flux-ramifie"];
  const dedans = boites.every((b) => b.x >= 0 && b.y >= 0 && b.x + b.largeur <= L && b.y + b.hauteur <= H);
  const libres = boites.every((a, i) => boites.slice(i + 1).every((b) => a.x + a.largeur <= b.x || b.x + b.largeur <= a.x || a.y + a.hauteur <= b.y || b.y + b.hauteur <= a.y));
  return dedans && libres;
}
