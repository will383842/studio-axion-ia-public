/**
 * L3-01 · adaptateurs vers ContenuSource. PUR, aucun appel réel.
 */
import type { CarrouselSpecType } from "@/domaine/visuels/types";
import { ContenuSource, texteDesPages, verifierFaits, type ContenuSourceType } from "./contenu-source";

export type ResultatContenu = { ok: true; contenu: ContenuSourceType } | { ok: false; refus: string[] };

/** Carrousel → contenu source. Un fait annoncé qui n'est dans aucune page est refusé (rien n'est inventé). */
export function contenuDepuisCarrousel(d: { titre: string; spec: CarrouselSpecType; reseaux?: string[]; faits?: readonly string[] }): ResultatContenu {
  const texte = texteDesPages(d.spec);
  const absents = verifierFaits(texte, d.faits ?? []);
  if (absents.length > 0) return { ok: false, refus: absents };
  const contenu = ContenuSource.parse({ origine: "carrousel", titre: d.titre, texteValide: texte, pages: d.spec.pages.length, ...(d.reseaux ? { reseaux: d.reseaux } : {}) });
  return { ok: true, contenu };
}

/** Vidéo importée + sa phrase de description → contenu source (la description est le texte validé). */
export function contenuDepuisVideoImportee(d: { titre: string; description: string; dureeSec?: number; reseaux?: string[] }): ContenuSourceType {
  return ContenuSource.parse({
    origine: "video-importee",
    titre: d.titre,
    texteValide: d.description,
    ...(d.dureeSec !== undefined ? { dureeSec: d.dureeSec } : {}),
    ...(d.reseaux ? { reseaux: d.reseaux } : {}),
  });
}
