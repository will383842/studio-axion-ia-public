"use client";

import { Checkbox } from "radix-ui";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icone } from "./Icone";

/** Case à cocher (ex. « Avant de publier », accord d'un personnage réel). Ligne entière cliquable. */
export function CaseACocher({
  libelle,
  detail,
  coche,
  onChange,
  desactive,
  className,
}: {
  libelle: ReactNode;
  detail?: ReactNode;
  coche: boolean;
  onChange: (v: boolean) => void;
  desactive?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex min-h-12 items-center gap-3", className)}>
      <Checkbox.Root
        id={id}
        checked={coche}
        onCheckedChange={(v) => onChange(v === true)}
        disabled={desactive}
        className="grid size-7 shrink-0 place-items-center rounded-lg border-2 border-trait-fort bg-surface-1 transition-colors data-[state=checked]:border-orange data-[state=checked]:bg-orange disabled:opacity-40"
      >
        <Checkbox.Indicator>
          <Icone nom="coche" size={16} className="text-sur-orange" strokeWidth={3} />
        </Checkbox.Indicator>
      </Checkbox.Root>
      <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer flex-col">
        <span className="text-[15px] font-semibold text-texte">{libelle}</span>
        {detail && <span className="text-sm text-texte-faible">{detail}</span>}
      </label>
    </div>
  );
}
