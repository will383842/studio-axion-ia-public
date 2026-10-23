/**
 * Gestes du stylo (pièce B) : souligner, entourer, barrer, cocher. Les gestes appartiennent au stylo, pas au format.
 * Le trait suit EXACTEMENT les courbes de `src/briques/stylo/courbes` (même fonction pour le trait et pour la pointe) ;
 * le stylo les accompagne s'il est demandé. Couleurs et épaisseurs : seulement `charte-video/1`.
 *
 * - `Souligner` réutilise `Trait` du noyau motion (importé, non modifié) : il se pose donc dans un contexte motion
 *   (`CarteMotion`) et suit son horloge `t`.
 * - `Entourer`, `Barrer`, `Cocher` ne dépendent que de Remotion (`useCurrentFrame`) ; `t` (s) peut être imposé.
 */
import { useCurrentFrame, useVideoConfig } from "remotion";
import { COULEURS_VIDEO, EPAISSEURS_VIDEO } from "../../../../src/briques/habillage/charte-video";
import { COURBES_GESTES, trace } from "../../../../src/briques/stylo/courbes";
import { STYLO_PAR_DEFAUT } from "../../../../src/briques/stylo/registre";
import type { Cible, NomGeste } from "../../../../src/briques/stylo/types";
import { Trait } from "../motion/noyau";
import { Stylo } from "./Stylo";

export interface ProprietesGeste {
  cible: Cible;
  /** Début du geste (s). */
  debut: number;
  /** Durée du geste (s). */
  duree: number;
  /** Largeur de la composition (px), pour les épaisseurs (1080 de référence). */
  largeurVideo?: number;
  /** Identifiant du stylo qui accompagne le geste ; `false` = trait seul. */
  stylo?: string | false;
  /** Hauteur du stylo (px). */
  hauteurStylo?: number;
  /** Instant imposé (s) ; sinon l'horloge Remotion. */
  t?: number;
}

function useInstant(t?: number): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return t ?? frame / fps;
}

const fraction = (t: number, debut: number, duree: number) => (duree <= 0 ? (t >= debut ? 1 : 0) : Math.min(1, Math.max(0, (t - debut) / duree)));

function PointeStylo({ geste, p, u }: { geste: NomGeste; p: ProprietesGeste; u: number }) {
  if (p.stylo === false || u <= 0) return null;
  const pt = COURBES_GESTES[geste](u, p.cible);
  return <Stylo id={p.stylo ?? STYLO_PAR_DEFAUT} x={pt.x} y={pt.y} hauteur={p.hauteurStylo ?? p.cible.hauteur * 4} opacite={u >= 1 ? 0 : 1} />;
}

/** Soulignement : `Trait` du noyau, en orange de l'habillage, sous la cible ; le stylo suit le bord du trait. */
export function Souligner(p: ProprietesGeste) {
  const t = useInstant(p.t);
  const u = fraction(t, p.debut, p.duree);
  const e = Math.max(2, Math.round(EPAISSEURS_VIDEO.soulignement * (p.largeurVideo ?? 1080)));
  const depart = COURBES_GESTES.souligner(0, p.cible);
  return (
    <>
      <div style={{ position: "absolute", left: depart.x, top: depart.y - e / 2 }}>
        <Trait debut={p.debut} largeur={p.cible.largeur} epaisseur={e} duree={p.duree} couleur={COULEURS_VIDEO.soulignement} />
      </div>
      <PointeStylo geste="souligner" p={p} u={u} />
    </>
  );
}

function Marque({ geste, p }: { geste: NomGeste; p: ProprietesGeste }) {
  const t = useInstant(p.t);
  const u = fraction(t, p.debut, p.duree);
  const e = Math.max(2, Math.round(EPAISSEURS_VIDEO.marque * (p.largeurVideo ?? 1080)));
  const pts = u > 0 ? trace(COURBES_GESTES[geste], p.cible, u, 64) : [];
  const d = pts.map((q, i) => `${i === 0 ? "M" : "L"}${q.x.toFixed(2)} ${q.y.toFixed(2)}`).join(" ");
  return (
    <>
      {pts.length > 1 && (
        <svg style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none" }}>
          <path d={d} fill="none" stroke={COULEURS_VIDEO.soulignement} strokeWidth={e} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      <PointeStylo geste={geste} p={p} u={u} />
    </>
  );
}

export const Entourer = (p: ProprietesGeste) => <Marque geste="entourer" p={p} />;
export const Barrer = (p: ProprietesGeste) => <Marque geste="barrer" p={p} />;
export const Cocher = (p: ProprietesGeste) => <Marque geste="cocher" p={p} />;
