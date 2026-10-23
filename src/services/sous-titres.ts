/**
 * SOUS-TITRES D'UNE VIDÉO (lot M2, décision de Will du 01/10) : toucher un groupe pour le changer, données du calque.
 * Chaque changement crée une NOUVELLE version des sous-titres (l'ancienne est gardée) ; le groupe touché est
 * VERROUILLÉ (le moteur ne le réécrit jamais). Seul le calque texte change : gratuit, aucune voix ni visage refait
 * (le recalque de la vidéo elle-même est au lot M4).
 */
import "server-only";
import type { Id, SousTitres } from "@/domaine/types";
import { appliquerChoixGroupe, baseRetenue, donneesCalque, type ChoixGroupe, type DonneesCalque } from "@/briques/sous-titres";
import { obtenirFormat } from "@/formats";
import { nouvelId } from "@/lib/ids";
import { depots, ErreurStudio, horodatage, journaliser } from "./_commun";
import { exigerSession } from "./auth";
import { sousTitresCourants } from "./videos";

const CHOIX: readonly ChoixGroupe[] = ["base", "impact", "bandeau", "souligner", "plus-gros", "plus-petit", "monter", "descendre"];

/** Toucher un groupe : Base, Impact, Bandeau, Souligner, Plus gros, Plus petit, Monter, Descendre. */
export async function changerGroupeSousTitres(videoId: Id, segmentId: string, choix: ChoixGroupe, motIndex?: number): Promise<SousTitres> {
  await exigerSession();
  if (!CHOIX.includes(choix)) throw new ErreurStudio("VALEUR_INVALIDE", "Ce choix n'existe pas.");
  const d = depots();
  const v = await d.videos.obtenir(videoId);
  const st = v?.versionChoisieId ? await sousTitresCourants(v.versionChoisieId) : null;
  if (!v || !st) throw new ErreurStudio("INTROUVABLE", "Pas de sous-titres pour cette vidéo.");
  if (!st.segments.some((s) => s.id === segmentId)) throw new ErreurStudio("INTROUVABLE", "Ce passage n'existe plus.");
  const segments = appliquerChoixGroupe(st.segments, segmentId, choix, motIndex);
  const nouveau: SousTitres = { ...st, id: nouvelId("st"), segments, version: st.version + 1, ...horodatage() };
  await d.sousTitres.enregistrer(nouveau);
  await journaliser("sous-titres", `Sous-titres modifiés : « ${v.titre} »`, { type: "video", id: videoId });
  return nouveau;
}

/** Données du calque de rendu des sous-titres COURANTS d'une version (aperçu synchronisé, recalque du lot M4). */
export async function donneesCalqueVersion(versionId: Id): Promise<DonneesCalque | null> {
  const d = depots();
  const version = await d.versions.obtenir(versionId);
  const st = await sousTitresCourants(versionId);
  if (!version || !st) return null;
  const commande = version.commande;
  const marque = (await d.marques.lister(() => true))[0] ?? null;
  const style = commande.styles.sousTitres?.valeur ?? null;
  return donneesCalque({
    segments: st.segments,
    base: commande.sousTitres?.base ?? baseRetenue(undefined, style),
    style,
    marque,
    reseaux: obtenirFormat(commande.formatId).reseauxConseilles,
  });
}
