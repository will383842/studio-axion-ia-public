/**
 * SCHÉMAS ZOD des données de chaque modèle (brique `motion`) : validation de ce que Claude renvoie (carte remplie
 * depuis une phrase) avant le rendu. Côté studio seulement (Zod n'est pas dans `studio-rendu`) : les compositions
 * lisent les types de `types.ts`.
 */
import { z } from "zod";
import { NOMS_ICONES, type NomIcone } from "./icones";
import type { CarteModele } from "./types";

const icone = z.enum(NOMS_ICONES as [NomIcone, ...NomIcone[]]).optional();
const texte = (max: number) => z.string().trim().min(1).max(max);
const instant = z.number().min(0).max(8).optional();

export const schemaListe = z.object({
  titre: texte(60).optional(),
  aSecTitre: instant,
  numerotee: z.boolean().optional(),
  elements: z.array(z.object({ texte: texte(60), icone, aSec: instant })).min(2).max(5),
});
export const schemaChiffre = z.object({
  valeur: z.number().finite(),
  decimales: z.number().int().min(0).max(2).optional(),
  prefixe: z.string().max(3).optional(),
  unite: z.string().max(12).optional(),
  libelle: z.string().max(70),
  surTitre: texte(30).optional(),
  depuis: z.number().finite().optional(),
  icone,
  aSec: instant,
});
const valeur = z.object({ valeur: z.number().finite(), unite: z.string().max(12), libelle: texte(30).optional() });
export const schemaAvantApres = z.object({
  titre: texte(60).optional(),
  avant: valeur,
  apres: valeur,
  etiquetteAvant: texte(16).optional(),
  etiquetteApres: texte(16).optional(),
  ecart: z.string().max(12).optional(),
  aSecApres: instant,
});
export const schemaLigneDeTemps = z.object({
  titre: texte(60).optional(),
  variante: z.enum(["etapes", "feuille-de-route"]).optional(),
  etapes: z.array(z.object({ titre: texte(40), detail: texte(40).optional(), icone, aSec: instant })).min(2).max(6),
});
const colonne = z.object({ titre: texte(30), points: z.array(texte(30)).max(4), icone });
export const schemaDeuxColonnes = z.object({
  titre: texte(60).optional(),
  gauche: colonne,
  droite: colonne,
  commun: z.object({ titre: texte(30).optional(), points: z.array(texte(30)).max(3) }),
  aSecDroite: instant,
  aSecCommun: instant,
});
export const schemaTitre = z.object({
  variante: z.enum(["titre", "generique"]),
  surTitre: texte(30).optional(),
  titre: texte(70),
  motCle: texte(30).optional(),
  sousTitre: texte(60).optional(),
  lignes: z.array(texte(50)).max(5).optional(),
});

export const schemaCarteModele = z.discriminatedUnion("modele", [
  z.object({ modele: z.literal("liste"), donnees: schemaListe }),
  z.object({ modele: z.literal("chiffre"), donnees: schemaChiffre }),
  z.object({ modele: z.literal("avant-apres"), donnees: schemaAvantApres }),
  z.object({ modele: z.literal("ligne-de-temps"), donnees: schemaLigneDeTemps }),
  z.object({ modele: z.literal("deux-colonnes"), donnees: schemaDeuxColonnes }),
  z.object({ modele: z.literal("titre"), donnees: schemaTitre }),
]);

export const schemaCodeSurMesure = z.object({ html: z.string().max(40_000), css: z.string().max(20_000), js: z.string().min(1).max(40_000), troisD: z.boolean().optional() });

/** Carte validée, ou null (le moteur pose alors le repli). */
export function lireCarte(valeur: unknown): CarteModele | null {
  const r = schemaCarteModele.safeParse(valeur);
  return r.success ? (r.data as CarteModele) : null;
}
