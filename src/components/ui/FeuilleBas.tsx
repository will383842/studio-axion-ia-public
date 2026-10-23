"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { Drawer } from "vaul";
import { cn } from "@/lib/cn";
import { Icone } from "./Icone";
import { useRetourFerme } from "./useRetourFerme";

export interface ProprietesFeuilleBas {
  ouverte: boolean;
  onOuverteChange: (v: boolean) => void;
  titre: string;
  /** Une ligne sous le titre, au plus. */
  description?: string;
  /** Contenu pleine hauteur (recherche globale sur mobile). */
  pleinEcran?: boolean;
  /** Action principale collée en bas de la feuille. */
  pied?: ReactNode;
  /** Élément déclencheur (optionnel si la feuille est contrôlée ailleurs). */
  declencheur?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Feuille du bas (vaul) : la forme principale des actions secondaires sur mobile.
 * Sur ordinateur, elle s'affiche centrée en bas, largeur limitée.
 */
export function FeuilleBas({ ouverte, onOuverteChange, titre, description, pleinEcran, pied, declencheur, children, className }: ProprietesFeuilleBas) {
  // Le retour du navigateur ferme la feuille au lieu de quitter la page (navigation, E2E-2 parcours n° 24).
  useRetourFerme(ouverte, () => onOuverteChange(false));
  // Élément qui avait le focus à l'ouverture (le bouton qui a ouvert la feuille) : il le retrouve à la fermeture,
  // au lieu de laisser le clavier repartir du haut de la page. Mémorisé avant que la feuille ne prenne le focus.
  const retourFocus = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (ouverte && document.activeElement instanceof HTMLElement && document.activeElement !== document.body) retourFocus.current = document.activeElement;
  }, [ouverte]);
  return (
    // autoFocus : vaul laisse sinon le focus sur le déclencheur, et Tab sort de la feuille.
    <Drawer.Root open={ouverte} onOpenChange={onOuverteChange} repositionInputs={false} autoFocus>
      {declencheur && <Drawer.Trigger asChild>{declencheur}</Drawer.Trigger>}
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-voile backdrop-blur-[2px]" />
        <Drawer.Content
          onCloseAutoFocus={(e) => {
            const el = retourFocus.current;
            retourFocus.current = null;
            if (el?.isConnected) {
              e.preventDefault();
              el.focus();
            }
          }}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-xl flex-col rounded-t-[24px] border border-b-0 border-trait bg-surface-1 outline-none",
            pleinEcran ? "h-[96dvh]" : "max-h-[90dvh]",
            className,
          )}
        >
          <div aria-hidden className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-trait-fort" />
          <div className="px-5 pb-2 pt-4">
            <div className="flex items-start justify-between gap-4">
              <Drawer.Title className="font-titre text-xl text-texte">{titre}</Drawer.Title>
              <Drawer.Close className="-m-2 grid size-11 shrink-0 place-items-center rounded-full text-texte-doux hover:bg-surface-2" aria-label="Fermer">
                <Icone nom="fermer" size={20} />
              </Drawer.Close>
            </div>
            {description ? (
              <Drawer.Description className="mt-1 text-sm text-texte-doux">{description}</Drawer.Description>
            ) : (
              <Drawer.Description className="sr-only">{titre}</Drawer.Description>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
          {pied && <div className="border-t border-trait bg-surface-1 px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">{pied}</div>}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
