"use client";

import Image from "next/image";
import { Icone } from "@/components/ui";
import { LIBELLES_ZONES } from "@/domaine/mes-images";
import type { ZoneSensible } from "@/domaine/types";
import { cn } from "@/lib/cn";
import { zoneEnPourcent } from "./outils";

/**
 * Une image de « Mes images » avec ses zones sensibles : floutées (vert), ou proposées au floutage (orange, à
 * toucher pour la garder ou non). Sans copie floutée réelle (essai), le flou est posé par l'écran.
 */
export function ImageAvecZones({
  src,
  alt,
  largeur,
  hauteur,
  zones,
  floutee,
  copieReelle,
  choisies,
  onBasculer,
  video,
  className,
  tailles = "(max-width: 640px) 33vw, 200px",
}: {
  src: string | null;
  alt: string;
  largeur?: number;
  hauteur?: number;
  zones: ZoneSensible[];
  floutee: boolean;
  copieReelle: boolean;
  /** Zones retenues pour le floutage (validation) ; absent : affichage seul. */
  choisies?: Set<number>;
  onBasculer?: (i: number) => void;
  video?: boolean;
  className?: string;
  tailles?: string;
}) {
  const l = largeur || 1600;
  const h = hauteur || 1000;
  return (
    // Paysage : toute la largeur ; portrait : toute la hauteur du cadre (le parent donne une hauteur définie).
    <div className={cn("relative mx-auto max-h-full max-w-full overflow-hidden rounded-xl bg-surface-2", l >= h ? "w-full" : "h-full", className)} style={{ aspectRatio: `${l} / ${h}` }}>
      {src ? <Image src={src} alt={alt} fill sizes={tailles} className="object-contain" /> : <span className="grid size-full place-items-center text-texte-faible"><Icone nom={video ? "film" : "image"} size={22} /></span>}
      {zones.map((z, i) => {
        const pos = zoneEnPourcent(z, l, h);
        const retenue = choisies ? choisies.has(i) : true;
        const flou = (floutee && z.floutee) || (choisies && retenue);
        const contenu = (
          <>
            {flou && !copieReelle && <span aria-hidden className="absolute inset-0 bg-fond/30 backdrop-blur-md" />}
            {(!floutee || choisies) && (
              <span className={cn("absolute -top-px left-0 max-w-full truncate rounded-br-md px-1 text-[9px] font-bold leading-4", retenue ? "bg-orange text-sur-orange" : "bg-surface-2 text-texte-doux")}>{LIBELLES_ZONES[z.type]}</span>
            )}
          </>
        );
        const classes = cn("absolute rounded-md", flou ? "border border-sauge/70" : "border-2 border-dashed border-orange", choisies && !retenue && "border-trait-fort opacity-70");
        return onBasculer ? (
          <button key={i} type="button" aria-pressed={retenue} aria-label={`${retenue ? "Ne plus flouter" : "Flouter"} : ${LIBELLES_ZONES[z.type]}`} onClick={() => onBasculer(i)} className={classes} style={pos}>
            {contenu}
          </button>
        ) : (
          <span key={i} className={classes} style={pos}>
            {contenu}
          </span>
        );
      })}
    </div>
  );
}
