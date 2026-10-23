import Link from "next/link";
import type { ReactNode } from "react";
import type { EtatSuivi } from "@/components/creation/SuiviFabrication";
import { ACTIONS_FABRICATION } from "@/domaine/libelles";

/**
 * Actions d'un suivi, dans un ordre fixe pour tous les formats :
 * pendant la fabrication [Passer devant ?] [Arrêter] [Annuler] ; après un arrêt [Reprendre, principal] [actions propres au format] [Annuler] [Recommencer, lien].
 * « Annuler » (`BoutonAnnuler`) met la vidéo à la corbeille ; partout où il y a Reprendre, il y a Annuler.
 * Les boutons viennent du format (ils portent ses actions serveur) ; ce composant ne fait que les ranger.
 */
export function ActionsSuivi({
  etat,
  passerDevant,
  arreter,
  reprendre,
  propres,
  annuler,
  recommencer,
}: {
  etat: EtatSuivi;
  passerDevant?: ReactNode;
  arreter?: ReactNode;
  reprendre?: ReactNode;
  propres?: ReactNode;
  annuler?: ReactNode;
  recommencer?: { href: string; libelle?: string };
}) {
  const pendant = etat === "en-cours";
  const enfants = pendant ? [passerDevant, arreter, annuler] : [reprendre, propres, etat === "prete" ? undefined : annuler];
  const lien = !pendant && recommencer;
  if (!enfants.some(Boolean) && !lien) return null;
  return (
    <div data-actions={pendant ? "pendant" : "apres"} className="flex flex-wrap items-center justify-end gap-2">
      {enfants.map((e, i) => e && <span key={i} className="contents">{e}</span>)}
      {lien && (
        <Link href={lien.href} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-orange-vif underline-offset-2 hover:underline">
          {lien.libelle ?? ACTIONS_FABRICATION.recommencer}
        </Link>
      )}
    </div>
  );
}
