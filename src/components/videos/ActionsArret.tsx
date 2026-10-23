import { EnTeteSuivi } from "@/components/fabrication/EnTeteSuivi";
import { ActionsSuivi } from "@/components/fabrication/ActionsSuivi";
import { BoutonAnnuler } from "@/components/videos/BoutonAnnuler";
import { BoutonReprendre } from "@/components/videos/BoutonReprendre";
import { FORMAT_CAS_CONCRET } from "@/components/formats/cas-concret/aiguillage";

/** Formats dont l'écran de dépôt ne sait pas rouvrir un brouillon (pas de lecture de `?brouillon=`) : on y recommence, on ne reprend pas. */
const ECRAN_SANS_REPRISE: Record<string, string> = {
  "facecam-animee": "/face-camera-animee",
  [FORMAT_CAS_CONCRET]: "/cas-concret",
};

/** Bloc « vidéo arrêtée » de la fiche : mots communs, « Reprendre » sauf pour les formats sans reprise (alors « Recommencer » vers leur écran). */
export function ActionsArret({ videoId, formatId, annulable }: { videoId: string; formatId: string; annulable: boolean }) {
  const ecran = ECRAN_SANS_REPRISE[formatId];
  return (
    <div className="space-y-4">
      <EnTeteSuivi etat="arretee" message={ecran ? "Vous pouvez recommencer cette vidéo." : undefined} />
      <ActionsSuivi etat="arretee" reprendre={ecran ? undefined : <BoutonReprendre videoId={videoId} formatId={formatId} />} recommencer={ecran ? { href: ecran } : undefined} annuler={annulable ? <BoutonAnnuler videoId={videoId} apres="/videos" /> : undefined} />
    </div>
  );
}
