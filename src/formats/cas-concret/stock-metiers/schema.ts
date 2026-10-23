/**
 * STOCK DE CAS PAR MÉTIER (lot K1) : le contrat du RANGEMENT d'un cas. PUR.
 * Le rangement vit À CÔTÉ du cas, jamais dedans : le contrat du cas est strict et son empreinte couvre tout le cas
 * (voir `PLAN-DE-CONCEPTION.md`, G.2). Il sert aux compteurs et aux filtres (lots suivants), pas à la fabrication.
 * Les champs de relecture de la fiche (`statut`, `qualite`, `descriptionPorteB`) n'entrent PAS ici : l'import les retire.
 */
import { z } from "zod";

export const TAILLES_STOCK = ["TPE", "PME", "ETI"] as const;
export const NIVEAUX_PREUVE = ["lu-dans-le-code", "offre-a-construire", "sans-automatisation", "a-confirmer"] as const;

const texte = (max: number) => z.string().trim().min(1, "texte vide").max(max, `texte trop long (${max} caractères au plus)`);
const kebab = z.string().regex(/^[a-z][a-z0-9.-]{1,80}$/, "identifiant en minuscules, chiffres, tirets et points");

export const schemaRangement = z
  .object({
    /** Numéro de la fiche (« IN-01 ») : l'ordre de l'import et du « Proposez-moi un cas restant ». */
    fiche: z.string().regex(/^[A-Z]{2}-\d{2,3}$/, "numéro de fiche attendu (ex. IN-01)"),
    secteur: z.string().regex(/^[A-Z]{2}$/, "code de secteur à deux lettres"),
    metier: kebab,
    metierNom: texte(80),
    taille: z.enum(TAILLES_STOCK),
    /** Socle d'automatisation (« S02 ») ou code sans automatisation (« F », « AU », « CO », « OC »). */
    socle: z.string().regex(/^(S\d{2}|F|AU|CO|OC)$/, "socle inconnu"),
    inventaire: z.array(z.string().regex(/^[A-Z]\d+(\.\d+)?$/, "référence d'inventaire mal formée")).max(6),
    niveauPreuve: z.enum(NIVEAUX_PREUVE),
    douleur: kebab,
    /** Cas d'usage de la banque de l'Usine ; aucun pour 28 des 96 fiches de l'export du 19/10 : `null`. */
    casUsage: kebab.nullable(),
    /** Cas du catalogue le plus proche (anti-doublon éditorial) ; aucun : `null`. */
    voisinCatalogue: z.string().regex(/^[a-z][a-z0-9-]{1,47}$/, "identifiant de cas mal formé").nullable(),
    /** Ce qui distingue la fiche de son voisin du catalogue ; sans voisin (45 fiches sur 96), `null`. */
    angle: texte(300).nullable(),
  })
  .strict();

export type Rangement = z.infer<typeof schemaRangement>;

/** Une ligne du fichier `stock.json` : le cas (contrat de `cas.ts`) et son rangement, rien d'autre. */
export const schemaLigneStock = z.object({ rangement: z.unknown(), cas: z.unknown() }).strict();

export type ResultatRangement = { ok: true; rangement: Rangement } | { ok: false; raisons: string[] };

/** Valide un rangement brut ; refus en français, un message par défaut avec son emplacement (comme `verifierCas`). */
export function verifierRangement(brut: unknown): ResultatRangement {
  const lu = schemaRangement.safeParse(brut);
  if (lu.success) return { ok: true, rangement: lu.data };
  return {
    ok: false,
    raisons: lu.error.issues.map((i) => {
      const lieu = i.path.length ? `rangement.${i.path.join(".")} : ` : "rangement : ";
      if (i.code === "invalid_type") return `${lieu}valeur absente ou de mauvais type`;
      if (i.code === "unrecognized_keys") return `${lieu}champ inconnu`;
      if (i.code === "invalid_value") return `${lieu}valeur non permise`;
      return `${lieu}${i.message}`;
    }),
  };
}
