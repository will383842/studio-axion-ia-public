/**
 * SCHÉMAS ZOD DES MODÈLES 7 À 13 (brique `motion`, lot F2) : validation de ce que Claude renvoie avant le rendu, comme
 * `schemas.ts` pour les 6 premiers (mêmes bornes de texte, mêmes instants). Côté studio seulement.
 * `schemaCarteMotionTous` accepte les 13 modèles ; `schemaCarteModele` (6 modèles) reste inchangé.
 */
import { z } from "zod";
import { NOMS_ICONES, type NomIcone } from "./icones";
import { contientNomOuBandeau } from "./documentaire";
import { schemaCarteModele } from "./schemas";
import type { CarteModeleEtendu, CarteMotionTous } from "./types-etendus";

const nomIcone = z.enum(NOMS_ICONES as [NomIcone, ...NomIcone[]]);
const icone = nomIcone.optional();
const texte = (max: number) => z.string().trim().min(1).max(max);
const instant = z.number().min(0).max(8).optional();
const fraction = z.number().min(0).max(1);

export { contientNomOuBandeau };

const texteDocumentaire = (max: number) => texte(max).refine((v) => !contientNomOuBandeau(v), { message: "Carte documentaire : jamais de nom de personne ni de bandeau « nom · marque »." });

export const schemaGraphique = z
  .object({
    variante: z.enum(["barres", "courbe", "camembert"]),
    titre: texte(60).optional(),
    unite: z.string().max(12).optional(),
    decimales: z.number().int().min(0).max(2).optional(),
    series: z.array(z.object({ libelle: texte(24), valeur: z.number().finite().min(0), aSec: instant })).min(2).max(6),
    miseEnAvant: z.number().int().min(0).max(5).optional(),
    note: texte(50).optional(),
  })
  .refine((d) => d.miseEnAvant === undefined || d.miseEnAvant < d.series.length, { message: "miseEnAvant hors des valeurs", path: ["miseEnAvant"] })
  .refine((d) => d.variante !== "camembert" || d.series.some((s) => s.valeur > 0), { message: "camembert sans part", path: ["series"] });

export const schemaIconeMot = z.object({
  mot: texte(28).refine((m) => m.replace(/\*/g, "").trim().split(/\s+/).length <= 3, { message: "3 mots au plus" }),
  icone: nomIcone,
  surTitre: texte(30).optional(),
  sousTitre: texte(60).optional(),
  aSec: instant,
});

const face = z.object({ titre: texte(40), detail: texte(50).optional(), icone });
export const schemaProblemeSolution = z.object({
  probleme: face,
  solution: face,
  etiquetteProbleme: texte(16).optional(),
  etiquetteSolution: texte(16).optional(),
  aSecSolution: instant,
});

export const schemaCheckList = z.object({
  titre: texte(60).optional(),
  aSecTitre: instant,
  elements: z.array(z.object({ texte: texte(48), aSec: instant })).min(2).max(6),
});

const annotation = z
  .object({ type: z.enum(["cercle", "fleche", "surligne", "cadre"]), x: fraction, y: fraction, largeur: fraction, hauteur: fraction, texte: texte(24).optional(), aSec: instant })
  .refine((a) => a.x + a.largeur <= 1.001 && a.y + a.hauteur <= 1.001, { message: "annotation hors de l'image" });
export const schemaCaptureAnnotee = z.object({
  image: z.object({
    src: z.string().min(1).max(3_000_000),
    origine: z.enum(["mes-images", "broll"]),
    largeur: z.number().int().positive().optional(),
    hauteur: z.number().int().positive().optional(),
    description: z.string().max(200).optional(),
  }),
  titre: texte(60).optional(),
  annotations: z.array(annotation).min(1).max(4),
  zoom: z.boolean().optional(),
});

export const schemaTitrePleinEcran = z.object({
  titre: texte(48),
  motCle: texte(30).optional(),
  numero: z.string().trim().max(3).optional(),
  surTitre: texte(30).optional(),
  sousTitre: texte(60).optional(),
});

export const schemaDocumentaire = z
  .object({
    lieu: texteDocumentaire(40).optional(),
    date: texteDocumentaire(30).optional(),
    chiffre: z.object({ valeur: z.number().finite(), unite: z.string().max(14).optional(), libelle: texteDocumentaire(60), decimales: z.number().int().min(0).max(2).optional() }).optional(),
    contexte: texteDocumentaire(60).optional(),
    aSec: instant,
  })
  .refine((d) => !!(d.lieu || d.date || d.chiffre), { message: "au moins un lieu, une date ou un chiffre" })
  .refine((d) => !d.chiffre?.unite || !contientNomOuBandeau(d.chiffre.unite), { message: "jamais de nom ni de marque" });

export const schemaCarteModeleEtendu = z.discriminatedUnion("modele", [
  z.object({ modele: z.literal("graphique"), donnees: schemaGraphique }),
  z.object({ modele: z.literal("icone-mot"), donnees: schemaIconeMot }),
  z.object({ modele: z.literal("probleme-solution"), donnees: schemaProblemeSolution }),
  z.object({ modele: z.literal("check-list"), donnees: schemaCheckList }),
  z.object({ modele: z.literal("capture-annotee"), donnees: schemaCaptureAnnotee }),
  z.object({ modele: z.literal("titre-plein-ecran"), donnees: schemaTitrePleinEcran }),
  z.object({ modele: z.literal("documentaire"), donnees: schemaDocumentaire }),
]);

/** Les 13 modèles. */
export const schemaCarteMotionTous = z.union([schemaCarteModele, schemaCarteModeleEtendu]);

/** Carte 7 à 13 validée, ou null. */
export function lireCarteEtendue(valeur: unknown): CarteModeleEtendu | null {
  const r = schemaCarteModeleEtendu.safeParse(valeur);
  return r.success ? (r.data as CarteModeleEtendu) : null;
}

/** Carte de l'un des 13 modèles validée, ou null (le moteur pose alors le repli). */
export function lireCarteTous(valeur: unknown): CarteMotionTous | null {
  const r = schemaCarteMotionTous.safeParse(valeur);
  return r.success ? (r.data as CarteMotionTous) : null;
}
