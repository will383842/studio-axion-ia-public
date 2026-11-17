/**
 * FACE CAMÉRA ANIMÉE v4 — ce que la version porte pour pouvoir être retouchée (G12-07a).
 * Fonction pure, non branchée : rien n'importe ce fichier. Elle ne rend jamais les clés déjà écrites par le moteur
 * (moteur, squelette, version, charte, plaquettes, essaisClaude) : aucun écrasement possible.
 * G12-07b : aussi les vidéos d'illustration préparées (`videos.fichiers`, `choix`) et le mémo du plan de scènes, pour qu'un re-rendu
 * ne repaie ni les vidéos ni l'IA (`chaine-v4.ts:672-678`). Jamais de montant.
 * Chaque clé n'est rendue que si la donnée existe ; tout est copié en profondeur (l'état n'est jamais muté ni partagé).
 */
import type { EtatChaineV4 } from "./chaine-v4";

export const CLES_PROJET_V4 = ["priseCle", "renduCle", "vignetteCle", "masterCle", "plan", "gardes", "cadrage", "transcription", "videos", "planScenes"] as const;

export function projetMontageV4(etat: EtatChaineV4): Record<string, unknown> {
  const sortie: Record<string, unknown> = {};
  const chaine = (v: unknown): v is string => typeof v === "string" && v.length > 0;
  if (chaine(etat.demande?.priseCle)) sortie.priseCle = etat.demande.priseCle;
  if (chaine(etat.rendu?.cle)) sortie.renduCle = etat.rendu.cle;
  if (chaine(etat.rendu?.vignetteCle)) sortie.vignetteCle = etat.rendu.vignetteCle;
  const master = (etat.rendu as { masterCle?: unknown } | undefined)?.masterCle;
  if (chaine(master)) sortie.masterCle = master;
  if (etat.realisation?.plan) sortie.plan = structuredClone(etat.realisation.plan);
  if (etat.coupes?.gardes) sortie.gardes = structuredClone(etat.coupes.gardes);
  if (etat.cadrage) sortie.cadrage = structuredClone(etat.cadrage);
  if (etat.transcription) sortie.transcription = structuredClone({ mots: etat.transcription.mots, dureeSec: etat.transcription.dureeSec });
  if (etat.videos?.fichiers?.length) {
    sortie.videos = structuredClone({ fichiers: etat.videos.fichiers, ...(etat.videos.choix?.length ? { choix: etat.videos.choix } : {}) });
  }
  if (etat.planScenes) sortie.planScenes = structuredClone(etat.planScenes);
  return sortie;
}
