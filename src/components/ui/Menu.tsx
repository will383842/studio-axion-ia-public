"use client";

import { DropdownMenu } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icone, type NomIcone } from "./Icone";
import { PastilleEssai } from "./PastilleEssai";

export interface ElementMenu {
  libelle: string;
  icone?: NomIcone;
  onSelect: () => void;
  danger?: boolean;
  desactive?: boolean;
  essai?: boolean;
  /** « Bientôt » : visible mais inactif (ex. « Décliner »). */
  bientot?: boolean;
}

/** Menu déroulant (« … » d'une carte). `declencheur` doit être un bouton (ex. BoutonIcone). */
export function Menu({ declencheur, elements, aligner = "end" }: { declencheur: ReactNode; elements: (ElementMenu | "separateur")[]; aligner?: "start" | "end" }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{declencheur}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={aligner}
          sideOffset={6}
          className="z-50 min-w-56 rounded-2xl border border-trait bg-surface-1 p-1.5 shadow-carte data-[state=open]:animate-[apparition_.15s_ease-out]"
        >
          {elements.map((e, i) =>
            e === "separateur" ? (
              <DropdownMenu.Separator key={i} className="my-1 h-px bg-trait" />
            ) : (
              <DropdownMenu.Item
                key={e.libelle}
                disabled={e.desactive || e.bientot}
                onSelect={e.onSelect}
                className={cn(
                  "flex min-h-11 cursor-pointer select-none items-center gap-3 rounded-xl px-3 text-sm font-semibold outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-45 data-[highlighted]:bg-surface-2",
                  e.danger ? "text-brique" : "text-texte",
                )}
              >
                {e.icone && <Icone nom={e.icone} size={18} className={e.danger ? "" : "text-texte-doux"} />}
                <span className="flex-1">{e.libelle}</span>
                {e.essai && <PastilleEssai />}
                {e.bientot && <span className="text-[11px] font-bold uppercase tracking-wide text-texte-faible">Bientôt</span>}
              </DropdownMenu.Item>
            ),
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
