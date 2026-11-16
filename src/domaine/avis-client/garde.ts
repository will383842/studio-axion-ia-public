import type { AvisClient } from "./types";

export interface RefusAvis { id: string; motif: string }

function motifRefus(a: AvisClient): string | null {
  if (a.exemple === true) return "avis d'exemple, jamais affiché";
  if (a.statut !== "published") return `statut « ${a.statut} » : seul « published » est affichable`;
  if (a.accordAuteur?.ecrit !== true) return "pas d'accord écrit de l'auteur";
  if (typeof a.texte !== "string" || a.texte.trim() === "") return "texte vide";
  if (!Number.isInteger(a.note) || a.note < 1 || a.note > 5) return "note invalide (entier de 1 à 5 attendu)";
  if (typeof a.date !== "string" || a.date.trim() === "" || Number.isNaN(Date.parse(a.date))) return "date invalide";
  return null;
}

/** Garde les avis affichables. Aucun tri, aucun filtre par note : l'ordre d'entrée est conservé. */
export function avisAffichables(liste: AvisClient[]): { gardes: AvisClient[]; refus: RefusAvis[] } {
  const gardes: AvisClient[] = [];
  const refus: RefusAvis[] = [];
  for (const a of liste) {
    const m = motifRefus(a);
    if (m === null) gardes.push(a);
    else refus.push({ id: a.id, motif: m });
  }
  return { gardes, refus };
}
