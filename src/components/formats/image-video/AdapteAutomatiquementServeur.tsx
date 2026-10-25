/** IMAGE → VIDÉO · R5 · Lit l'état gardé de la fabrication et montre le bloc « Adapté automatiquement » ; jamais d'exception. */
import { etatDuTravail, travailImageVideo } from "@/services/image-video-carte";
import { BlocAdapteAutomatiquement, phrasesAdaptees } from "./AdapteAutomatiquement";

export async function AdapteAutomatiquementServeur({ videoId }: { videoId: string }) {
  try {
    const etat = etatDuTravail(await travailImageVideo(videoId));
    const carte = etat?.carte?.carte ?? etat?.propositionCarte?.carte;
    return <BlocAdapteAutomatiquement phrases={phrasesAdaptees(carte)} />;
  } catch {
    return null;
  }
}
