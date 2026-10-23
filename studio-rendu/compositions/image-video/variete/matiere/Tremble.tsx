import React from "react";
/**
 * MAT-C · tremblé du trait fait main, pour les fils de la toile : filtre SVG (bruit + déplacement) FIXE (même graine à
 * chaque image : le trait ne « bout » pas). `FiltreTremble` pose la définition, lue par `filter="url(#…)"`.
 */

export const TREMBLE_FILS = "mat-c-fils";

export function FiltreTremble({ id, echelle, frequence }: { id: string; echelle: number; frequence: number }) {
  return (
    <svg width={0} height={0} style={{ position: "absolute", left: 0, top: 0 }} aria-hidden>
      <defs>
        <filter id={id} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency={frequence} numOctaves={2} seed={7} result="bruit" />
          <feDisplacementMap in="SourceGraphic" in2="bruit" scale={echelle} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}
