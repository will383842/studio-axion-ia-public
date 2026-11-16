/**
 * Schéma strict de l'entrée figée (PLAN-FINAL § 3.1 principe 3, § 3.2) et lecture qui ne lève jamais.
 * Champ pour champ ceux de `types.ts`. Pas d'enum, pas de valeur par défaut, pas de passthrough.
 * La vérification qu'une famille de capacité est connue appartient à la table des noms (N-16) :
 * aucune liste de familles n'est recopiée ici. Ajout pur : rien n'appelle encore ce module.
 */
import { z } from "zod";
import type {
  BlocCalques, BlocExtraits, BlocHabillage, BlocTexteEcran, Choix, EntreeBibliotheque,
  IdCapacite, ProfilVideo, RegleProfilCapacite,
} from "./types";
import { VERSION_BIBLIOTHEQUE } from "./version";

/** Clé de `commande.entrees` (§ 3.1 principe 1). */
export const CLE_ENTREE_BIBLIOTHEQUE = "bibliothequeVideo" as const;

const FORME_CAPACITE = /^[a-z-]+\.[a-z0-9.-]+$/;
const idCapacite = z.string().regex(FORME_CAPACITE).refine((s): s is IdCapacite => true);

export const schemaRegleProfilCapacite = z.strictObject({
  permis: z.boolean(),
  maxParVideo: z.number().optional(),
  decision: z.string().optional(),
}) satisfies z.ZodType<RegleProfilCapacite>;

const lit = <T extends string>(v: T) => z.literal(v);

export const schemaBlocTexteEcran = z.strictObject({
  teintes: z.array(z.union([lit("terracotta"), lit("ivoire"), lit("ardoise")])),
  cibles: z.array(z.union([lit("souligne"), lit("expression"), lit("mot-dit")])),
  pave: z.boolean(),
  outils: z.boolean(),
  bandeauNom: z.boolean(),
  intensites: z.array(z.string()),
  signaturesAEviter: z.number(),
}) satisfies z.ZodType<BlocTexteEcran>;

export const schemaBlocExtraits = z.strictObject({
  visageSurInstagram: z.boolean(),
  texteIncrusteAccepte: z.partialRecord(idCapacite, z.boolean()),
  dureeMinSec: z.number(),
  uneSourceParVideo: z.boolean(),
}) satisfies z.ZodType<BlocExtraits>;

export const schemaBlocHabillage = z.strictObject({
  partCoupesFranchesMin: z.number(),
  pleinCadrePermis: z.boolean(),
  fondsAnimes: z.boolean(),
  lumieres: z.boolean(),
}) satisfies z.ZodType<BlocHabillage>;

export const schemaBlocCalques = z.strictObject({
  texteDerriereMax: z.number(),
}) satisfies z.ZodType<BlocCalques>;

export const schemaProfilVideo = z.strictObject({
  id: z.string(),
  formatId: z.string(),
  version: z.number(),
  capacites: z.partialRecord(idCapacite, schemaRegleProfilCapacite),
  plafonds: z.strictObject({
    evenementsParMinute: z.number().optional(),
    transitionsMax: z.number().optional(),
    extraitsMax: z.number().optional(),
  }),
  memoire: z.strictObject({
    fenetreVideos: z.number(),
    portee: z.union([lit("format"), lit("globale")]),
  }),
  verrous: z.array(z.string()),
  blocs: z.strictObject({
    texteEcran: schemaBlocTexteEcran.optional(),
    extraits: schemaBlocExtraits.optional(),
    habillage: schemaBlocHabillage.optional(),
    calques: schemaBlocCalques.optional(),
  }).optional(),
}) satisfies z.ZodType<ProfilVideo>;

export const schemaChoix = z.strictObject({
  capacite: idCapacite,
  cle: z.string(),
  signature: z.string().optional(),
}) satisfies z.ZodType<Choix>;

export const schemaEntreeBibliotheque = z.strictObject({
  version: z.literal(VERSION_BIBLIOTHEQUE),
  profil: schemaProfilVideo,
  recents: z.array(z.strictObject({ capacite: idCapacite, cle: z.string(), videoId: z.string() })),
  graine: z.string(),
  figeeLe: z.string(),
  choix: z.array(schemaChoix).optional(),
}) satisfies z.ZodType<EntreeBibliotheque>;

/** Lit `entrees.bibliothequeVideo` ; absente ou illisible → `null`. Ne lève jamais ; rend une copie analysée. */
export function lireEntreeBibliotheque(entrees: unknown): EntreeBibliotheque | null {
  try {
    if (entrees === null || typeof entrees !== "object") return null;
    const brute = (entrees as Record<string, unknown>)[CLE_ENTREE_BIBLIOTHEQUE];
    if (brute === null || typeof brute !== "object") return null;
    const res = schemaEntreeBibliotheque.safeParse(brute);
    return res.success ? res.data : null;
  } catch {
    return null;
  }
}
