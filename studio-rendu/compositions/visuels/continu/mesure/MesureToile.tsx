/**
 * Habille `ToileContinue` sans rien y changer : attend les polices, mesure le DOM réel puis écrit UNE ligne `AXION-MESURE <nonce> {…}`
 * (protocole de `../../mesure/protocole`, clés de `protocole-toile.ts`). Coordonnées : celles de la toile (x de 0 à N × 1080).
 * - `debordements` : élément à défilement coupé qui déborde, ou texte hors de la toile ;
 * - `textesSurCouture` (bande de ±80 px, sauf `[data-mot-affiche]`), `textesHorsMarge` (80 px), `textesCoinReserve` (200 × 200 en bas à droite) ;
 * - `intrusionsMetaP1` : lignes de la page 1 dans `zonesInterdites("meta", 0)`, sauf l'en-tête et le pied posés par le moteur ;
 * - `chevauchements` : `compterChevauchements` sur les dessins de `dessinsDe`, sans les décors de fond (`[data-decor]`, la route d'un parcours) ;
 * - `debordCouture1` : objets `[data-a-cheval]` qui traversent x = 1080 ; `traitsFinsSurCouture` : `[data-trait-fin]` sur une couture.
 */
import { useEffect, useRef, useState } from "react";
import { cancelRender, continueRender, delayRender } from "remotion";
import { zonesInterdites } from "../../../../../src/briques/visuels/reseaux";
import { TOLERANCE_PX } from "../../commun/cadre";
import { dessinsDe } from "../../commun/occupation";
import { compterChevauchements, type Boite } from "../../commun/zones";
import { formaterMesure } from "../../mesure/protocole";
import { coutures, HAUTEURS, LARGEUR_PAGE } from "../constantes-continu";
import { policesContinuPretes } from "../polices-continu";
import { ToileContinue, type ProprietesToile } from "../ToileContinue";
import type { MesuresToile } from "./protocole-toile";
import { dansCoinReserve, horsMarge, surCouture, traverseCouture } from "./regles-toile";

export type ProprietesMesureToile = ProprietesToile & { nonce: string };

const boiteDe = (r: DOMRect): Boite => ({ gauche: r.left, haut: r.top, droite: r.right, bas: r.bottom });
const memeBoite = (a: Boite, b: Boite) => a.gauche === b.gauche && a.haut === b.haut && a.droite === b.droite && a.bas === b.bas;
const recouvre = (a: Boite, b: { x: number; y: number; largeur: number; hauteur: number }) => a.gauche < b.x + b.largeur && a.droite > b.x && a.haut < b.y + b.hauteur && a.bas > b.y;

export function MesureToile({ toile, versions, nonce }: ProprietesMesureToile) {
  const racine = useRef<HTMLDivElement>(null);
  const [attente] = useState(() => delayRender("Mesure de la toile"));
  useEffect(() => {
    const mesurer = async () => {
      await policesContinuPretes();
      await document.fonts.ready;
      await new Promise<void>((fin) => requestAnimationFrame(() => requestAnimationFrame(() => fin())));
      const el = racine.current;
      if (!el) throw new Error("Toile absente : rien à mesurer");
      const n = toile.pages.length;
      const hauteur = HAUTEURS[toile.format];
      const largeur = n * LARGEUR_PAGE;
      const noeuds = [...el.querySelectorAll<HTMLElement>("*")];
      const lignes: { boite: Boite; groupe: number }[] = [];
      const m = { debordements: 0, taillePoliceMin: Infinity, textesSurCouture: 0, textesHorsMarge: 0, textesCoinReserve: 0, intrusionsMetaP1: 0 };
      const zonesMeta = zonesInterdites("meta", 0);
      const plage = document.createRange();
      let groupe = 0;
      for (const noeud of noeuds) {
        const style = getComputedStyle(noeud);
        if (style.overflow !== "visible" && noeud !== el && (noeud.scrollHeight > noeud.clientHeight + TOLERANCE_PX || noeud.scrollWidth > noeud.clientWidth + TOLERANCE_PX)) m.debordements++;
        for (const c of noeud.childNodes) {
          if (c.nodeType !== Node.TEXT_NODE || (c.textContent ?? "").trim() === "") continue;
          m.taillePoliceMin = Math.min(m.taillePoliceMin, parseFloat(style.fontSize));
          plage.selectNodeContents(c);
          groupe++;
          const chrome = !!noeud.closest("[data-entete], [data-pied]");
          const affiche = !!noeud.closest("[data-mot-affiche]");
          for (const l of plage.getClientRects()) {
            const b = boiteDe(l);
            lignes.push({ boite: b, groupe });
            if (b.gauche < -TOLERANCE_PX || b.haut < -TOLERANCE_PX || b.droite > largeur + TOLERANCE_PX || b.bas > hauteur + TOLERANCE_PX) m.debordements++;
            if (!affiche && surCouture(b, n)) m.textesSurCouture++;
            if (horsMarge(b, hauteur)) m.textesHorsMarge++;
            if (dansCoinReserve(b, hauteur)) m.textesCoinReserve++;
            if (!chrome && b.gauche < LARGEUR_PAGE && zonesMeta.some((z) => recouvre(b, z))) m.intrusionsMetaP1++;
          }
        }
      }
      // Les décors de fond (route d'un parcours) passent sous le texte par construction : ils ne sont pas des obstacles.
      const decors = [...el.querySelectorAll("[data-decor]")].map((d) => boiteDe(d.getBoundingClientRect()));
      const dessins = dessinsDe(el).filter((d) => !decors.some((x) => memeBoite(x, d)));
      const aCheval = [...el.querySelectorAll("[data-a-cheval]")].map((d) => boiteDe(d.getBoundingClientRect()));
      const traitsFins = [...el.querySelectorAll("[data-trait-fin]")].map((d) => boiteDe(d.getBoundingClientRect()));
      const mesures: MesuresToile = {
        ...m,
        taillePoliceMin: Number.isFinite(m.taillePoliceMin) ? m.taillePoliceMin : 0,
        textes: groupe,
        chevauchements: compterChevauchements(lignes, dessins),
        debordCouture1: n > 1 ? aCheval.filter((b) => traverseCouture(b, LARGEUR_PAGE)).length : 0,
        traitsFinsSurCouture: traitsFins.filter((b) => coutures(n).some((x) => traverseCouture(b, x))).length,
        pages: n,
        largeur,
        hauteur,
      };
      console.log(formaterMesure(nonce, mesures));
    };
    mesurer().then(() => continueRender(attente), (e: unknown) => cancelRender(e));
  }, [toile, nonce, attente]);
  return (
    <div ref={racine} style={{ position: "relative", width: toile.pages.length * LARGEUR_PAGE, height: HAUTEURS[toile.format] }}>
      <ToileContinue toile={toile} versions={versions} />
    </div>
  );
}
