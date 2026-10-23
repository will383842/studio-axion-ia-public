/**
 * Bloc « Relevés » de la fiche d'une vidéo. Composant serveur : lit le suivi de CETTE vidéo (lecture seule). S'ajoute à
 * la fiche par une seule ligne : `<BlocReleves videoId={…} />`. Aucune erreur jusqu'à l'écran : au moindre doute, l'état vide.
 */
import { reglageAllume, REGLAGES_CAS_CONCRET } from "@/services/cas-concret-reglages";
import { suiviDesVideos, type LigneSuivi } from "@/services/cas-concret-suivi";
import { Releves } from "./Releves";

export async function BlocReleves({ videoId }: { videoId: string }) {
  // Réglage `casConcret.releves` éteint (par défaut) : pas de bloc.
  if (!(await reglageAllume(REGLAGES_CAS_CONCRET.releves))) return null;
  let lignes: LigneSuivi[] = [];
  try {
    lignes = (await suiviDesVideos({ videoId })).lignes;
  } catch {
    lignes = [];
  }
  return <Releves lignes={lignes} />;
}
