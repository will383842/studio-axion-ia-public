/**
 * DESSIN TRACÉ (TB-05) : un dessin de la banque (`src/briques/dessins/traces.ts`, grille 24 × 24) se trace trait par
 * trait en écriture, puis une teinte sable se pose derrière lui (≈ 1 s en tout). Même procédé que `IconeTracee` du
 * noyau motion (chemins de longueur 1, décalage du tiret), sans sa sortie : sur la page, rien ne s'efface.
 * Teinte : un disque sable derrière le dessin [supposé : les tracés de la banque sont des contours ouverts, les
 * remplir dessinerait des formes fausses].
 */
import { COULEURS_VIDEO, EPAISSEURS_VIDEO } from "../../../src/briques/habillage/charte-video";
import { GRILLE_DESSIN, TRACES_DESSINS } from "../../../src/briques/dessins/traces";
import type { RectPx } from "./types";

export function dessinConnu(id: string | undefined): boolean {
  return !!id && Object.prototype.hasOwnProperty.call(TRACES_DESSINS, id);
}

export function DessinTrace({ dessinId, px, contour, teinte, largeurImage }: { dessinId: string; px: RectPx; contour: number; teinte: number; largeurImage: number }) {
  if (!dessinConnu(dessinId) || contour <= 0) return null;
  const noeuds = TRACES_DESSINS[dessinId as keyof typeof TRACES_DESSINS] as readonly (readonly [string, { d: string }])[];
  const n = noeuds.length;
  const echelle = px.largeur / GRILLE_DESSIN;
  const epaisseur = (EPAISSEURS_VIDEO.trait * largeurImage) / echelle;
  const g = GRILLE_DESSIN / 2;
  return (
    <svg
      viewBox={`0 0 ${GRILLE_DESSIN} ${GRILLE_DESSIN}`}
      style={{ position: "absolute", left: px.x, top: px.y, width: px.largeur, height: px.hauteur, overflow: "visible", pointerEvents: "none" }}
    >
      {teinte > 0 && <circle cx={g} cy={g} r={g * 0.92 * (0.85 + 0.15 * teinte)} fill={COULEURS_VIDEO.sable} fillOpacity={0.75 * teinte} />}
      {noeuds.map(([, a], i) => {
        const k = Math.min(1, Math.max(0, contour * n - i));
        if (k <= 0) return null;
        return (
          <path
            key={i}
            d={a.d}
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={(1 - k).toFixed(4)}
            fill="none"
            stroke={COULEURS_VIDEO.ecriture}
            strokeWidth={epaisseur}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
    </svg>
  );
}
