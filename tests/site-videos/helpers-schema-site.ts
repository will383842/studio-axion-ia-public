/** Copie, pour les tests, du schéma strict de réception du site (`schemaVersion: 1`) : sans la liste blanche des liens ni la liste des thèmes. */
import { z } from "zod";

const slug = (max: number) => z.string().max(max).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const texte = (min: number, max: number) => z.string().min(min).max(max);
const base = { chemin: z.string().max(300), octets: z.number().int().positive() };
const image = z.object({ ...base, type: z.enum(["image/avif", "image/webp", "image/jpeg"]), largeur: z.number().int().positive(), hauteur: z.number().int().positive() }).strict();

export const schemaPublicationSite = z
  .object({
    schemaVersion: z.literal(1),
    studioVideoId: z.string().regex(/^[a-z0-9_-]{8,64}$/),
    version: z.number().int().min(1),
    slug: slug(80),
    langue: z.literal("fr"),
    titre: texte(20, 100),
    description: texte(80, 300),
    resume: texte(400, 1500),
    aRetenir: z.array(texte(20, 200)).length(3),
    questions: z.array(z.object({ question: texte(10, 160), reponse: texte(40, 600) }).strict()).min(2).max(3),
    theme: z.enum(["formations-ia", "coaching-ia", "audit-ia", "automatisation", "sites-web-ia"]),
    serie: z.object({ slug: slug(80), titre: texte(3, 120), rang: z.number().int().min(1) }).strict().nullable(),
    lien: z.object({ type: z.enum(["service", "formation"]), chemin: z.string().max(200).regex(/^\/fr(\/[a-z0-9-]+)+$/) }).strict(),
    dureeSecondes: z.number().int().min(5).max(3600),
    chapitres: z.array(z.object({ titre: texte(2, 120), debutSecondes: z.number().int().min(0) }).strict()),
    fichiers: z
      .object({
        video: z.object({ ...base, type: z.literal("video/mp4"), sha256: z.string().regex(/^[0-9a-f]{64}$/), largeur: z.number().int().positive(), hauteur: z.number().int().positive() }).strict(),
        affiche169: image,
        vignette43: image,
        vignette11: image,
        sousTitres: z.object({ ...base, type: z.literal("text/vtt") }).strict(),
      })
      .strict(),
    transcription: z.string().min(1).max(100_000).nullable(),
    ia: z.object({ voixGeneree: z.boolean(), doubleNumerique: z.boolean() }).strict(),
    personnesALImage: z.object({ williams: z.boolean() }).strict(),
    attestations: z.object({ aucunNomNiLogoDeClient: z.literal(true) }).strict(),
  })
  .strict();
