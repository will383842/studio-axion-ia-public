/**
 * FIXTURE : COPIE du schéma strict du site (`axion-ia` main, src/server/guides-reseau/contrat.ts, `SchemaDemandeGuideReseau`),
 * recopiée à la main pour valider, sans réseau, que le corps du Studio est accepté. À re-synchroniser si le site change.
 * Les deux listes importées du site (`src/content/guides-reseau.ts`) sont recopiées ci-dessous.
 */
import { z } from "zod";

export const GUIDES_RESEAU_CONNUS_SITE: readonly string[] = ["guide-ia"];
export const RESEAUX_GUIDE_SITE = ["instagram", "facebook", "linkedin_page", "tiktok", "page_guide"] as const;

const VERSION = /^[A-Za-z0-9._-]{3,64}$/;

export const SchemaDemandeGuideReseau = z
  .object({
    schemaVersion: z.literal(1),
    /** Identifiant du run Zernio : clé d'idempotence. */
    cleIdempotence: z.string().regex(/^[A-Za-z0-9_-]{8,80}$/),
    email: z
      .string()
      .trim()
      .max(254)
      .email()
      .transform((e) => e.toLowerCase()),
    /** Mot-clé du commentaire : lettres (accentuées) et chiffres Unicode, 2 à 30, en MAJUSCULES. */
    mot: z
      .string()
      .trim()
      .regex(/^[\p{L}\p{N}]{2,30}$/u)
      .transform((m) => m.toLocaleUpperCase("fr")),
    reseau: z.enum(RESEAUX_GUIDE_SITE),
    guide: z
      .string()
      .regex(/^[a-z0-9-]{2,40}$/)
      .refine((g) => GUIDES_RESEAU_CONNUS_SITE.includes(g), "guide_inconnu"),
    /**
     * `accord` : CHAMP FACULTATIF (hérité). Le Studio ne l'envoie plus (décision du 03/11/2026 : aucune question d'accord) ;
     * le site doit accepter son absence. À re-synchroniser avec le schéma réel du site.
     */
    accord: z.enum(["oui", "non", "non_demande"]).optional(),
    /** Version du texte du premier message privé (M1) — preuve d'information. */
    versionTexteM1: z.string().regex(VERSION),
    /** Version de la question « conseils par e-mail » (M2) — obligatoire si « oui ». */
    versionTexteM2: z.string().regex(VERSION).optional(),
    locale: z.enum(["fr", "en"]).default("fr"),
    /** Moment de la réponse dans la conversation (ISO 8601). */
    occurredAt: z.string().datetime().optional(),
  })
  .strict()
  .refine((d) => d.accord !== "oui" || d.versionTexteM2 !== undefined, {
    message: "versionTexteM2_requise",
    path: ["versionTexteM2"],
  });

/**
 * COPIE du schéma strict de la route d'opposition du site (`POST /api/interne/oppositions-reseau`) : corps strict, adresse
 * OBLIGATOIRE (le Studio n'en garde aucune : il relit le message chez Zernio, en mémoire). À re-synchroniser si le site change.
 */
export const SchemaOppositionReseau = z
  .object({
    schemaVersion: z.literal(1),
    cleIdempotence: z.string().regex(/^[A-Za-z0-9_-]{8,80}$/),
    email: z
      .string()
      .trim()
      .max(254)
      .email()
      .transform((e) => e.toLowerCase()),
    motif: z.literal("stop"),
    reseau: z.enum(RESEAUX_GUIDE_SITE),
    occurredAt: z.string().datetime().optional(),
  })
  .strict();
