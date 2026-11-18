"use client";

// Confirmation affichée DANS la page (à la place de la fenêtre du navigateur) pour l'écran « Mots ».
// Même patron que EcranMotsCibles : une question à la fois, « Annuler » d'abord, sans « oui » rien n'est appelé.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { Dialogue } from "@/components/ui/Dialogue";
import { LIBELLES_ECRAN } from "./fiche-mot-libelles";

export const TITRE_CONFIRMATION = "Confirmer ce geste ?";
export const LIBELLE_CONFIRMER = "Confirmer";

export interface ConfirmationDansLaPage {
  /** Pose la question ; la promesse vaut `true` seulement après un « Confirmer » explicite. */
  demander(phrase: string): Promise<boolean>;
  /** À rendre dans l'arbre de l'écran : la boîte quand une question est posée, sinon `null`. */
  dialogue: ReactNode;
}

export function useConfirmationDansLaPage(): ConfirmationDansLaPage {
  const [phrase, setPhrase] = useState<string | null>(null);
  // Réponse en attente de la question affichée : prise UNE seule fois (un double clic ne résout qu'une fois).
  const enAttente = useRef<((oui: boolean) => void) | null>(null);

  const repondre = (oui: boolean) => {
    const resoudre = enAttente.current;
    if (!resoudre) return;
    enAttente.current = null;
    setPhrase(null);
    resoudre(oui);
  };

  // Au démontage de l'écran, une question encore ouverte est résolue à « non » : rien n'est appelé, rien ne reste en attente.
  useEffect(
    () => () => {
      const resoudre = enAttente.current;
      enAttente.current = null;
      resoudre?.(false);
    },
    [],
  );

  const demander = (question: string) => {
    // Une question encore ouverte est abandonnée : sa réponse est « non ».
    repondre(false);
    return new Promise<boolean>((resolve) => {
      enAttente.current = resolve;
      setPhrase(question);
    });
  };

  const dialogue =
    phrase === null ? null : (
      <Dialogue
        ouvert
        onOuvertChange={(o) => {
          if (!o) repondre(false);
        }}
        titre={TITRE_CONFIRMATION}
        description={phrase}
        pied={
          <>
            <Bouton variante="fantome" onClick={() => repondre(false)}>
              {LIBELLES_ECRAN.annuler}
            </Bouton>
            <Bouton onClick={() => repondre(true)}>{LIBELLE_CONFIRMER}</Bouton>
          </>
        }
      />
    );

  return { demander, dialogue };
}
