"use client";

/** RAP-3 · « Relire le diffuseur » : un passage de lecture (aucune écriture chez le diffuseur), puis la page se recharge. */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { relireDiffuseurAction } from "@/app/(studio)/calendrier/actions/relire-diffuseur";

function useRouteurOuNul() {
  try {
    return useRouter();
  } catch {
    return null;
  }
}

export function BoutonRelireDiffuseur() {
  const routeur = useRouteurOuNul();
  const [enCours, setEnCours] = useState(false);
  const [retour, setRetour] = useState<string | null>(null);
  async function relire() {
    if (enCours) return;
    setEnCours(true);
    setRetour(null);
    try {
      const r = await relireDiffuseurAction();
      if (r.ok) {
        if (routeur) routeur.refresh();
        else window.location.reload();
      } else setRetour("La relecture n'a pas pu être faite. Réessayez dans un moment.");
    } catch {
      setRetour("La relecture n'a pas pu être faite. Réessayez dans un moment.");
    } finally {
      setEnCours(false);
    }
  }
  return (
    <>
      <button type="button" onClick={() => void relire()} disabled={enCours} className="min-h-11 rounded-[10px] border border-trait-fort bg-surface-2 px-4 py-2 text-sm font-bold text-texte hover:bg-surface-3 disabled:opacity-60">
        {enCours ? "Relecture en cours…" : "Relire le diffuseur"}
      </button>
      {retour && <span role="alert" className="text-sm font-bold text-texte">{retour}</span>}
    </>
  );
}
