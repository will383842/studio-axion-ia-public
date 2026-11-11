/**
 * L3-01 · contrat ContenuSource. PUR.
 *
 * Ce que le rôle de publication reçoit comme « texte validé » : la seule source des faits. Un carrousel ou une vidéo
 * importée s'y ramène par un adaptateur (`adaptateurs.ts`) ; aucun appel réel, aucun prix.
 */
import { z } from "zod";
import { normaliser } from "@/domaine/controles-script/texte";
import type { CarrouselSpecType } from "@/domaine/visuels/types";

export const ORIGINES_CONTENU = ["carrousel", "video-importee"] as const;
export type OrigineContenu = (typeof ORIGINES_CONTENU)[number];

export const ContenuSource = z
  .object({
    origine: z.enum(ORIGINES_CONTENU),
    titre: z.string().trim().min(1).max(200),
    /** Texte validé : la SEULE source des faits d'un post. */
    texteValide: z.string().trim().min(1),
    /** Réseaux visés (identifiants), s'ils sont connus. */
    reseaux: z.array(z.string()).optional(),
    /** Durée de la vidéo, en secondes (vidéo importée). */
    dureeSec: z.number().positive().optional(),
    /** Nombre de pages du support (carrousel). */
    pages: z.number().int().positive().optional(),
  })
  .strict();
export type ContenuSourceType = z.infer<typeof ContenuSource>;

/** Clés de page qui ne portent pas de texte lu. */
const CLES_SANS_TEXTE = new Set(["type", "icone", "deco", "variante"]);

function chaines(v: unknown, sortie: string[]): void {
  if (typeof v === "string") sortie.push(v);
  else if (Array.isArray(v)) v.forEach((x) => chaines(x, sortie));
  else if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) if (!CLES_SANS_TEXTE.has(k)) chaines(x, sortie);
  }
}

/** Tout le texte lu des pages, une ligne par texte, dans l'ordre des pages. */
export function texteDesPages(spec: CarrouselSpecType): string {
  const lignes: string[] = [];
  for (const page of spec.pages) chaines(page, lignes);
  return lignes.map((l) => l.trim()).filter(Boolean).join("\n");
}

/** Faits (phrases, chiffres) qu'on ne retrouve pas dans le texte, bornes de mot comprises (« 80 » n'est pas dans « 180 ») : la liste vide veut dire « tout est présent ». */
export function verifierFaits(texte: string, faits: readonly string[]): string[] {
  const base = normaliser(texte);
  return faits.filter((f) => {
    const n = normaliser(f);
    if (n.length === 0) return false;
    const echappe = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return !new RegExp(`(^|[^\\p{L}\\p{N}])${echappe}([^\\p{L}\\p{N}]|$)`, "u").test(base);
  });
}
