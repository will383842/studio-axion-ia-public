"use client";

/**
 * EMPLACEMENT DES BOUTONS DE RETOUCHE d'une scène (tâche TB-21, plan § 13.1). Affiche la liste d'opérations REÇUE en
 * propriété ({libellé, gratuit ou payant}) ; ne connaît pas la liste fermée du moteur (elle arrive à part, TB-20).
 */
import { Bouton } from "@/components/ui/Bouton";
import { Pastille } from "@/components/ui/Pastille";
import type { OperationRetouche } from "./vue";

export function BoutonsRetoucheTableau({
  operations,
  onChoisir,
  possible = true,
  enCours,
}: {
  operations: readonly OperationRetouche[];
  onChoisir?: (cle: string) => void;
  /** Faux pendant une fabrication : les boutons sont visibles mais inactifs. */
  possible?: boolean;
  /** Clé de l'opération qui part. */
  enCours?: string | null;
}) {
  if (!operations.length) return null;
  return (
    <ul aria-label="Retouches" className="flex flex-wrap gap-2">
      {operations.map((o) => (
        <li key={o.cle}>
          <Bouton variante="contour" disabled={!possible || !onChoisir} chargement={enCours === o.cle} onClick={() => onChoisir?.(o.cle)}>
            {o.libelle}
            <Pastille ton={o.payant ? "ambre" : "sauge"} className="ml-1">
              {o.payant ? "Payant" : "Gratuit"}
            </Pastille>
          </Bouton>
        </li>
      ))}
    </ul>
  );
}
