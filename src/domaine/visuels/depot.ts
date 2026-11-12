import { z } from "zod";
import type { Visuel } from "./visuel";

/** Dépôt de texte et adresses : fonctions pures, sans directive client, partageables entre écran et serveur. */

/** Taille maximale d'un texte écrit en session déposé ici : 64 Ko. */
export const TAILLE_MAX_DEPOT_OCTETS = 64 * 1024;

export type VerdictDepot = { ok: true } | { ok: false; message: string };

/** Contrôle d'un dépôt (texte collé ou fichier lu) : non vide, 64 Ko au plus (en octets, pas en caractères). */
export function verifierDepotTexte(contenu: string): VerdictDepot {
  if (contenu.trim() === "") return { ok: false, message: "Le texte déposé est vide." };
  if (new TextEncoder().encode(contenu).length > TAILLE_MAX_DEPOT_OCTETS) return { ok: false, message: "Le texte dépasse 64 Ko : déposez-en un plus court." };
  return { ok: true };
}

/** N'accepte qu'un chemin du site (`/…`, pas `//` ni `/\`), sans caractère de contrôle, ou une adresse `https:` ; sinon undefined (ni lien ni image). */
export function urlSure(u: string | undefined): string | undefined {
  if (!u) return undefined;
  if (/[\u0000-\u001f\u007f]/.test(u)) return undefined;
  if (/^\/(?![\/\\])/.test(u)) return u;
  return u.startsWith("https:") ? u : undefined;
}

/** Nom du PDF téléchargé : titre sans accents ni signes (lettres, chiffres et tirets), 80 signes au plus, + « .pdf ». */
export function nomFichierPdf(titre: string): string {
  const propre = titre
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return `${propre || "carrousel"}.pdf`;
}

// --- Lecture d'un visuel gardé (L1-02) : zod seul, rien de lourd, car ce fichier est aussi lu côté écran. ---

const FichierStocke = z.object({ cle: z.string().min(1), mesures: z.record(z.string(), z.number()) }).strict();
/** Version rendue par cadre, gardée avec le visuel : relue après un redémarrage, elle évite un nouveau rendu. */
export const VersionStockee = z
  .object({
    cadre: z.enum(["linkedin", "meta"]),
    empreinte: z.string().regex(/^[0-9a-f]{64}$/),
    pages: z.array(z.object({ index: z.number().int().min(0), x1: FichierStocke, x2: FichierStocke.optional() }).strict()),
    pdfCle: z.string().min(1).nullable(),
    vignetteCle: z.string().min(1),
    reseaux: z.array(z.enum(["linkedin", "instagram", "facebook"])).optional(),
  })
  .strict();
export type VersionStockee = z.infer<typeof VersionStockee>;
export const VersionsStockees = z.array(VersionStockee);

const ClassementStocke = z
  .object({
    famille: z.enum(["carrousel", "carrousel-continu", "infographie"]),
    reseaux: z.array(z.enum(["linkedin", "instagram", "facebook"])).optional(),
    sousType: z.string().trim().min(1).max(40).optional(),
    versions: VersionsStockees.optional(),
  })
  .passthrough();

/**
 * Lit un visuel gardé. Un ancien visuel (sans réseaux, sous-type ni versions) se lit tel quel ; un visuel classé est relu à l'identique.
 * Lève si la famille, un réseau ou une version est invalide. Les champs inconnus sont conservés.
 */
export function lireVisuelStocke(brut: unknown): Visuel {
  if (typeof brut !== "object" || brut === null || typeof (brut as { id?: unknown }).id !== "string") throw new Error("Visuel illisible : identifiant absent");
  return ClassementStocke.parse(brut) as unknown as Visuel;
}
