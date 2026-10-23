import { useEffect, useRef, useState } from "react";
import { cancelRender, continueRender, delayRender } from "remotion";
import { FORMAT } from "../commun/constantes";
import { dessinsDe } from "../commun/occupation";
import { ATTRIBUT_ZONE_CORPS, boiteEnZoneReservee, compterChevauchements, partVide, type Boite } from "../commun/zones";
import type { ProprietesVisuelPage } from "../commun/types";
import { VisuelPage } from "../VisuelPage";
import { attendreTitres } from "./attente-titres";
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
      // Les titres ajustés (`Titre.tsx`) prennent leur corps définitif après le chargement de leur police : on ne mesure pas un titre
      // encore « en attente » (il n'a alors aucun texte, et une page dont le seul texte est un titre, T10 sans légende, sortait à 0).
      await attendreTitres(() => racine.current);
      // Deux images d'animation : la mise en page est posée avant de mesurer.
      await new Promise<void>((fin) => requestAnimationFrame(() => requestAnimationFrame(() => fin())));
      const noeuds = [...(racine.current?.querySelectorAll<HTMLElement>("*") ?? [])];
      let debordements = 0;
      let taillePoliceMin = Infinity;
      let textesEnZone = 0;
      const lignes: { boite: Boite; groupe: number }[] = [];
      let groupe = 0;
      for (const n of noeuds) {
        const style = getComputedStyle(n);
        const coupe = style.overflow !== "visible";
        if (coupe && (n.scrollHeight > n.clientHeight + TOLERANCE_PX || n.scrollWidth > n.clientWidth + TOLERANCE_PX)) debordements++;
        const texte = [...n.childNodes].some((c) => c.nodeType === Node.TEXT_NODE && (c.textContent ?? "").trim() !== "");
        if (texte) {
          taillePoliceMin = Math.min(taillePoliceMin, parseFloat(style.fontSize));
          const r = n.getBoundingClientRect();
          // Zones recouvertes par la plateforme : on mesure chaque ligne de texte (pas la boîte de l'élément, plus large que son texte).
          const plage = document.createRange();
          for (const c of n.childNodes) {
            if (c.nodeType !== Node.TEXT_NODE || (c.textContent ?? "").trim() === "") continue;
            plage.selectNodeContents(c);
            groupe++;
            for (const l of plage.getClientRects()) {
              const boite = { gauche: l.left, haut: l.top, droite: l.right, bas: l.bottom };
              if (boiteEnZoneReservee(boite)) textesEnZone++;
              lignes.push({ boite, groupe });
            }
          }
          if (r.left < -TOLERANCE_PX || r.top < -TOLERANCE_PX || r.right > FORMAT.largeur + TOLERANCE_PX || r.bottom > FORMAT.hauteur + TOLERANCE_PX) debordements++;
        }
      }
      // Chevauchements : deux textes l'un sur l'autre, ou un texte posé sur un dessin : enveloppe marquée `ATTRIBUT_DESSIN`, ou `<svg>` dessiné sur place.
      const dessins = racine.current ? dessinsDe(racine.current) : [];
      const chevauchements = compterChevauchements(lignes, dessins);
      // Vide : part de la hauteur du corps de page sans texte ni dessin (0 pour une page sans corps : couvertures).
      const corps = racine.current?.querySelector(`[${ATTRIBUT_ZONE_CORPS}]`);
      const r = corps?.getBoundingClientRect();
      const vide = r ? partVide({ haut: r.top, bas: r.bottom }, [...lignes.map((l) => l.boite), ...dessins]) : 0;
      console.log(formaterMesure(nonce, { debordements, taillePoliceMin: Number.isFinite(taillePoliceMin) ? taillePoliceMin : 0, textes: noeuds.length, textesEnZone, chevauchements, vide }));
    };
    mesurer().then(() => continueRender(attente), (e: unknown) => cancelRender(e));
  }, [nonce, attente]);
  return (
    <div ref={racine} style={{ width: FORMAT.largeur, height: FORMAT.hauteur, position: "relative" }}>
      <VisuelPage spec={spec} index={index} />
    </div>
  );
}
