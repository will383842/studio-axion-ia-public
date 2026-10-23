import React from "react";
/**
 * 1. EtiquetteTete — l'objet de base du lot : une plaque (1-2 lignes) au-dessus de la tête, éventuellement coiffée d'une SurEtiquette.
 * Gabarit M1 (descente D1 de la prise, gérée par la scène), largeur 0,40-0,72 L, inclinaison -4° à +3°.
 * UNE SEULE plaque, même à 2 lignes (la 2ᵉ ligne la fait grandir vers le bas en 3 i, avec une secousse de 4 px) ; sur-étiquette à cheval sur son coin haut-gauche.
 * Déroulé (images depuis i0) : 0 pop de la plaque · 4 sur-étiquette pop · instants[1] 2ᵉ ligne · `changement.a` rouleau · sortie S-RETRECIT 3 i.
 */
import { useCurrentFrame } from "remotion";
import { Anim, BAS_M1, COULEURS, Plaque, Rouleau, SurEtiquette, W, accents, corpsPour, courbe, entreePop, hauteurPlaque, secousse, Son, ressort } from "./commun-lot1";
import type { Palette } from "./commun-lot1";

export type EtiquetteTeteProps = {
  palette: Palette;
  /** 1 ou 2 lignes, telles que Will les dit. */
  lignes: string[];
  surEtiquette?: string;
  /** Fond de la plaque : à alterner d'une étiquette à la suivante. */
  fond?: "ACCENT" | "BLANC";
  /** Inclinaison au repos (° ; -4 à +3). */
  inclinaison?: number;
  /** Décalage horizontal du centre (fraction de L, ±0,08). */
  decalage?: number;
  /** Instants des mots déclencheurs, en images depuis i0 : [mot 1, mot 2…]. */
  instants?: number[];
  /** Changement de texte en place (rouleau) : nouvelles lignes à l'image `a`. */
  changement?: { lignes: string[]; a: number };
  /** Image où commence la sortie (défaut 30 = 1 s). */
  sortie?: number;
  /** Sans bruitage (enchaînement dense). */
  muet?: boolean;
};

export const DUREE_DEFAUT = 36;
export const evenements = (p: Pick<EtiquetteTeteProps, "lignes" | "surEtiquette" | "instants" | "changement" | "sortie">): number[] => {
  const e = [0];
  if (p.surEtiquette) e.push(4);
  if (p.lignes.length > 1) e.push(p.instants?.[1] ?? 12);
  if (p.changement) e.push(p.changement.a);
  e.push(p.sortie ?? 30);
  return e;
};

export function EtiquetteTete({ palette, lignes, surEtiquette, fond = "ACCENT", inclinaison = -3, decalage = 0, instants = [0, 12], changement, sortie = 30, muet }: EtiquetteTeteProps) {
  const i = useCurrentFrame();
  const { ACCENT_1 } = accents(palette);
  const fondPlaque = fond === "ACCENT" ? ACCENT_1 : COULEURS.BLANC;
  const toutes = changement ? [...lignes, ...changement.lignes] : lignes;
  const corps = corpsPour(toutes, 0.7 * W - 2 * 22, 72, 50);
  const padV = 0.27, padH = 0.36, inter = 0.1 * corps;
  const hLigne = corps;
  const hPlaque = (n: number) => Math.round(n * hLigne + (n - 1) * inter + 2 * padV * corps + 10);
  const n = lignes.length;
  const i2 = instants[1] ?? 12;
  // hauteur courante : 1 ligne, puis 2 lignes en 3 i quand la 2ᵉ ligne arrive (la plaque grandit vers le bas, le haut reste fixe)
  const croit = n > 1 ? courbe(i, i2, 3) : 1;
  const hauteur = n > 1 ? hPlaque(1) + (hPlaque(n) - hPlaque(1)) * croit : hPlaque(1);
  const top = BAS_M1 - hauteur;
  const largeurFixe = Math.round(Math.max(...toutes.map((t) => t.length)) * corps * 0.79 + 2 * padH * corps + 10);
  const pop = entreePop(i, { incl: inclinaison, sortie });
  const surPop = entreePop(i - 4, { incl: -1.5, sortie, depart: 0.2 });
  const dx = n > 1 ? secousse(i - i2 - 3, 0.004 * W) : 0;
  const popLigne2 = n > 1 ? Math.min(1.1, ressort("POP", i - i2)) : 1;
  return (
    <>
      <Anim etat={pop} origine="50% 40%" style={{ position: "absolute", left: W * (0.5 + decalage) + dx, top: BAS_M1 - hPlaque(n), height: hPlaque(n), transform: "translateX(-50%)", width: largeurFixe }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: hauteur }}>
          <Plaque fond={fondPlaque} corps={corps} largeur={largeurFixe} padV={padV} padH={padH} style={{ height: hauteur, flexDirection: "column", gap: inter, justifyContent: n > 1 ? "flex-start" : "center", overflow: "hidden" }}>
            {lignes.map((t, k) => {
              const nouveau = changement?.lignes[k];
              const contenu = nouveau !== undefined && changement ? <Rouleau ancien={t} nouveau={nouveau} i={i} a={changement.a} /> : t;
              return <span key={k} style={{ display: "block", transform: k > 0 ? `scale(${popLigne2})` : undefined, opacity: k > 0 ? (i >= i2 ? 1 : 0) : 1 }}>{contenu}</span>;
            })}
          </Plaque>
          {surEtiquette ? (
            <Anim etat={surPop} origine="0% 100%" style={{ position: "absolute", left: 0, top: 0 }}>
              <SurEtiquette texte={surEtiquette} corps={40} />
            </Anim>
          ) : null}
        </div>
      </Anim>
      {!muet && <Son t={0} fichier="select_001" volume={0.1} />}
    </>
  );
}
