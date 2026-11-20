"use client";

/**
 * RAP-3 · « Retirer du calendrier » pour un post repris du diffuseur : geste LOCAL en deux temps (bouton, confirmation). Rien n'est demandé
 * au diffuseur et rien n'est effacé : le post RESTE programmé chez lui et partira à l'heure prévue.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { retirerRapatrieeAction } from "@/app/(studio)/calendrier/actions/retirer-rapatriee";
import { cn } from "@/lib/cn";

const BOUTON = "min-h-11 rounded-[10px] border border-trait-fort bg-surface-2 px-4 py-2 text-sm font-bold text-texte hover:bg-surface-3";

function useRouteurOuNul() {
  try {
    return useRouter();
  } catch {
    return null;
  }
}

export const LIBELLE_RETIRER_RAPATRIEE = "Retirer du calendrier (reste programmée chez le diffuseur)";
export const PHRASE_RETIRER_RAPATRIEE = "Retirer ce post du calendrier du Studio ? Il reste programmé chez le diffuseur et partira à l'heure prévue : rien n'est annulé là-bas. Pour l'annuler vraiment, faites-le chez le diffuseur.";

export function RetirerRapatriee({ publicationId }: { publicationId: string }) {
  const routeur = useRouteurOuNul();
  const [etape, setEtape] = useState<"repos" | "confirmation" | "fait">("repos");
  const [enCours, setEnCours] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);

  async function confirmer() {
    if (enCours) return;
    setEnCours(true);
    setRefus(null);
    try {
      const r = await retirerRapatrieeAction(publicationId);
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
          {LIBELLE_RETIRER_RAPATRIEE}
        </button>
      )}
      {etape === "confirmation" && (
        <div>
          <p className="text-sm text-texte">{PHRASE_RETIRER_RAPATRIEE}</p>
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
      {etape === "fait" && <p role="status" className="text-sm font-bold text-texte">C&apos;est fait : ce post n&apos;est plus au calendrier. Il reste programmé chez le diffuseur.</p>}
      {refus && <p role="alert" className="mt-2 rounded-[10px] bg-surface-1 p-2 text-sm font-bold text-texte">{refus}</p>}
    </div>
  );
}
