import { vueSurLeSite } from "@/services/site-videos";
import { CarteSurLeSite } from "./CarteSurLeSite";

/**
 * Bloc « Sur le site » de la fiche vidéo (lot S3). Absent tant que le type de vidéo n'est pas autorisé sur le site
 * (Réglages › Sur le site) : la fiche d'aujourd'hui ne change pas. Il ne dépend PAS de `ecranVideo.publication` : le cas
 * concret, sans onglet de publication, y a droit. Lecture seule, aucun appel au site.
 */
export async function BlocSurLeSite({ videoId }: { videoId: string }) {
  const vue = await vueSurLeSite(videoId);
  if (!vue.visible) return null;
  return <CarteSurLeSite vue={vue} />;
}
