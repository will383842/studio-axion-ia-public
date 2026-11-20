/**
 * G4-11b-PREP-v19c : fiche d'identité de la courbe à plusieurs séries (schéma, exemple, nom, alias).
 * PURE, imports relatifs seulement. Pièce NON inscrite : rien n'importe ce fichier (l'inscription est G4-11b).
 */
import { z } from "zod";
import type { DefinitionBrique } from "../plan-scenes/catalogue";
import { TOILES } from "../plan-scenes/toiles";
import { POINTS_MAX, POINTS_MIN, SERIES_MAX, SERIES_MIN, type ParametresCourbeSeries } from "./courbe-series";

/** Mêmes bornes que `valider` de courbe-series.ts (aucune de plus). */
export const schemaCourbeSeries = z
  .strictObject({
    titre: z.string().regex(/\S/),
    abscisses: z.array(z.string()).min(POINTS_MIN).max(POINTS_MAX),
    series: z
      .array(z.strictObject({ nom: z.string().regex(/\S/), valeurs: z.array(z.number().finite()) }))
      .min(SERIES_MIN)
      .max(SERIES_MAX),
    enAvant: z.number().int().min(0).optional(),
  })
  .superRefine((p, ctx) => {
    p.series.forEach((s, i) => {
      if (s.valeurs.length !== p.abscisses.length) {
        ctx.addIssue({ code: "custom", path: ["series", i, "valeurs"], message: "autant de valeurs que d'abscisses attendu" });
      }
    });
    if (p.enAvant !== undefined && p.enAvant >= p.series.length) {
      ctx.addIssue({ code: "custom", path: ["enAvant"], message: "enAvant hors des séries" });
    }
  });

export const EXEMPLE_COURBE_SERIES: ParametresCourbeSeries = {
  titre: "Demandes par mois",
  abscisses: ["Jan", "Fév", "Mar", "Avr"],
  series: [
    { nom: "2025", valeurs: [12, 18, 15, 22] },
    { nom: "2026", valeurs: [20, 26, 31, 40] },
  ],
  enAvant: 1,
};

export const DEFINITION_COURBE_SERIES: DefinitionBrique<typeof schemaCourbeSeries> = {
  id: "courbe-series",
  nom: "Courbes comparées",
  description: "2 à 4 séries de chiffres tracées l'une après l'autre sur le même axe, une série mise en avant.",
  famille: "donnee",
  alias: ["courbes", "plusieurs courbes", "series", "evolution comparee"],
  toile: TOILES.graphique,
  schema: schemaCourbeSeries,
  exemple: EXEMPLE_COURBE_SERIES,
};

const estObjet = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;

/** Toutes les valeurs des séries (nombres finis seulement). Ne lève jamais. */
export function nombresCourbeSeries(p: unknown): number[] {
  if (!estObjet(p) || !Array.isArray(p.series)) return [];
  const sortie: number[] = [];
  for (const s of p.series) {
    if (!estObjet(s) || !Array.isArray(s.valeurs)) continue;
    for (const v of s.valeurs) if (typeof v === "number" && Number.isFinite(v)) sortie.push(v);
  }
  return sortie;
}

/** Titre, abscisses, noms de séries. Ne lève jamais. */
export function textesCourbeSeries(p: unknown): string[] {
  if (!estObjet(p)) return [];
  const sortie: string[] = [];
  if (typeof p.titre === "string") sortie.push(p.titre);
  if (Array.isArray(p.abscisses)) for (const a of p.abscisses) if (typeof a === "string") sortie.push(a);
  if (Array.isArray(p.series)) for (const s of p.series) if (estObjet(s) && typeof s.nom === "string") sortie.push(s.nom);
  return sortie;
}
