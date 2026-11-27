/**
 * Copie, pour les tests, du schéma de réception du site (`schemaVersion: 1`, `src/server/videos/contrat.ts` du dépôt du site, branche principale
 * au 2026-11-27) : objets stricts, bornes, thèmes fermés, et les règles croisées (chapitres, chemins de fichiers). Seule la liste
 * blanche des liens n'est pas reprise. À réaligner à la main si le site change son contrat.
 */
import { z } from "zod";

const slug = (max: number) => z.string().max(max).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const texte = (min: number, max: number) => z.string().min(min).max(max);
const base = { chemin: z.string().max(300), octets: z.number().int().positive() };
const image = z.object({ ...base, type: z.enum(["image/avif", "image/webp", "image/jpeg"]), largeur: z.number().int().positive(), hauteur: z.number().int().positive() }).strict();

const publicationBrute = z
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

export const schemaPublicationSite = publicationBrute.superRefine((v, ctx) => {
  if (v.dureeSecondes < 30 && v.chapitres.length > 0) ctx.addIssue({ code: "custom", path: ["chapitres"], message: "aucun chapitre sous 30 s" });
  for (let i = 0; i < v.chapitres.length; i++) {
    const precedent = i > 0 ? v.chapitres[i - 1]!.debutSecondes : -1;
    if (v.chapitres[i]!.debutSecondes >= v.dureeSecondes || v.chapitres[i]!.debutSecondes <= precedent) {
      ctx.addIssue({ code: "custom", path: ["chapitres"], message: "débuts strictement croissants et inférieurs à la durée" });
      break;
    }
  }
  const prefixe = `/medias/videos/${v.slug}/v${v.version}/`;
  for (const [nom, f] of Object.entries(v.fichiers)) {
    const reste = f.chemin.startsWith(prefixe) ? f.chemin.slice(prefixe.length) : null;
    if (reste === null || !/^[a-z0-9][a-z0-9._-]*$/.test(reste) || reste.includes("..")) ctx.addIssue({ code: "custom", path: ["fichiers", nom, "chemin"], message: `doit commencer par ${prefixe}` });
  }
});
