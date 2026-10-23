import React, { useLayoutEffect } from "react";
/**
 * Banc d'essai du lot 3 (contrôle seulement, jamais branché en production) : compositions Remotion `ExtraitLot3` (un élément sur la
 * prise de Will, 540 × 960 avec `scale: 0.5`) et `EnchainementLot3` (15 s, tout le lot). Tout est dessiné en 1080 × 1920.
 */
import { Composition, Sequence, useCurrentFrame } from "remotion";
import { BarreProgression } from "./BarreProgression";
import { AvisEtoiles } from "./AvisEtoiles";
import { CarrouselFeuillete } from "./CarrouselFeuillete";
import { Chrono } from "./Chrono";
import { EclatChiffre } from "./EclatChiffre";
import { FilEtape } from "./FilEtape";
import { JaugePourcentage } from "./JaugePourcentage";
import { PageWebDefile } from "./PageWebDefile";
import { PileNotifications } from "./PileNotifications";
import { EtiquetteTete, FPS, H, Polices, Prise, profondeurPrise, SousTitresV4, W } from "./commun-lot3";
import type { Fond, Palette } from "./commun-lot3";
import { ELEMENTS, planEnchainement, planExtrait } from "./plan-lot3";
import type { ElementId, Plan } from "./plan-lot3";

function EtiquetteGenerique(props: { palette: Palette; texte: string; iSortie: number; incl?: number; y?: number; alt?: boolean }) {
  const i = useCurrentFrame();
  return <EtiquetteTete i={i} i0={0} iSortie={props.iSortie} palette={props.palette} texte={props.texte} incl={props.incl} y={props.y} alt={props.alt} />;
}

const COMPOSANTS: Record<string, React.ComponentType<any>> = {
  FilEtape, Chrono, AvisEtoiles, EclatChiffre, PageWebDefile, CarrouselFeuillete, JaugePourcentage, PileNotifications, EtiquetteGenerique,
};

const hacher = (t: string): number => { let h = 5381; for (let k = 0; k < t.length; k++) h = ((h << 5) + h + t.charCodeAt(k)) | 0; return h; };

/** Audit par image (banc d'essai seulement) : écrit dans la console la profondeur D, le rectangle du sous-titre et de chaque objet posé, avec une empreinte de leur contenu. */
function Audit({ D }: { D: number }) {
  const frame = useCurrentFrame();
  useLayoutEffect(() => {
    const r = (e: Element) => { const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; };
    // empreinte visuelle : les ressorts qui finissent de se poser (écarts < 0,05) ne comptent pas comme un mouvement
    const st = document.querySelector("[data-st]");
    // le conteneur des sous-titres occupe toute la largeur : on mesure les mots, pas la boîte
    const mots = st ? Array.from(st.children).filter((c) => (c as HTMLElement).style.opacity !== "0").map(r) : [];
    const sb = mots.length ? [Math.min(...mots.map((m) => m[0])), Math.min(...mots.map((m) => m[1])), Math.max(...mots.map((m) => m[2])), Math.max(...mots.map((m) => m[3]))] : null;
    const ob = Array.from(document.querySelectorAll("[data-objet]")).map((e) => [e.getAttribute("data-objet"), ...r(e), hacher(e.innerHTML.replace(/-?\d+\.\d+/g, (m) => (+m).toFixed(1)) + r(e).join(","))]);
    console.log("AUDIT " + JSON.stringify({ f: frame, D: +D.toFixed(4), st: sb, ob }));
  });
  return null;
}

function Montage({ plan, palette, fond = "prise", audit = false }: { plan: Plan; palette: Palette; fond?: Fond; audit?: boolean }) {
  const frame = useCurrentFrame();
  const D = profondeurPrise(plan.cles, frame);
  return (
    <div style={{ position: "absolute", inset: 0, width: W, height: H, overflow: "hidden", background: "#E9DCC8" }}>
      <Polices />
      <Prise D={D} depart={plan.depart} fond={fond} />
      {plan.items.map((it, k) => {
        const Comp = COMPOSANTS[it.nom];
        return (
          <Sequence key={k} from={it.debut} durationInFrames={it.duree} layout="none">
            <Comp {...it.props} palette={palette} />
          </Sequence>
        );
      })}
      <SousTitresV4 mots={plan.mots} palette={palette} cles={plan.st} prise={plan.cles} muets={plan.muets} />
      <BarreProgression palette={palette} p={frame / plan.total} />
      {audit ? <Audit D={D} /> : null}
    </div>
  );
}

export const RacinePlancheLot3: React.FC = () => (
  <>
    <Composition
      id="ExtraitLot3" component={(p: { element: ElementId; palette: Palette; fond?: Fond; audit?: boolean }) => <Montage plan={planExtrait(p.element, p.palette)} palette={p.palette} fond={p.fond} audit={p.audit} />}
      width={W} height={H} fps={FPS} durationInFrames={96} defaultProps={{ element: "FilEtape" as ElementId, palette: "B" as Palette, fond: "prise" as Fond, audit: false }}
      calculateMetadata={({ props }) => ({ durationInFrames: planExtrait(props.element, props.palette).total })}
    />
    <Composition
      id="EnchainementLot3" component={(p: { palette: Palette; audit?: boolean }) => <Montage plan={planEnchainement(p.palette)} palette={p.palette} audit={p.audit} />}
      width={W} height={H} fps={FPS} durationInFrames={450} defaultProps={{ palette: "B" as Palette, audit: false }}
    />
  </>
);
export { ELEMENTS };
