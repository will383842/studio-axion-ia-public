import { useEffect, useRef, useState } from "react";
import { cancelRender, continueRender, delayRender } from "remotion";
import { compterIntrusions, TOLERANCE_PX } from "../commun/cadre";
import { FORMAT } from "../commun/constantes";
import { dessinsDe, encreDesTitres, textesTropLarges } from "../commun/occupation";
import { ATTRIBUT_ZONE_CORPS, boiteEnZoneReservee, collisionsInterligne, compterChevauchements, partVide, type Boite } from "../commun/zones";
import type { ProprietesVisuelPage } from "../commun/types";
import { VisuelPage } from "../VisuelPage";
import { attendreTitres } from "./attente-titres";
import { formaterMesure } from "./protocole";

/** `nonce` : tiré par l'opération pour ce rendu ; sans lui, la ligne de mesure serait ignorée. */
export type ProprietesMesure = ProprietesVisuelPage & { nonce: string };

/**
 * Habille VisuelPage sans rien y changer : mesure le DOM réel (débordements, plus petit corps de texte) puis l'écrit dans la console.
 * `intrusions` (H2) : lignes de texte posées dans une zone interdite du cadre (0 sans cadre) ; `intrusion_<zone>` : détail par zone touchée.
 */
export function MesureVisuelPage({ spec, index, cadre, nonce }: ProprietesMesure) {
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
      // Plus longue ligne RENDUE, en signes (critère « lisibilité mobile » de la note) : chaque signe est rangé sur sa ligne réelle.
      let signesLigneMax = 0;
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
            const parLigne = new Map<number, number>();
            const texteNoeud = c.textContent ?? "";
            for (let k = 0; k < texteNoeud.length; k++) {
              if (texteNoeud[k] === "\n") continue;
              plage.setStart(c, k);
              plage.setEnd(c, k + 1);
              const rect = plage.getBoundingClientRect();
              const cle = Math.round(rect.top + rect.height / 2);
              const ligne = [...parLigne.keys()].find((h) => Math.abs(h - cle) < rect.height / 2) ?? cle;
              parLigne.set(ligne, (parLigne.get(ligne) ?? 0) + 1);
            }
            for (const v of parLigne.values()) signesLigneMax = Math.max(signesLigneMax, v);
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
      // Corps de page : un mot ou une pastille plus large que sa colonne est un débordement (le cadre total peut tenir quand même).
      for (const corpsRempli of racine.current?.querySelectorAll("[data-remplissage]") ?? []) debordements += textesTropLarges(corpsRempli);
      // Chevauchements : deux textes l'un sur l'autre, ou un texte posé sur un dessin : enveloppe marquée `ATTRIBUT_DESSIN`, ou `<svg>` dessiné sur place.
      const dessins = racine.current ? dessinsDe(racine.current) : [];
      // ART-1 : une ligne de titre dont le jambage (Ç, virgule) touche l'accent (É, À) de la ligne suivante compte aussi comme un chevauchement.
      const jambages = racine.current ? collisionsInterligne(encreDesTitres(racine.current)) : 0;
      const chevauchements = compterChevauchements(lignes, dessins) + jambages;
      // Vide : part de la hauteur du corps de page sans texte ni dessin (0 pour une page sans corps : couvertures).
      const corps = racine.current?.querySelector(`[${ATTRIBUT_ZONE_CORPS}]`);
      const r = corps?.getBoundingClientRect();
      // Les liaisons (flèches de T28) ne comptent pas dans l'occupation : une flèche étirée ne remplit pas une page (ART-1).
      const occupes = racine.current ? dessinsDe(racine.current, { pourVide: true }) : [];
      const intrusions = compterIntrusions(lignes.map((l) => l.boite), cadre, index);
      const detail = Object.fromEntries(Object.entries(intrusions.parZone).map(([nom, n]) => [`intrusion_${nom}`, n]));
      const vide = r ? partVide({ haut: r.top, bas: r.bottom }, [...lignes.map((l) => l.boite), ...occupes]) : 0;
      console.log(formaterMesure(nonce, { debordements, taillePoliceMin: Number.isFinite(taillePoliceMin) ? taillePoliceMin : 0, textes: noeuds.length, textesEnZone, chevauchements, vide, jambages, signesLigneMax, intrusions: intrusions.total, ...detail }));
    };
    mesurer().then(() => continueRender(attente), (e: unknown) => cancelRender(e));
  }, [nonce, attente, cadre, index]);
  return (
    <div ref={racine} style={{ width: FORMAT.largeur, height: FORMAT.hauteur, position: "relative" }}>
      <VisuelPage spec={spec} index={index} cadre={cadre} />
    </div>
  );
}
