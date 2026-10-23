/** LIENS PRIVÉS (B.8 #9, #10). resoudrePartage est PUBLIC (page /v/[code]). */
import "server-only";
import type { Id, Partage } from "@/domaine/types";
import { codePartage, nouvelId } from "@/lib/ids";
import { depots, ErreurStudio, horodatage, journaliser, lireParametre } from "./_commun";
import { exigerSession } from "./auth";
import { urlFichier } from "./fichiers";

export async function creerPartage(videoId: Id, options: { dureeJours: number | null; telechargementAutorise: boolean; sortieId?: Id }): Promise<Partage & { chemin: string }> {
  await exigerSession();
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  if (!video || video.statut !== "prete") throw new ErreurStudio("PAS_PRETE", "La vidéo n'est pas prête.");
  const sortie = options.sortieId ? await d.sorties.obtenir(options.sortieId) : await d.sorties.trouver((s) => s.versionId === video.versionChoisieId);
  const partage: Partage = {
    id: nouvelId("par"),
    videoId,
    code: codePartage(),
    sortieId: sortie?.id,
    expireLe: options.dureeJours ? new Date(Date.now() + options.dureeJours * 86400000).toISOString() : undefined,
    vues: 0,
    telechargementAutorise: options.telechargementAutorise,
    ...horodatage(),
  };
  await d.partages.enregistrer(partage);
  await journaliser("partage", `Lien privé créé pour « ${video.titre} »`, { type: "video", id: videoId });
  return { ...partage, chemin: `/v/${partage.code}` };
}

export async function listerPartages(videoId: Id): Promise<(Partage & { chemin: string; actif: boolean })[]> {
  const liste = await depots().partages.lister((p) => p.videoId === videoId);
  const now = new Date();
  return liste
    .sort((a, b) => b.creeLe.localeCompare(a.creeLe))
    .map((p) => ({ ...p, chemin: `/v/${p.code}`, actif: !p.revoqueLe && (!p.expireLe || new Date(p.expireLe) > now) }));
}

export async function revoquerPartage(id: Id): Promise<void> {
  await exigerSession();
  await depots().partages.modifier(id, { revoqueLe: new Date().toISOString() });
  await journaliser("partage", "Lien privé révoqué");
}

/** Codes des liens privés d'une vidéo supprimée (décision du 17/10) : `/v/<code>` répond 410 (lien inactif), pas 404. */
export const CLE_CODES_SUPPRIMES = "partages.codesSupprimes";

export type EtatPartage =
  | { etat: "ok"; titre: string; video: string; vignette: string | null; ratio: string; telechargement: boolean; dureeSec: number }
  | { etat: "expire" | "revoque" | "introuvable" };

/** PUBLIC : résout un code de partage et compte une vue. Aucune session exigée. */
export async function resoudrePartage(code: string, options: { compterVue?: boolean } = {}): Promise<EtatPartage> {
  if (!/^[a-z0-9]{6,16}$/.test(code)) return { etat: "introuvable" };
  const d = depots();
  const p = await d.partages.trouver((x) => x.code === code);
  // Lien d'une vidéo supprimée par Will (17/10) : « plus actif » (410), comme un lien révoqué.
  if (!p) return (await lireParametre<string[]>(CLE_CODES_SUPPRIMES, [])).includes(code) ? { etat: "revoque" } : { etat: "introuvable" };
  if (p.revoqueLe) return { etat: "revoque" };
  if (p.expireLe && new Date(p.expireLe) < new Date()) return { etat: "expire" };
  const video = await d.videos.obtenir(p.videoId);
  const sortie = p.sortieId ? await d.sorties.obtenir(p.sortieId) : await d.sorties.trouver((s) => s.versionId === video?.versionChoisieId);
  if (!video || !sortie) return { etat: "introuvable" };
  // Vidéo à la corbeille : lien inactif (410) ; la restauration le réactive.
  if (video.corbeilleLe) return { etat: "revoque" };
  if (options.compterVue !== false) await d.partages.modifier(p.id, { vues: p.vues + 1 });
  // Même règle que les cartes : la miniature choisie d'abord (si elle est au format de la vidéo partagée).
  const miniature = video.miniatureChoisieId ? await d.miniatures.obtenir(video.miniatureChoisieId) : null;
  const vignetteMiniature = miniature && (!miniature.ratio || miniature.ratio === sortie.ratio) ? await urlFichier(miniature.fichierId) : null;
  return {
    etat: "ok",
    titre: video.titre,
    video: (await urlFichier(sortie.fichierId)) ?? "",
    vignette: vignetteMiniature ?? (await urlFichier(sortie.vignetteFichierId)),
    ratio: sortie.ratio,
    telechargement: p.telechargementAutorise,
    dureeSec: sortie.dureeSec,
  };
}
