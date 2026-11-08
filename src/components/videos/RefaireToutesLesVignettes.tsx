"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { refaireToutesLesVignettesAction } from "@/app/(studio)/videos/actions";
import { Bouton } from "@/components/ui/Bouton";
import { enchainerVignettes, texteFinal, texteProgres, type BilanVignettes } from "@/domaine/vignettes-en-serie";

type Etat = { phase: "normal" } | { phase: "encours"; texte: string } | { phase: "termine"; bilan: BilanVignettes } | { phase: "erreur"; bilan: BilanVignettes };

/**
 * « Refaire toutes les vignettes » (en-tête de Mes vidéos) : UN clic enchaîne les tours jusqu'à 0 restante.
 * Rien n'est effacé, relançable sans risque. 4 états : normal, en cours, terminé, erreur.
 */
export function RefaireToutesLesVignettes() {
  const router = useRouter();
  const [etat, setEtat] = useState<Etat>({ phase: "normal" });
  const enCours = etat.phase === "encours";

  async function lancer() {
    setEtat({ phase: "encours", texte: "Je démarre…" });
    const bilan = await enchainerVignettes(refaireToutesLesVignettesAction, (p) => setEtat({ phase: "encours", texte: texteProgres(p) }));
    setEtat(bilan.etat === "termine" ? { phase: "termine", bilan } : { phase: "erreur", bilan });
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Bouton variante="secondaire" icone="image" chargement={enCours} disabled={enCours} onClick={() => void lancer()}>
        Refaire toutes les vignettes
      </Bouton>
      <p className="text-xs text-texte-doux" aria-live="polite" role="status">
        {etat.phase === "encours" && etat.texte}
        {etat.phase === "termine" && <span className="text-sauge">{texteFinal(etat.bilan)}</span>}
        {etat.phase === "erreur" && (
          <span className="text-brique">
            {etat.bilan.message} {etat.bilan.videos > 0 || etat.bilan.erreurs > 0 ? texteFinal(etat.bilan) : ""}
          </span>
        )}
      </p>
    </div>
  );
}
