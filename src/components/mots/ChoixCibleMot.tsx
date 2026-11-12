"use client";

// MG-4 — liste cherchable des guides et des adresses de page. Présentation pure : le catalogue arrive en propriété.
import { useState } from "react";
import { Champ } from "@/components/ui/Champ";
import { Pastille } from "@/components/ui/Pastille";
import {
  rechercherCibles,
  type ElementCatalogue,
} from "@/domaine/guide-reseau/cibles-contrat";
import { cn } from "@/lib/cn";
import { LIBELLES_MOTS as L } from "./tableau-mots-libelles";

export interface ProprietesChoixCibleMot {
  catalogue: readonly ElementCatalogue[];
  /** Code de la cible déjà choisie, ou null. */
  valeur: string | null;
  onChoisir: (codeCible: string) => void;
}

/** Cibles actives seulement ; les cibles d'essai sont en dernier avec un badge TEST. */
export function ChoixCibleMot({
  catalogue,
  valeur,
  onChoisir,
}: ProprietesChoixCibleMot) {
  const [texte, setTexte] = useState("");
  const trouvees = rechercherCibles(catalogue, texte, { max: 50 });
  return (
    <div className="flex flex-col gap-2">
      <Champ
        libelle={L.choix.libelleRecherche}
        aide={L.choix.aideRecherche}
        type="search"
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
      />
      {trouvees.length === 0 ? (
        <p className="text-sm text-texte-doux" role="status">
          {L.choix.aucune}
        </p>
      ) : (
        <ul className="flex flex-col gap-1" aria-label={L.choix.liste}>
          {trouvees.map((e) => (
            <li key={e.code} data-cible={e.code}>
              <button
                type="button"
                aria-pressed={e.code === valeur}
                aria-label={L.choix.choisir(e.titre)}
                onClick={() => onChoisir(e.code)}
                className={cn(
                  "flex min-h-11 w-full flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm text-texte transition-colors hover:bg-surface-2",
                  e.code === valeur
                    ? "border-orange bg-surface-2"
                    : "border-trait bg-surface-1",
                )}
              >
                <span className="min-w-0 flex-1 font-semibold">{e.titre}</span>
                <Pastille>{L.typeElement[e.type]}</Pastille>
                {e.test && <Pastille ton="ambre">{L.badgeTest}</Pastille>}
                {e.code === valeur && (
                  <Pastille ton="sauge">{L.choix.choisie}</Pastille>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
