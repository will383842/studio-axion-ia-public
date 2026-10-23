import React from "react";
/**
 * Habillage de variété d'une scène : les calques des axes autour du contenu, dans un ORDRE FIXE (de l'extérieur vers
 * l'intérieur) : matière, transitions, caméra, récit, chiffres. Sans variété, le contenu est rendu tel quel.
 */
import type { ReactNode } from "react";
import { CalqueCamera } from "./camera/calque";
import { CalqueChiffres } from "./chiffres/calque";
import { CalqueMatiere } from "./matiere/calque";
import { CalqueRecit } from "./recit/calque";
import { CalqueTransitions } from "./transitions/calque";
import { useVariete } from "./ContexteVariete";

export function HabillageVariete({ children }: { children: ReactNode }) {
  const variete = useVariete();
  if (!variete) return <>{children}</>;
  return (
    <CalqueMatiere>
      <CalqueTransitions>
        <CalqueCamera>
          <CalqueRecit>
            <CalqueChiffres>{children}</CalqueChiffres>
          </CalqueRecit>
        </CalqueCamera>
      </CalqueTransitions>
    </CalqueMatiere>
  );
}
