"use client";

// MG-4 — liste cherchable des guides et des adresses de page. Présentation pure : le catalogue arrive en propriété.
import { useState, type KeyboardEvent } from "react";
import { Champ } from "@/components/ui/Champ";
import { Pastille } from "@/components/ui/Pastille";
import {
  rechercherCibles,
  type ElementCatalogue,
} from "@/domaine/guide-reseau/cibles-contrat";
import { cn } from "@/lib/cn";
import { LIBELLES_MOTS as L } from "./tableau-mots-libelles";

const MAX_AFFICHEES = 50;

export interface ProprietesChoixCibleMot {
  catalogue: readonly ElementCatalogue[];
  /** Code de la cible déjà choisie, ou null. */
  valeur: string | null;
  /** Code de la cible actuelle du mot (changement de cible) : pastille « Cible actuelle », choisir la même ne fait rien. */
  actuelle?: string | null;
  onChoisir: (codeCible: string) => void;
}

/** Cibles actives seulement ; les cibles d'essai sont en dernier avec un badge TEST. */
export function ChoixCibleMot({
  catalogue,
  valeur,
  actuelle = null,
  onChoisir,
}: ProprietesChoixCibleMot) {
  const [texte, setTexte] = useState("");
  const [dejaCible, setDejaCible] = useState(false);
  const plus = rechercherCibles(catalogue, texte, { max: MAX_AFFICHEES + 1 });
  const trouvees = plus.slice(0, MAX_AFFICHEES);
  // Entrée dans la recherche ne doit jamais envoyer le formulaire qui l'entoure.
  const surTouche = (e: KeyboardEvent) => {
    if (e.key === "Enter") e.preventDefault();
  };
  const choisir = (code: string) => {
    if (actuelle !== null && code === actuelle) {
      setDejaCible(true);
      return;
    }
    setDejaCible(false);
    onChoisir(code);
  };
  return (
    <div className="flex flex-col gap-2">
      <Champ
        libelle={L.choix.libelleRecherche}
        aide={L.choix.aideRecherche}
        type="search"
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        onKeyDown={surTouche}
      />
      {dejaCible && (
        <p className="text-sm font-semibold text-texte" role="status">
          {L.choix.dejaCible}
        </p>
      )}
      {plus.length > MAX_AFFICHEES && (
        <p className="text-sm text-texte-doux" role="status">
          {L.choix.limite}
        </p>
      )}
      {trouvees.length === 0 ? (
        <p className="text-sm text-texte-doux" role="status">
          {L.choix.aucune}
        </p>
      ) : (
        <ul className="flex flex-col gap-1" aria-label={L.choix.liste}>
          {trouvees.map((e) => (
            <li key={e.code} data-cible={e.code}>
              {/* Pas d'aria-label : le nom du bouton est son texte (titre, type, TEST, cible actuelle, choisie). */}
              <button
                type="button"
                aria-pressed={e.code === valeur}
                onClick={() => choisir(e.code)}
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
                {e.code === actuelle && (
                  <Pastille ton="orange">{L.choix.actuelle}</Pastille>
                )}
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
