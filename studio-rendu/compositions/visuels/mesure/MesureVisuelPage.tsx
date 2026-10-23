import { useEffect, useRef, useState } from "react";
import { cancelRender, continueRender, delayRender } from "remotion";
import { FORMAT } from "../commun/constantes";
import type { ProprietesVisuelPage } from "../commun/types";
import { VisuelPage } from "../VisuelPage";
import { formaterMesure } from "./protocole";

/** `nonce` : tiré par l'opération pour ce rendu ; sans lui, la ligne de mesure serait ignorée. */
export type ProprietesMesure = ProprietesVisuelPage & { nonce: string };

const TOLERANCE_PX = 1;

/** Habille VisuelPage sans rien y changer : mesure le DOM réel (débordements, plus petit corps de texte) puis l'écrit dans la console. */
export function MesureVisuelPage({ spec, index, nonce }: ProprietesMesure) {
  const racine = useRef<HTMLDivElement>(null);
  // Le rendu attend dès le PREMIER rendu du composant (pas après l'effet) : aucune image prise avant la mesure.
  const [attente] = useState(() => delayRender("Mesure de la page"));
  useEffect(() => {
    const mesurer = async () => {
      await document.fonts.ready;
      // Deux images d'animation : la mise en page est posée avant de mesurer.
      await new Promise<void>((fin) => requestAnimationFrame(() => requestAnimationFrame(() => fin())));
      const noeuds = [...(racine.current?.querySelectorAll<HTMLElement>("*") ?? [])];
      let debordements = 0;
      let taillePoliceMin = Infinity;
      for (const n of noeuds) {
        const style = getComputedStyle(n);
        const coupe = style.overflow !== "visible";
        if (coupe && (n.scrollHeight > n.clientHeight + TOLERANCE_PX || n.scrollWidth > n.clientWidth + TOLERANCE_PX)) debordements++;
        const texte = [...n.childNodes].some((c) => c.nodeType === Node.TEXT_NODE && (c.textContent ?? "").trim() !== "");
        if (texte) {
          taillePoliceMin = Math.min(taillePoliceMin, parseFloat(style.fontSize));
          const r = n.getBoundingClientRect();
          if (r.left < -TOLERANCE_PX || r.top < -TOLERANCE_PX || r.right > FORMAT.largeur + TOLERANCE_PX || r.bottom > FORMAT.hauteur + TOLERANCE_PX) debordements++;
        }
      }
      console.log(formaterMesure(nonce, { debordements, taillePoliceMin: Number.isFinite(taillePoliceMin) ? taillePoliceMin : 0, textes: noeuds.length }));
    };
    mesurer().then(() => continueRender(attente), (e: unknown) => cancelRender(e));
  }, [nonce, attente]);
  return (
    <div ref={racine} style={{ width: FORMAT.largeur, height: FORMAT.hauteur, position: "relative" }}>
      <VisuelPage spec={spec} index={index} />
    </div>
  );
}
