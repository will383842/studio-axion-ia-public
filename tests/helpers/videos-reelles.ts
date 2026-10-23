/**
 * CORRECTEUR FINAL A : les vidéos du jeu de démonstration servent de « vraies vidéos » aux tests de publication. Depuis
 * que l'essai se décide sur le moteur figé dans la version (et qu'une vidéo d'essai ou d'exemple ne part jamais chez
 * Buffer), il faut leur donner ce qu'une vraie fabrication laisse : le vrai moteur dans la version, un fichier sur le
 * stockage du studio (pas un fichier de démonstration) et, au besoin, `estDemo: false`.
 */
import type { Depots } from "@/domaine/depots";

export async function exemplesCommeVraies(d: Depots, options: { videos?: string[]; plusExemples?: boolean } = {}): Promise<void> {
  const cibles = await d.videos.lister((v) => !options.videos || options.videos.includes(v.id));
  for (const v of cibles) {
    if (options.plusExemples) await d.videos.modifier(v.id, { estDemo: false });
    for (const ver of await d.versions.lister((x) => x.videoId === v.id)) {
      if (!ver.commande.moteurId || ver.commande.moteurId === "simulation") await d.versions.modifier(ver.id, { commande: { ...ver.commande, moteurId: "montage-avocat" } });
    }
    for (const s of await d.sorties.lister((x) => x.videoId === v.id)) {
      const f = await d.fichiers.obtenir(s.fichierId);
      if (f && /^\/?demo\//.test(f.cleStockage)) await d.fichiers.modifier(f.id, { cleStockage: `studio/videos/${v.id}/${s.id}.mp4` });
    }
  }
}
