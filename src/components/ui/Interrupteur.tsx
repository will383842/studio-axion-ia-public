"use client";

import { Switch } from "radix-ui";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icone, type NomIcone } from "./Icone";

/** Interrupteur avec libellé (ligne entière cliquable, ≥ 44 px ; le bouton seul aussi : zone élargie de 8 px, E2E-2 parcours n° 30). */
export function Interrupteur({
  libelle,
  detail,
  icone,
  coche,
  onChange,
  desactive,
  className,
}: {
  libelle: ReactNode;
  detail?: ReactNode;
  icone?: NomIcone;
  coche: boolean;
  onChange: (v: boolean) => void;
  desactive?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex min-h-12 items-center gap-3", className)}>
      {icone && (
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-texte-doux">
          <Icone nom={icone} size={18} />
        </span>
      )}
      <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer flex-col">
        <span className="text-[15px] font-semibold text-texte">{libelle}</span>
        {detail && <span className="text-sm text-texte-faible">{detail}</span>}
      </label>
      <Switch.Root
        id={id}
        checked={coche}
        onCheckedChange={onChange}
        disabled={desactive}
        className="relative h-7 w-12 shrink-0 rounded-full bg-surface-3 transition-colors duration-200 before:absolute before:-inset-2 before:content-[''] data-[state=checked]:bg-orange disabled:opacity-40"
      >
        <Switch.Thumb className="block size-6 translate-x-0.5 rounded-full bg-texte shadow transition-transform duration-200 ease-studio data-[state=checked]:translate-x-[22px]" />
      </Switch.Root>
    </div>
  );
}
