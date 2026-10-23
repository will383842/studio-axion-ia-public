"use client";

import { Dialog } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icone } from "./Icone";
import { useRetourFerme } from "./useRetourFerme";

/** Boîte de dialogue centrée (confirmation sur ordinateur). Sur mobile, préférer FeuilleBas. */
export function Dialogue({
  ouvert,
  onOuvertChange,
  titre,
  description,
  pied,
  children,
  className,
}: {
  ouvert: boolean;
  onOuvertChange: (v: boolean) => void;
  titre: string;
  description?: string;
  pied?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  // Le retour du navigateur ferme la fenêtre au lieu de quitter la page.
  useRetourFerme(ouvert, () => onOuvertChange(false));
  return (
    <Dialog.Root open={ouvert} onOpenChange={onOuvertChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-voile backdrop-blur-[2px] data-[state=open]:animate-[apparition_.2s_ease-out]" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[24px] border border-trait bg-surface-1 p-6 shadow-carte outline-none",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title className="font-titre text-xl text-texte">{titre}</Dialog.Title>
            <Dialog.Close className="-m-2 grid size-11 shrink-0 place-items-center rounded-full text-texte-doux hover:bg-surface-2" aria-label="Fermer">
              <Icone nom="fermer" size={20} />
            </Dialog.Close>
          </div>
          {description ? <Dialog.Description className="mt-1 text-sm text-texte-doux">{description}</Dialog.Description> : <Dialog.Description className="sr-only">{titre}</Dialog.Description>}
          {children && <div className="mt-4">{children}</div>}
          {pied && <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{pied}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
