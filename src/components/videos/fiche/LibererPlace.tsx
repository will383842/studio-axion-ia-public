import { lireParametre } from "@/services/_commun";
import { BoutonLibererPlace } from "./BoutonLibererPlace";

/**
 * « Libérer la place » (G13-13), dans l'onglet Détails. Réglage `retoucheSegments.liberer` ÉTEINT par défaut :
 * éteint (absent, faux, lecture en échec), rien n'est rendu et la fiche ne change pas.
 */
export async function LibererPlace({ videoId }: { videoId: string }) {
  if ((await lireParametre<unknown>("retoucheSegments.liberer", false).catch(() => false)) !== true) return null;
  return (
    <section aria-labelledby={`liberer-${videoId}`} className="space-y-3">
      <h2 id={`liberer-${videoId}`} className="text-xs font-bold uppercase tracking-wider text-texte-faible">
        Libérer la place
      </h2>
      <BoutonLibererPlace videoId={videoId} />
    </section>
  );
}
