"use client";

/** RAP-3 finitions · « Retirer du calendrier les N introuvables » : geste LOCAL en deux temps (bouton, confirmation). Rien n'est écrit chez le diffuseur ni effacé. */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { retirerIntrouvablesAction } from "@/app/(studio)/calendrier/actions/retirer-introuvables";

const BOUTON = "min-h-11 rounded-[10px] border border-trait-fort bg-surface-2 px-4 py-2 text-sm font-bold text-texte hover:bg-surface-3 disabled:opacity-60";

function useRouteurOuNul() {
  try {
    return useRouter();
  } catch {
    return null;
  }
}

export const libelleRetirerIntrouvables = (n: number) => (n > 1 ? `Retirer du calendrier les ${n} retirables` : "Retirer du calendrier la retirable");

export function BoutonRetirerIntrouvables({ ids }: { ids: string[] }) {
  const nombre = ids.length;
  const routeur = useRouteurOuNul();
  const [etape, setEtape] = useState<"repos" | "confirmation">("repos");
  const [enCours, setEnCours] = useState(false);
  const [retour, setRetour] = useState<string | null>(null);
  async function confirmer() {
    if (enCours) return;
    setEnCours(true);
    setRetour(null);
    try {
      const r = await retirerIntrouvablesAction(ids);
      if (r.ok) {
        if (routeur) routeur.refresh();
        else window.location.reload();
      } else setRetour(r.message || "Le retrait n'a pas pu être fait. Réessayez.");
    } catch {
      setRetour("Le retrait n'a pas pu être fait. Réessayez.");
    } finally {
      setEnCours(false);
    }
  }
  return (
    <>
      {etape === "repos" ? (
        <button type="button" onClick={() => setEtape("confirmation")} className={BOUTON}>
          {libelleRetirerIntrouvables(nombre)}
        </button>
      ) : (
        <span className="flex w-full flex-wrap items-center gap-2">
          <span className="min-w-0 flex-1 text-sm font-normal">Retirer {nombre > 1 ? `ces ${nombre} publications` : "cette publication"} du calendrier du Studio ? Rien n&apos;est supprimé ni changé chez le diffuseur.</span>
          <button type="button" onClick={() => void confirmer()} disabled={enCours} className={BOUTON}>
            Oui, retirer du calendrier
          </button>
          <button type="button" onClick={() => { setEtape("repos"); setRetour(null); }} disabled={enCours} className={BOUTON}>
            Annuler
          </button>
        </span>
      )}
      {retour && <span role="alert" className="text-sm font-bold text-texte">{retour}</span>}
    </>
  );
}
