"use client";

import { Slider } from "radix-ui";
import { useId } from "react";
import { cn } from "@/lib/cn";

/** Curseur (intensité de LUT, volume…) avec la valeur affichée en gros. */
export function Curseur({
  libelle,
  valeur,
  onChange,
  min = 0,
  max = 100,
  pas = 1,
  unite = "",
  className,
}: {
  libelle: string;
  valeur: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  pas?: number;
  unite?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("w-full", className)}>
      <div className="mb-2 flex items-baseline justify-between">
        <span id={id} className="text-sm font-semibold text-texte-doux">
          {libelle}
        </span>
        <span className="font-titre text-lg tabular-nums text-texte">
          {valeur}
          {unite}
        </span>
      </div>
      <Slider.Root
        aria-labelledby={id}
        value={[valeur]}
        min={min}
        max={max}
        step={pas}
        onValueChange={([v]) => onChange(v)}
        className="relative flex h-11 w-full touch-none select-none items-center"
      >
        <Slider.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-surface-3">
          <Slider.Range className="absolute h-full rounded-full bg-orange" />
        </Slider.Track>
        <Slider.Thumb aria-label={libelle} className="block size-6 rounded-full border-2 border-orange bg-texte shadow-orange transition-transform hover:scale-110" />
      </Slider.Root>
    </div>
  );
}
