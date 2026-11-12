/**
 * PREMIÈRE SECONDE (GV-VG-03) — après chaque fabrication : écrit les alertes « Première seconde : … » dans la carte
 * « Qualité » de la vidéo. Jamais d'échec : aucun statut changé, `globale` intacte, aucun appel payant, erreurs avalées.
 */
import "server-only";
import type { Id } from "@/domaine/types";
import { controlerPremiereSeconde, PREFIXE } from "@/domaine/premiere-seconde";
import { obtenirFormat } from "@/formats";
import { depots } from "./_commun";

export async function controlerPremiereSecondeVideo(videoId: Id): Promise<void> {
  try {
    const d = depots();
    const video = await d.videos.obtenir(videoId);
    if (!video || video.estDemo || !video.versionChoisieId || !video.noteQualite) return;
    const liste = await d.sousTitres.lister((s) => s.versionId === video.versionChoisieId);
    const courants = [...liste].sort((a, b) => b.version - a.version || b.creeLe.localeCompare(a.creeLe))[0];
    const encadre = obtenirFormat(video.formatId).accrocheVisuelle?.encadreOuverture;
    const nouvelles = controlerPremiereSeconde({ segments: courants?.segments ?? [], encadre: encadre ? { de: encadre.de, a: encadre.a } : null });
    const anciennes = video.noteQualite.alertes;
    const gardees = anciennes.filter((a) => !a.message.startsWith(PREFIXE));
    if (!nouvelles.length && gardees.length === anciennes.length) return;
    await d.videos.modifier(videoId, { noteQualite: { ...video.noteQualite, alertes: [...gardees, ...nouvelles] } });
  } catch (e) {
    console.warn("[studio] contrôle de la première seconde ignoré", e instanceof Error ? e.name : "erreur");
  }
}
