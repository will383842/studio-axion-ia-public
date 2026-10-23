/**
 * Traits laissés par la pointe du crayon (souligné, surligné, mot important) : le trait suit EXACTEMENT le chemin de la
 * pointe (`pointAction` du plan, mêmes courbes que `src/briques/stylo/courbes`). Entouré, barré et coché passent par
 * les gestes du stylo (`commune/stylo/Gestes.tsx`). Couleurs et épaisseurs : habillage `charte-video/1`.
 */
import { COULEURS_VIDEO, EPAISSEURS_VIDEO } from "../../../src/briques/habillage/charte-video";
import { Barrer, Cocher, Entourer } from "../commune/stylo/Gestes";
import { pointAction, type SorteAction } from "./plan";
import type { Cible } from "../../../src/briques/stylo/types";

const ECHANTILLONS = 40;

function chemin(sorte: SorteAction, cible: Cible, u: number, largeurImage: number, hauteurImage: number): string {
  if (u <= 0) return "";
  const pts = Array.from({ length: ECHANTILLONS + 1 }, (_, i) => pointAction({ sorte, cible }, (u * i) / ECHANTILLONS, largeurImage, hauteurImage));
  return pts.map((q, i) => `${i === 0 ? "M" : "L"}${q.x.toFixed(2)} ${q.y.toFixed(2)}`).join(" ");
}

const calque = { position: "absolute", left: 0, top: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none" } as const;

/** Soulignement orange (marque « souligne », mot important, geste « souligner »). */
export function TraitSouligne({ cible, u, largeurImage, hauteurImage }: { cible: Cible; u: number; largeurImage: number; hauteurImage: number }) {
  const d = chemin("souligner", cible, u, largeurImage, hauteurImage);
  if (!d) return null;
  const e = Math.max(2, Math.round(EPAISSEURS_VIDEO.soulignement * largeurImage));
  return (
    <svg style={calque}>
      <path d={d} fill="none" stroke={COULEURS_VIDEO.soulignement} strokeWidth={e} strokeLinecap="round" />
    </svg>
  );
}

/** Surlignage : bande orange translucide DERRIÈRE le texte (le texte reste en écriture, noir). */
export function TraitSurligne({ cible, u, largeurImage, hauteurImage }: { cible: Cible; u: number; largeurImage: number; hauteurImage: number }) {
  const d = chemin("surligner", cible, u, largeurImage, hauteurImage);
  if (!d) return null;
  return (
    <svg style={calque}>
      <path d={d} fill="none" stroke={COULEURS_VIDEO.soulignement} strokeOpacity={0.3} strokeWidth={Math.round(cible.hauteur * 0.62)} strokeLinecap="butt" />
    </svg>
  );
}

/** Entouré, barré, coché : gestes du stylo, trait seul (le crayon est posé une seule fois, par la scène). */
export function GesteTrace({ sorte, cible, debut, duree, t, largeurImage }: { sorte: SorteAction; cible: Cible; debut: number; duree: number; t: number; largeurImage: number }) {
  const p = { cible, debut, duree, t, largeurVideo: largeurImage, stylo: false as const };
  if (sorte === "entourer") return <Entourer {...p} />;
  if (sorte === "barrer") return <Barrer {...p} />;
  if (sorte === "cocher") return <Cocher {...p} />;
  return null;
}
