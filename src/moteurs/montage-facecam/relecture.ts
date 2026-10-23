/**
 * RELECTURE CLAUDE APPLIQUÉE (plan v4 B.24, lot G) — PUR.
 *
 * Relecture CIBLÉE de la vidéo finie : une image à chaque raccord, au milieu de chaque carte et de chaque écran
 * partagé, aux 3 premières secondes et sur la dernière image (images extraites de la vidéo composée par le
 * `studio-aligneur`). UN appel Claude ; la première correction proposée (une seule) est convertie en opération du
 * monteur et appliquée par la retouche (on ne refait que ce qu'elle touche). Jamais de seconde relecture.
 */
import type { EntreesFacecam } from "@/domaine/facecam";
import { lireEntreesFacecam } from "@/domaine/facecam";
import { appliquerOperations, lireReglagesMonteur, type EtatMonteur, type PassageMonteur } from "./monteur/appliquer";
import type { OperationFacecam } from "./monteur/operations";
import type { SortieRelecture } from "./monteur/role";
import { coupesActives, motsPourMonteur } from "./monteur/temps";
import type { MotHorodate } from "@/domaine/types";

/** Images au plus par relecture (le rôle en accepte 40). */
export const IMAGES_RELECTURE_MAX = 24;

export interface InstantControle {
  /** Nom de l'image (clé du dépôt). */
  nom: string;
  instantSec: number;
  legende: string;
  /** Élément contrôlé (carte, écran partagé) ; null : raccord, début ou fin. */
  elementId: string | null;
}

const horloge = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/**
 * Instants à relire : les 3 premières secondes, chaque carte et chaque écran partagé (au milieu), chaque raccord (juste
 * après), la dernière image. Au-delà de `max`, les raccords sont pris à intervalles réguliers (les autres restent tous).
 */
export function instantsDeControle(e: { dureeSec: number; raccordsSec: number[]; cartes: { id: string; debutSec: number; finSec: number; ecranPartage: boolean }[] }, max = IMAGES_RELECTURE_MAX): InstantControle[] {
  const d = Math.max(0.2, e.dureeSec);
  const dans = (t: number) => Math.min(Math.max(0, t), Math.max(0, d - 0.04));
  const debut: InstantControle[] = [0.5, 1.5, 2.5].filter((t) => t < d).map((t) => ({ nom: "", instantSec: dans(t), legende: `Début de la vidéo (${t.toLocaleString("fr-FR")} s)`, elementId: null }));
  const fin: InstantControle = { nom: "", instantSec: dans(d - 0.04), legende: "Dernière image", elementId: null };
  const cartes: InstantControle[] = e.cartes.map((c) => ({ nom: "", instantSec: dans((c.debutSec + c.finSec) / 2), legende: `${c.ecranPartage ? "Écran partagé" : "Carte"} à ${horloge(c.debutSec)}`, elementId: c.id }));
  let raccords: InstantControle[] = e.raccordsSec.filter((t) => t > 0.1 && t < d - 0.1).map((t, i) => ({ nom: "", instantSec: dans(t + 0.08), legende: `Raccord ${i + 1} à ${horloge(t)}`, elementId: null }));
  const place = Math.max(0, max - debut.length - 1 - cartes.length);
  if (raccords.length > place) {
    const pas = raccords.length / Math.max(1, place);
    raccords = Array.from({ length: place }, (_, i) => raccords[Math.floor(i * pas)]);
  }
  return [...debut, ...cartes.slice(0, Math.max(0, max - debut.length - 1)), ...raccords, fin]
    .sort((a, b) => a.instantSec - b.instantSec)
    .map((x, i) => ({ ...x, nom: `controle-${String(i + 1).padStart(2, "0")}` }));
}

export interface ResultatRelecture {
  /** Défauts vus (journal, « Votre vidéo »). */
  defauts: SortieRelecture["defauts"];
  /** Entrées corrigées (`facecam` + `facecamMonteur`) ; absentes : rien à corriger. */
  entrees?: Record<string, unknown>;
  /** La correction appliquée, en une phrase. */
  correction?: string;
}

const DETOURAGE = new Set<OperationFacecam["type"]>(["masquerPersonne", "texteDerriere"]);

/**
 * Applique la relecture aux entrées : bords de détourage ratés → variante sans détourage ; puis LA première correction
 * utilisable (une seule, jamais d'effet à détourage décidé seul). Ne lève jamais : une correction inapplicable est
 * ignorée (la vidéo est livrée telle quelle).
 */
export function appliquerRelecture(entrees: Record<string, unknown>, sortie: SortieRelecture | null, ctx: { mots: MotHorodate[]; dureePriseSec: number; nouvelId: (p: string) => string }): ResultatRelecture {
  if (!sortie || sortie.ok) return { defauts: sortie?.defauts ?? [] };
  const facecam: EntreesFacecam = lireEntreesFacecam(entrees);
  let etat: EtatMonteur = { facecam, reglages: lireReglagesMonteur(entrees) };
  const phrases: string[] = [];
  const rates = new Set(sortie.defauts.filter((x) => x.defaut === "bords-detourage" && x.elementId).map((x) => x.elementId!));
  if (rates.size) {
    const touches = etat.facecam.passages.filter((p) => rates.has(p.id) && (p as PassageMonteur).detourage);
    if (touches.length) {
      etat = { ...etat, facecam: { ...etat.facecam, passages: etat.facecam.passages.map((p) => (rates.has(p.id) && (p as PassageMonteur).detourage ? { ...p, sansDetourage: true } : p)) } };
      phrases.push("Effet sans détourage (bords ratés)");
    }
  }
  const mots = motsPourMonteur(ctx.mots, coupesActives(etat.facecam, etat.reglages.coupesDemandees));
  for (const op of sortie.corrections) {
    if (DETOURAGE.has(op.type)) continue;
    try {
      const r = appliquerOperations(etat, [op], { mots, dureePriseSec: ctx.dureePriseSec, origine: "auto", nouvelId: ctx.nouvelId });
      if (!r.appliquees.length) continue;
      etat = r.etat;
      phrases.push(resumeCorrection(op));
      break;
    } catch {
      continue;
    }
  }
  if (!phrases.length) return { defauts: sortie.defauts };
  return { defauts: sortie.defauts, entrees: { ...entrees, facecam: etat.facecam, facecamMonteur: etat.reglages }, correction: phrases.join(" ; ") };
}

function resumeCorrection(op: OperationFacecam): string {
  if (op.type === "retirer") return "Élément retiré après relecture";
  if (op.type === "couper") return "Passage coupé après relecture";
  if (op.type === "retablir") return "Passage rétabli après relecture";
  return "Élément corrigé après relecture";
}
