"use client";

/**
 * « Retirer du calendrier » dans le panneau d'aperçu : geste secondaire en trois temps (bouton, confirmation, résultat).
 * Rien ne part d'ici ; l'action serveur efface seulement les lignes prévues du Studio.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { retirerDuCalendrier } from "@/app/(studio)/calendrier/actions/retirer";
import { cn } from "@/lib/cn";
import { LIBELLES_CALENDRIER } from "./EnTeteCalendrier";

const BOUTON = "min-h-[38px] rounded-[10px] border border-trait-fort bg-surface-2 px-3 py-1.5 text-sm font-bold text-texte hover:bg-surface-3";

/** Le routeur de l'application ; hors application (rendu de test), `null` : on recharge la page. */
function useRouteurOuNul() {
  try {
    return useRouter();
  } catch {
    return null;
  }
}

export const PHRASE_CONFIRMATION_RETRAIT =
  "Retirer ce carrousel du calendrier ? Ses publications prévues sur tous les réseaux seront retirées. Rien n'est encore parti. Le carrousel reste dans vos carrousels : vous pourrez le programmer de nouveau.";

export function RetirerDuCalendrier({ cle }: { cle: string }) {
  const routeur = useRouteurOuNul();
  const [etape, setEtape] = useState<"repos" | "confirmation" | "fait">("repos");
  const [enCours, setEnCours] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);

  async function confirmer() {
    if (enCours) return;
    setEnCours(true);
    setRefus(null);
    try {
      const r = await retirerDuCalendrier(cle, "retirer");
      if (r.ok) {
        setEtape("fait");
        if (routeur) routeur.refresh();
        else window.location.reload();
      } else setRefus(r.message);
    } catch {
      setRefus("Le retrait n'a pas pu être fait. Réessayez.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="mt-6 border-t border-trait pt-3">
      {etape === "repos" && (
        <button type="button" onClick={() => setEtape("confirmation")} className={BOUTON}>
          {LIBELLES_CALENDRIER.retirer}
        </button>
      )}
      {etape === "confirmation" && (
        <div>
          <p className="text-sm text-texte">{PHRASE_CONFIRMATION_RETRAIT}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => void confirmer()} disabled={enCours} className={cn(BOUTON, "disabled:opacity-60")}>
              Oui, retirer du calendrier
            </button>
            <button type="button" onClick={() => { setEtape("repos"); setRefus(null); }} disabled={enCours} className={cn(BOUTON, "disabled:opacity-60")}>
              Annuler
            </button>
          </div>
        </div>
      )}
      {etape === "fait" && <p role="status" className="text-sm font-bold text-texte">C&apos;est fait : ce carrousel n&apos;est plus au calendrier.</p>}
      {refus && <p role="alert" className="mt-2 rounded-[10px] bg-surface-1 p-2 text-sm font-bold text-texte">{refus}</p>}
    </div>
  );
}
