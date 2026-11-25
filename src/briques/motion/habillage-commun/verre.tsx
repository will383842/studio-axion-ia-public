/**
 * CARTE EN VERRE DÉPOLI PURE (X1-04). Rien ne l'importe : éteinte par défaut, hors `IDS_FONDS_VIVANTS` et hors
 * `choix.ts`. Drapeau `attendMesure: true` : éteint ; mesuré le 21/11 (CHIFFRAGE-VERRE-MESURE-2), seul 1 carte à 6 px visible 3 s sur 10 passe sous 15 %.
 *
 * Un flou d'arrière-plan (jamais plus de 16 px) et un voile uni de la charte : ivoire sur fond ivoire, noir sur fond
 * noir. Aucun dégradé, aucune autre couleur. Jamais pour la v4. PUR : aucun hasard, aucune horloge, imports relatifs.
 */
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { CHARTE_AXION, avecOpacite, type FondAxion } from "../../jetons-motion";

/** Flou maximal autorisé, en pixels. */
export const FLOU_MAX_PX = 16;

export interface DescriptionVerre {
  /** Flou d'arrière-plan en pixels (0 < n ≤ 16). */
  flouPx: number;
  /** Couleur du voile (charte) : ivoire sur ivoire, noir sur noir. */
  voileHex: string;
  /** Opacité du voile, de 0 à 1. */
  opacite: number;
  /** Éteint : 2 cartes à 12 px tout du long +78 % de rendu ; 1 carte tout du long +22 à +32 % ; 1 carte à 6 px, 3 s sur 10 : +6 %. */
  attendMesure: true;
}

export const DESCRIPTION_VERRE: Record<FondAxion, DescriptionVerre> = {
  ivoire: { flouPx: 6, voileHex: CHARTE_AXION.ivoire, opacite: 0.82, attendMesure: true },
  noir: { flouPx: 6, voileHex: CHARTE_AXION.noir, opacite: 0.82, attendMesure: true },
};

/** Mesuré (CHIFFRAGE-VERRE-MESURE-2) : seul ce cadre passe sous 15 % ; au-delà, seuil non démontré. */
export const MESURE_VERRE = "mesuré le 21/11 : +78 % à 12 px (2 cartes tout du long) ; +22 à +32 % (1 carte tout du long) ; +6 % (1 carte à 6 px, visible 3 s sur 10)";
export const CARTES_VERRE_MAX = 1;
export const PART_VISIBLE_VERRE_MAX = 0.3;

const borne = (n: number): number => Math.min(FLOU_MAX_PX, Math.max(0, Math.round(n)));

/** Style du verre pour un fond donné ; le flou demandé est ramené à 16 px au plus. */
export function styleVerre(fond: FondAxion, flouPx?: number): CSSProperties {
  const d = DESCRIPTION_VERRE[fond];
  const flou = `blur(${borne(flouPx ?? d.flouPx)}px)`;
  return {
    backdropFilter: flou,
    WebkitBackdropFilter: flou,
    backgroundColor: avecOpacite(d.voileHex, d.opacite),
  };
}

export interface ProprietesCarteVerre {
  fond: FondAxion;
  flouPx?: number;
  style?: CSSProperties;
  children?: ReactNode;
}

export function CarteVerre({ fond, flouPx, style, children }: ProprietesCarteVerre): ReactElement {
  return (
    <div data-verre={fond} style={{ ...styleVerre(fond, flouPx), ...style }}>
      {children}
    </div>
  );
}
