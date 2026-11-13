/**
 * Demande de production (PURE, aucune écriture, aucun réseau) : ce que l'on demande à l'usine, sans aucune logique d'usine.
 * Une demande a un type (vidéo, carrousel ou infographie), un sujet, une date cible et au moins un réseau.
 */
import type { ReseauDeclinaison } from "@/domaine/types";

export const TYPES_DEMANDE = ["video", "carrousel", "infographie"] as const;
export type TypeDemande = (typeof TYPES_DEMANDE)[number];

export const RESEAUX_DEMANDE: readonly ReseauDeclinaison[] = ["tiktok", "instagram", "facebook", "linkedin", "youtube-shorts"];

export interface DemandeDeProduction {
  id: string;
  type: TypeDemande;
  sujet: string;
  /** Jour visé pour la publication (AAAA-MM-JJ). */
  dateCible: string;
  reseaux: readonly ReseauDeclinaison[];
}

const JOUR = /^\d{4}-\d{2}-\d{2}$/;

function jourValide(s: string): boolean {
  if (!JOUR.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Lit une demande ; `null` si un champ manque ou est invalide. Le sujet est rogné. */
export function lireDemande(brut: unknown): DemandeDeProduction | null {
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return null;
  const o = brut as Record<string, unknown>;
  const { id, type, sujet, dateCible, reseaux } = o;
  if (typeof id !== "string" || id.trim() === "") return null;
  if (typeof type !== "string" || !(TYPES_DEMANDE as readonly string[]).includes(type)) return null;
  if (typeof sujet !== "string" || sujet.trim() === "") return null;
  if (typeof dateCible !== "string" || !jourValide(dateCible)) return null;
  if (!Array.isArray(reseaux) || reseaux.length === 0) return null;
  if (!reseaux.every((r) => typeof r === "string" && (RESEAUX_DEMANDE as readonly string[]).includes(r))) return null;
  return { id, type: type as TypeDemande, sujet: sujet.trim(), dateCible, reseaux: [...new Set(reseaux as ReseauDeclinaison[])] };
}

/** Ordre de la file : date cible, puis identifiant. Ne modifie pas la liste reçue. */
export function ordreDeFile(demandes: readonly DemandeDeProduction[]): DemandeDeProduction[] {
  return [...demandes].sort((a, b) => (a.dateCible < b.dateCible ? -1 : a.dateCible > b.dateCible ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
